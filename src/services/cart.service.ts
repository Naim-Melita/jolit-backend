import { badRequest, notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { toCartResponse } from "../mappers/cartMapper.js";
import { getCustomerByClerkUserId } from "./customers.service.js";

const cartInclude = {
  items: {
    orderBy: { id: "asc" as const },
    include: {
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
    },
  },
};

export async function getCart(clerkUserId: string) {
  const cart = await getOrCreateCart(clerkUserId);
  return toCartResponse(cart);
}

export async function addCartItem(
  clerkUserId: string,
  productId: number,
  quantity: number
) {
  if (quantity <= 0) {
    throw badRequest("Quantity must be greater than zero");
  }

  const cart = await getOrCreateCart(clerkUserId);
  await assertProductStock(productId, quantity);

  await prisma.cartItem.upsert({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId,
      },
    },
    create: {
      cartId: cart.id,
      productId,
      quantity,
    },
    update: {
      quantity: {
        increment: quantity,
      },
    },
  });

  return getCart(clerkUserId);
}

export async function updateCartItem(
  clerkUserId: string,
  productId: number,
  quantity: number
) {
  if (quantity <= 0) {
    throw badRequest("Quantity must be greater than zero");
  }

  const cart = await getOrCreateCart(clerkUserId);
  await assertProductStock(productId, quantity);

  const updated = await prisma.cartItem.updateMany({
    where: {
      cartId: cart.id,
      productId,
    },
    data: { quantity },
  });

  if (updated.count === 0) {
    throw notFound("Cart item not found");
  }

  return getCart(clerkUserId);
}

export async function removeCartItem(clerkUserId: string, productId: number) {
  const cart = await getOrCreateCart(clerkUserId);

  await prisma.cartItem.deleteMany({
    where: {
      cartId: cart.id,
      productId,
    },
  });

  return getCart(clerkUserId);
}

export async function clearCart(clerkUserId: string) {
  const cart = await getOrCreateCart(clerkUserId);

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  return getCart(clerkUserId);
}

async function getOrCreateCart(clerkUserId: string) {
  const customer = await getCustomerByClerkUserId(clerkUserId);

  if (!customer) {
    throw badRequest("Customer profile is required before using cart");
  }

  const existing = await prisma.cart.findFirst({
    where: { customerId: customer.id },
    include: cartInclude,
    orderBy: { createdAt: "desc" },
  });

  if (existing) return existing;

  return prisma.cart.create({
    data: {
      customerId: customer.id,
    },
    include: cartInclude,
  });
}

async function assertProductStock(productId: number, quantity: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { inventory: true },
  });

  if (!product) throw notFound("Product not found");

  if ((product.inventory?.quantity ?? 0) < quantity) {
    throw badRequest(`Insufficient stock for ${product.name}`);
  }
}
