import {
  armarPagina,
  desdeElCursor,
  resolverLimite,
  type Pagina,
} from "../lib/paginacion.js";
import { CODIGOS } from "../lib/errorCodes.js";
import { badRequest, notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { normalizarCodigo, siguienteCodigo } from "../lib/codigoDePieza.js";
import { slugify } from "../lib/slug.js";
import { toProductResponse } from "../mappers/productMapper.js";
import type { Product } from "../types.js";
import type { productSchema, updateProductSchema } from "../schemas.js";
import type { z } from "zod";

type ProductInput = z.infer<typeof productSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;

const productInclude = {
  category: {
    select: { slug: true },
  },
  images: {
    select: {
      url: true,
      position: true,
      isPrimary: true,
    },
    orderBy: { position: "asc" as const },
  },
  prices: {
    select: {
      amount: true,
      active: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  inventory: {
    select: { quantity: true },
  },
};

const PRODUCTOS_POR_PAGINA = 24;
const MAX_PRODUCTOS_POR_PAGINA = 100;

export async function listProducts(filters: {
  category?: string;
  search?: string;
  limit?: number;
  cursor?: number;
}): Promise<Pagina<Product>> {
  const category = filters.category ?? "";
  const search = filters.search?.trim() ?? "";
  const limite = resolverLimite(
    filters.limit,
    PRODUCTOS_POR_PAGINA,
    MAX_PRODUCTOS_POR_PAGINA
  );

  const products = await prisma.product.findMany({
    take: limite + 1,
    ...desdeElCursor(filters.cursor),
    where: {
      ...(category && category !== "todos"
        ? {
            category: {
              slug: category,
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
              // Por codigo: es lo que escribe un lector de codigo de barras,
              // que se comporta como un teclado.
              { sku: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: productInclude,
    orderBy: { id: "asc" },
  });

  return armarPagina(products, limite, toProductResponse);
}

export async function getProductBySlug(slug: string): Promise<Product> {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: productInclude,
  });

  if (!product) throw notFound("No encontramos ese producto.", CODIGOS.PRODUCTO_NO_ENCONTRADO);

  return toProductResponse(product);
}

/**
 * Codigo de la pieza. Si no viene cargado a mano, se genera uno correlativo
 * dentro de la categoria: con cien piezas, inventarlos de a uno es tedioso y
 * es donde se cuelan los repetidos.
 */
async function resolverCodigo(categoriaNombre: string, categoriaId: number, pedido?: string) {
  if (pedido?.trim()) return normalizarCodigo(pedido);

  const existentes = await prisma.product.findMany({
    where: { categoryId: categoriaId, sku: { not: null } },
    select: { sku: true },
  });

  return siguienteCodigo(
    categoriaNombre,
    existentes.map((p) => p.sku as string)
  );
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const slug = input.slug ?? slugify(input.name);
  const category = await prisma.category.findUnique({
    where: { slug: input.category },
  });

  if (!category) {
    throw badRequest("Esa categoria no existe.", CODIGOS.CATEGORIA_NO_ENCONTRADA);
  }

  const slugTaken = await prisma.product.findUnique({ where: { slug } });

  if (slugTaken) {
    throw badRequest("Ya hay un producto con ese enlace.", CODIGOS.SLUG_DUPLICADO);
  }

  const sku = await resolverCodigo(category.name, category.id, input.sku);

  const product = await prisma.product.create({
    data: {
      slug,
      sku,
      name: input.name,
      description: input.description,
      featured: input.featured,
      categoryId: category.id,
      images: {
        create: uniqueGalleryImages(input.imageUrl, input.galleryImages).map(
          (url, index) => ({
            url,
            alt: input.name,
            position: index,
            isPrimary: index === 0,
          })
        ),
      },
      prices: {
        create: {
          amount: input.price,
          currency: "ARS",
          active: true,
        },
      },
      inventory: {
        create: {
          quantity: input.stock,
        },
      },
    },
    include: productInclude,
  });

  return toProductResponse(product);
}

export async function updateProduct(
  id: number,
  input: UpdateProductInput
): Promise<Product> {
  const current = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { slug: true } },
      images: {
        select: { url: true, position: true, isPrimary: true },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!current) throw notFound("No encontramos ese producto.", CODIGOS.PRODUCTO_NO_ENCONTRADO);

  const nextCategorySlug = input.category ?? current.category.slug;
  const category = await prisma.category.findUnique({
    where: { slug: nextCategorySlug },
  });

  if (!category) {
    throw badRequest("Esa categoria no existe.", CODIGOS.CATEGORIA_NO_ENCONTRADA);
  }

  const nextSlug = input.slug ?? (input.name ? slugify(input.name) : current.slug);
  const slugTaken = await prisma.product.findFirst({
    where: {
      id: { not: id },
      slug: nextSlug,
    },
  });

  if (slugTaken) {
    throw badRequest("Ya hay un producto con ese enlace.", CODIGOS.SLUG_DUPLICADO);
  }

  const currentImages = current.images.map((image) => image.url);
  const nextPrimaryImage = input.imageUrl ?? currentImages[0] ?? "";
  const nextGalleryImages =
    input.galleryImages === undefined
      ? uniqueGalleryImages(nextPrimaryImage, currentImages)
      : uniqueGalleryImages(nextPrimaryImage, input.galleryImages);

  const product = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        slug: nextSlug,
        sku: input.sku !== undefined ? input.sku || null : undefined,
        name: input.name ?? current.name,
        description: input.description ?? current.description,
        featured: input.featured ?? current.featured,
        categoryId: category.id,
      },
    });

    if (input.imageUrl !== undefined || input.galleryImages !== undefined) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: nextGalleryImages.map((url, index) => ({
          productId: id,
          url,
          alt: input.name ?? current.name,
          position: index,
          isPrimary: index === 0,
        })),
      });
    }

    if (input.price !== undefined) {
      await tx.productPrice.updateMany({
        where: { productId: id, active: true },
        data: { active: false },
      });
      await tx.productPrice.create({
        data: {
          productId: id,
          amount: input.price,
          currency: "ARS",
          active: true,
        },
      });
    }

    if (input.stock !== undefined) {
      await tx.inventory.upsert({
        where: { productId: id },
        create: {
          productId: id,
          quantity: input.stock,
        },
        update: {
          quantity: input.stock,
        },
      });
    }

    return tx.product.findUniqueOrThrow({
      where: { id },
      include: productInclude,
    });
  });

  return toProductResponse(product);
}

export async function deleteProduct(id: number) {
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) throw notFound("No encontramos ese producto.", CODIGOS.PRODUCTO_NO_ENCONTRADO);

  await prisma.product.delete({ where: { id } });
}

function uniqueGalleryImages(imageUrl: string, galleryImages: string[]) {
  return Array.from(new Set([imageUrl, ...galleryImages].filter(Boolean)));
}
