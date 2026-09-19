import { armarPagina, resolverLimite, type Pagina } from "../lib/paginacion.js";
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

type Filtros = { category?: string; search?: string };

/** Las dos tandas en las que se parte el catalogo. */
type Tanda = "con" | "sin";

/**
 * Condiciones de busqueda para una tanda.
 *
 * Todo va bajo un AND porque la busqueda por texto ya usa un OR: dos OR al
 * mismo nivel se pisan y la categoria dejaria de filtrar.
 */
function dondeBuscar(filtros: Filtros, tanda: Tanda) {
  const category = filtros.category ?? "";
  const search = filtros.search?.trim() ?? "";
  const condiciones = [];

  if (category && category !== "todos") {
    condiciones.push({ category: { slug: category } });
  }

  if (search) {
    condiciones.push({
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
        // Por codigo: es lo que escribe un lector de codigo de barras,
        // que se comporta como un teclado.
        { sku: { contains: search, mode: "insensitive" as const } },
      ],
    });
  }

  condiciones.push(
    tanda === "con"
      ? { inventory: { quantity: { gt: 0 } } }
      : // Una pieza sin fila de inventario tambien esta agotada.
        {
          OR: [
            { inventory: { is: null } },
            { inventory: { quantity: { lte: 0 } } },
          ],
        }
  );

  return { AND: condiciones };
}

/**
 * Una tanda de productos a partir del cursor.
 *
 * Se filtra por `id > cursor` en vez de usar el cursor de Prisma porque asi
 * sigue funcionando si la pieza del cursor se vendio y se borro mientras la
 * clienta miraba: Prisma necesita que esa fila exista para anclarse.
 */
function buscarTanda(
  filtros: Filtros,
  tanda: Tanda,
  cuantos: number,
  cursor?: number
) {
  if (cuantos <= 0) return Promise.resolve([]);

  const where = dondeBuscar(filtros, tanda);

  return prisma.product.findMany({
    take: cuantos,
    where: cursor ? { ...where, id: { gt: cursor } } : where,
    include: productInclude,
    orderBy: { id: "asc" },
  });
}

/**
 * En que tanda quedo la ultima pieza de la pagina anterior.
 *
 * Si ese producto ya no existe se vuelve a la primera tanda: puede repetir
 * alguna agotada, pero nunca saltea algo que se puede comprar.
 */
async function tandaDelCursor(cursor?: number): Promise<Tanda> {
  if (!cursor) return "con";

  const producto = await prisma.product.findUnique({
    where: { id: cursor },
    select: { inventory: { select: { quantity: true } } },
  });

  if (!producto) return "con";

  return (producto.inventory?.quantity ?? 0) > 0 ? "con" : "sin";
}

/**
 * El catalogo, con las piezas agotadas al final.
 *
 * Son piezas unicas: a medida que se venden, el catalogo se iba llenando de
 * casilleros grises entre medio de lo que si se puede comprar, y en la primera
 * pagina quedaban para siempre. Se siguen mostrando âsirven para ver el
 * trabajo y varias se reponenâ pero despues de todo lo disponible.
 *
 * Va en dos tandas y no en un ORDER BY porque Prisma no sabe ordenar por
 * "quantity > 0": ordenar por quantity a secas pondria primero lo que mas
 * stock tiene, que no es lo que se quiere.
 */
export async function listProducts(filters: {
  category?: string;
  search?: string;
  limit?: number;
  cursor?: number;
}): Promise<Pagina<Product>> {
  const limite = resolverLimite(
    filters.limit,
    PRODUCTOS_POR_PAGINA,
    MAX_PRODUCTOS_POR_PAGINA
  );

  // Se pide una fila de mas para saber si hay pagina siguiente.
  const aPedir = limite + 1;
  const tanda = await tandaDelCursor(filters.cursor);
  const filas = [];

  if (tanda === "con") {
    filas.push(...(await buscarTanda(filters, "con", aPedir, filters.cursor)));
  }

  // Si lo disponible no llego a llenar la pagina, se completa con agotadas.
  if (filas.length < aPedir) {
    filas.push(
      ...(await buscarTanda(
        filters,
        "sin",
        aPedir - filas.length,
        tanda === "sin" ? filters.cursor : undefined
      ))
    );
  }

  return armarPagina(filas, limite, toProductResponse);
}

/**
 * Como se nombra un producto en la API.
 *
 * La tienda lo leia por enlace (`/api/products/aros-perla`) y el panel lo
 * editaba por numero (`PATCH /api/products/4`): quien leia un producto no
 * podia editarlo con lo que acababa de recibir. Ahora las tres rutas aceptan
 * las dos formas.
 *
 * Todo digitos es un id, el resto es un enlace. Por eso un enlace no puede ser
 * solo numeros: gana el id. Con nombres de joyas no pasa, y el nombre ya pide
 * al menos dos letras.
 */
/** Escrito a mano: inferido, TypeScript arma una union con campos opcionales
 * y `donde.id` pasa a ser `number | undefined`. */
type ComoBuscarlo = { id: number } | { slug: string };

function comoBuscarlo(identificador: string): ComoBuscarlo {
  const texto = identificador.trim();

  return /^\d+$/.test(texto) ? { id: Number(texto) } : { slug: texto };
}

/** El id del producto, venga como numero o como enlace. */
export async function resolverProducto(identificador: string) {
  const donde = comoBuscarlo(identificador);

  if ("id" in donde) return donde.id;

  const product = await prisma.product.findUnique({
    where: donde,
    select: { id: true },
  });

  if (!product) {
    throw notFound("No encontramos ese producto.", CODIGOS.PRODUCTO_NO_ENCONTRADO);
  }

  return product.id;
}

export async function getProduct(identificador: string): Promise<Product> {
  const product = await prisma.product.findUnique({
    where: comoBuscarlo(identificador),
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
