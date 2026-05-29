import { badRequest, notFound } from "../lib/http.js";
import { toMoney } from "../lib/money.js";
import { prisma } from "../lib/prisma.js";
import {
  toOrderResponse,
  toPublicOrderLookupResponse,
} from "../mappers/orderMapper.js";
import type {
  orderLookupSchema,
  orderSchema,
  orderShippingSchema,
  orderStatusSchema,
} from "../schemas.js";
import type { Order } from "../types.js";
import type { z } from "zod";

type OrderInput = z.infer<typeof orderSchema>;
type OrderLookupInput = z.infer<typeof orderLookupSchema>;
type OrderStatusInput = z.infer<typeof orderStatusSchema>;
type OrderShippingInput = z.infer<typeof orderShippingSchema>;

const orderInclude = {
  items: {
    orderBy: { id: "asc" as const },
  },
  events: {
    orderBy: { createdAt: "asc" as const },
  },
};

export async function listOrders(): Promise<Order[]> {
  const orders = await prisma.order.findMany({
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });

  return orders.map(toOrderResponse);
}

export async function getOrderById(id: number): Promise<Order> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });

  if (!order) throw notFound("Order not found");

  return toOrderResponse(order);
}

export async function listOrdersByClerkUserId(clerkUserId: string): Promise<Order[]> {
  const orders = await prisma.order.findMany({
    where: {
      customer: {
        clerkUserId,
      },
    },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });

  return orders.map(toOrderResponse);
}

export async function getOrderByIdForClerkUser(
  clerkUserId: string,
  id: number
): Promise<Order> {
  const order = await prisma.order.findFirst({
    where: {
      id,
      customer: {
        clerkUserId,
      },
    },
    include: orderInclude,
  });

  if (!order) throw notFound("Order not found");

  return toOrderResponse(order);
}

export async function lookupOrder(input: OrderLookupInput) {
  const orderNumber = normalizeOrderNumber(input.orderNumber);
  const contact = input.contact.trim().toLowerCase();
  const contactPhone = normalizePhone(input.contact);

  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      OR: [
        { customerEmail: { equals: contact, mode: "insensitive" } },
        ...(contactPhone.length >= 6
          ? [{ customerPhone: { endsWith: contactPhone } }]
          : []),
      ],
    },
    include: orderInclude,
  });

  if (!order) throw notFound("Order not found");

  return toPublicOrderLookupResponse(order);
}

export async function createOrder(
  input: OrderInput,
  options: { clerkUserId?: string | null } = {}
): Promise<Order> {
  const order = await prisma.$transaction(async (tx) => {
    const items = [];
    let subtotal = 0;

    for (const item of input.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: {
          inventory: true,
          prices: {
            where: { active: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!product) {
        throw badRequest(`Product ${item.productId} does not exist`);
      }

      const stock = product.inventory?.quantity ?? 0;
      if (stock < item.quantity) {
        throw badRequest(`Insufficient stock for ${product.name}`);
      }

      const activePrice = product.prices[0];
      if (!activePrice) {
        throw badRequest(`Product ${product.name} does not have an active price`);
      }

      const price = Number(activePrice.amount.toString());
      const itemSubtotal = price * item.quantity;
      subtotal += itemSubtotal;

      items.push({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: toMoney(price),
        quantity: item.quantity,
        subtotal: toMoney(itemSubtotal),
      });
    }

    for (const item of items) {
      await tx.inventory.update({
        where: { productId: item.productId },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });
    }

    const shippingCost = input.shipping?.cost ?? 0;
    const totalAmount = subtotal + shippingCost;
    const customer = await upsertCustomerForOrder(tx, input, options.clerkUserId);
    const nextOrderNumber = await buildNextOrderNumber(tx);

    const created = await tx.order.create({
      data: {
        orderNumber: nextOrderNumber,
        customerId: customer.id,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        shippingAddress: input.shippingAddress,
        shippingCity: input.shippingCity,
        shippingPostalCode: input.shippingPostalCode,
        shippingCountry: input.shippingCountry,
        shippingProvider: input.shipping?.provider ?? "Correo Argentino",
        shippingService: input.shipping?.service ?? "PAQ.AR",
        shippingCost: toMoney(shippingCost),
        shippingEta: input.shipping?.eta ?? "",
        status: "pending",
        subtotalAmount: toMoney(subtotal),
        totalAmount: toMoney(totalAmount),
        items: {
          create: items,
        },
        events: {
          create: {
            type: "created",
            message: "Pedido creado desde checkout",
          },
        },
      },
      include: orderInclude,
    });

    if (options.clerkUserId) {
      await tx.cartItem.deleteMany({
        where: {
          cart: {
            customerId: customer.id,
          },
        },
      });
    }

    return created;
  });

  return toOrderResponse(order);
}

export async function updateOrderStatus(
  id: number,
  input: OrderStatusInput
): Promise<Order> {
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!current) throw notFound("Order not found");

    if (input.status === "cancelled" && current.status !== "cancelled") {
      for (const item of current.items) {
        if (!item.productId) continue;

        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            quantity: {
              increment: item.quantity,
            },
          },
        });
      }

      await addOrderEvent(
        tx,
        id,
        "status_changed",
        "Stock restaurado por cancelacion"
      );
    }

    await tx.order.update({
      where: { id },
      data: {
        status: input.status,
      },
    });

    await addOrderEvent(
      tx,
      id,
      "status_changed",
      `Estado actualizado a ${input.status}`
    );

    return tx.order.findUniqueOrThrow({
      where: { id },
      include: orderInclude,
    });
  });

  return toOrderResponse(order);
}

export async function updateOrderShipping(
  id: number,
  input: OrderShippingInput
): Promise<Order> {
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id } });

    if (!current) throw notFound("Order not found");

    const shippingCost =
      input.shippingCost === undefined
        ? current.shippingCost
        : toMoney(input.shippingCost);
    const totalAmount =
      input.shippingCost === undefined
        ? current.totalAmount
        : toMoney(Number(current.subtotalAmount.toString()) + input.shippingCost);

    await tx.order.update({
      where: { id },
      data: {
        shippingTrackingNumber:
          input.shippingTrackingNumber ?? current.shippingTrackingNumber,
        shippingTrackingUrl:
          input.shippingTrackingUrl ?? current.shippingTrackingUrl,
        shippingProvider: input.shippingProvider ?? current.shippingProvider,
        shippingService: input.shippingService ?? current.shippingService,
        shippingEta: input.shippingEta ?? current.shippingEta,
        shippingCost,
        totalAmount,
      },
    });

    await addOrderEvent(tx, id, "shipping_updated", "Datos de envio actualizados");

    return tx.order.findUniqueOrThrow({
      where: { id },
      include: orderInclude,
    });
  });

  return toOrderResponse(order);
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeOrderNumber(value: string) {
  return value.trim().toUpperCase();
}

async function buildNextOrderNumber(tx: PrismaTransaction) {
  const result = await tx.order.aggregate({
    _max: { id: true },
  });
  const nextId = (result._max.id ?? 0) + 1;

  return `JOL-${String(nextId).padStart(5, "0")}`;
}

async function upsertCustomerForOrder(
  tx: PrismaTransaction,
  input: OrderInput,
  clerkUserId?: string | null
) {
  if (clerkUserId) {
    const existingByClerk = await tx.customer.findUnique({
      where: { clerkUserId },
    });

    if (existingByClerk) {
      return tx.customer.update({
        where: { id: existingByClerk.id },
        data: {
          email: input.customerEmail,
          name: input.customerName,
          phone: input.customerPhone,
        },
      });
    }

    const existingByEmail = await tx.customer.findUnique({
      where: { email: input.customerEmail },
    });

    if (existingByEmail) {
      return tx.customer.update({
        where: { id: existingByEmail.id },
        data: {
          clerkUserId,
          name: input.customerName,
          phone: input.customerPhone,
        },
      });
    }

    return tx.customer.create({
      data: {
        clerkUserId,
        name: input.customerName,
        email: input.customerEmail,
        phone: input.customerPhone,
      },
    });
  }

  return tx.customer.upsert({
    where: { email: input.customerEmail },
    create: {
      name: input.customerName,
      email: input.customerEmail,
      phone: input.customerPhone,
    },
    update: {
      name: input.customerName,
      phone: input.customerPhone,
    },
  });
}

async function addOrderEvent(
  tx: PrismaTransaction,
  orderId: number,
  type: "created" | "status_changed" | "shipping_updated",
  message: string
) {
  await tx.orderEvent.create({
    data: {
      orderId,
      type,
      message,
    },
  });
}

type PrismaTransaction = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];
