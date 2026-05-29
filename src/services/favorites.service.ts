import { badRequest, notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { toProductResponse } from "../mappers/productMapper.js";
import { getCustomerByClerkUserId } from "./customers.service.js";

const favoriteProductInclude = {
  product: {
    include: {
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
    },
  },
};

export async function listFavorites(clerkUserId: string) {
  const customer = await getCustomerByClerkUserId(clerkUserId);

  if (!customer) return [];

  const favorites = await prisma.favorite.findMany({
    where: { customerId: customer.id },
    include: favoriteProductInclude,
    orderBy: { createdAt: "desc" },
  });

  return favorites.map((favorite) => toProductResponse(favorite.product));
}

export async function addFavorite(clerkUserId: string, productId: number) {
  const customer = await getCustomerByClerkUserId(clerkUserId);

  if (!customer) {
    throw badRequest("Customer profile is required before adding favorites");
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) throw notFound("Product not found");

  await prisma.favorite.upsert({
    where: {
      customerId_productId: {
        customerId: customer.id,
        productId,
      },
    },
    create: {
      customerId: customer.id,
      productId,
    },
    update: {},
  });

  return listFavorites(clerkUserId);
}

export async function removeFavorite(clerkUserId: string, productId: number) {
  const customer = await getCustomerByClerkUserId(clerkUserId);

  if (!customer) return;

  await prisma.favorite.deleteMany({
    where: {
      customerId: customer.id,
      productId,
    },
  });
}
