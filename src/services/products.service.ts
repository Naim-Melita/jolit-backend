import { badRequest, notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
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

export async function listProducts(filters: {
  category?: string;
  search?: string;
}): Promise<Product[]> {
  const category = filters.category ?? "";
  const search = filters.search?.trim() ?? "";

  const products = await prisma.product.findMany({
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
            ],
          }
        : {}),
    },
    include: productInclude,
    orderBy: { id: "asc" },
  });

  return products.map(toProductResponse);
}

export async function getProductBySlug(slug: string): Promise<Product> {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: productInclude,
  });

  if (!product) throw notFound("Product not found");

  return toProductResponse(product);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const slug = input.slug ?? slugify(input.name);
  const category = await prisma.category.findUnique({
    where: { slug: input.category },
  });

  if (!category) {
    throw badRequest("Category does not exist");
  }

  const slugTaken = await prisma.product.findUnique({ where: { slug } });

  if (slugTaken) {
    throw badRequest("Product slug already exists");
  }

  const product = await prisma.product.create({
    data: {
      slug,
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

  if (!current) throw notFound("Product not found");

  const nextCategorySlug = input.category ?? current.category.slug;
  const category = await prisma.category.findUnique({
    where: { slug: nextCategorySlug },
  });

  if (!category) {
    throw badRequest("Category does not exist");
  }

  const nextSlug = input.slug ?? (input.name ? slugify(input.name) : current.slug);
  const slugTaken = await prisma.product.findFirst({
    where: {
      id: { not: id },
      slug: nextSlug,
    },
  });

  if (slugTaken) {
    throw badRequest("Product slug already exists");
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

  if (!product) throw notFound("Product not found");

  await prisma.product.delete({ where: { id } });
}

function uniqueGalleryImages(imageUrl: string, galleryImages: string[]) {
  return Array.from(new Set([imageUrl, ...galleryImages].filter(Boolean)));
}
