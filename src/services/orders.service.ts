import { quoteCorreoArgentino } from "../lib/correoArgentino.js";
import { badRequest, notFound } from "../lib/http.js";
import { toMoney } from "../lib/money.js";
import { prisma } from "../lib/prisma.js";
import { notifyOrderPaid } from "./notifications.service.js";
import { priceItems } from "./pricing.service.js";
import { getStoreSettings } from "./settings.service.js";
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

const DEFAULT_ORDER_PAGE_SIZE = 50;
const MAX_ORDER_PAGE_SIZE = 200;

// El listado no incluye eventos: crecen con cada cambio de estado y solo
// se miran al abrir el detalle, que se pide aparte.
const orderListInclude = {
  items: {
    orderBy: { id: "asc" as const },
  },
};

export async function listOrders(options: { limit?: number; cursor?: number } = {}) {
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_ORDER_PAGE_SIZE, 1),
    MAX_ORDER_PAGE_SIZE
  );

  const orders = await prisma.order.findMany({
    include: orderListInclude,
    orderBy: { id: "desc" },
    take: limit + 1,
    ...(options.cursor
      ? { cursor: { id: options.cursor }, skip: 1 }
      : {}),
  });

  const hasMore = orders.length > limit;
  const page = hasMore ? orders.slice(0, limit) : orders;

  return {
    items: page.map((order) => toOrderResponse({ ...order, events: [] })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/**
 * Los totales del panel salen de la base, no de sumar el listado: asi
 * siguen siendo correctos aunque el listado venga paginado.
 */
export async function getOrderStats() {
  const [aggregate, byStatus] = await Promise.all([
    prisma.order.aggregate({
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {
    pending: 0,
    paid: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };

  for (const row of byStatus) {
    statusCounts[row.status] = row._count._all;
  }

  return {
    totalOrders: aggregate._count._all,
    totalRevenue: Number(aggregate._sum.totalAmount?.toString() ?? 0),
    statusCounts,
  };
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
  const settings = await getStoreSettings();

  const order = await prisma.$transaction(async (tx) => {
    const { items, subtotal } = await priceItems(tx, input.items, {
      checkStock: true,
    });

    for (const item of items) {
      // El chequeo de priceItems es optimista: entre ese SELECT y este UPDATE
      // otra compra puede llevarse la ultima pieza. Descontar con la condicion
      // adentro del UPDATE hace que Postgres bloquee la fila y reevalue el
      // stock ya commiteado, asi que dos compras simultaneas no pueden vender
      // la misma unidad.
      const descontado = await tx.inventory.updateMany({
        where: {
          productId: item.productId,
          quantity: { gte: item.quantity },
        },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });

      if (descontado.count === 0) {
        throw badRequest(`Insufficient stock for ${item.name}`);
      }
    }

    const quote = quoteCorreoArgentino(
      {
        postalCode: input.shippingPostalCode,
        address: input.shippingAddress,
        city: input.shippingCity,
        province: input.shippingCountry,
        subtotal,
      },
      settings.shipping
    );
    const shippingCost = quote.cost;
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
        shippingProvider: quote.provider,
        shippingService: quote.service,
        shippingCost: toMoney(shippingCost),
        shippingEta: quote.eta,
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
  let becamePaid = false;

  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!current) throw notFound("Order not found");

    // Solo la transicion a pagado, no cada guardado: remarcar "Pagado" no
    // tiene que reenviar el comprobante.
    becamePaid = input.status === "paid" && current.status !== "paid";

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

      // Si la plata ya entro, cancelar no la devuelve: eso se hace a mano en
      // Mercado Pago. Queda asentado en el pedido para que no se pase por alto
      // y la clienta no se quede sin joya y sin plata.
      if (current.paidAt || current.paymentStatus === "approved") {
        await addOrderEvent(
          tx,
          id,
          "status_changed",
          current.paymentId
            ? `Este pedido estaba pagado. La devolucion NO es automatica: hay que hacerla en Mercado Pago sobre el pago ${current.paymentId}.`
            : "Este pedido estaba pagado. La devolucion NO es automatica: hay que hacerla en Mercado Pago."
        );
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

  const response = toOrderResponse(order);

  if (becamePaid) {
    // Despues de commitear y sin bloquear la respuesta: un mail que falla no
    // puede voltear el cambio de estado.
    void sendPaidReceipt(response);
  }

  return response;
}

async function sendPaidReceipt(order: Order) {
  try {
    const settings = await getStoreSettings();
    const sent = await notifyOrderPaid(order, settings);

    await addOrderEvent(
      prisma,
      order.id,
      "status_changed",
      sent
        ? `Comprobante enviado a ${order.customerEmail}`
        : "No se pudo enviar el comprobante por mail"
    );
  } catch (error) {
    console.error(
      `Fallo el comprobante del pedido ${order.orderNumber}`,
      error
    );
  }
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
  // Secuencia de Postgres: entrega numeros unicos aunque entren dos pedidos
  // a la vez. Puede dejar huecos si una transaccion se cae, y esta bien.
  const rows = await tx.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('order_number_seq') AS value
  `;

  return `JOL-${String(rows[0].value).padStart(5, "0")}`;
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
  tx: PrismaTransaction | typeof prisma,
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
