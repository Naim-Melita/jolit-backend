import { Router } from "express";
import { requireAdmin } from "../lib/adminAuth.js";
import { badRequest, notFound } from "../lib/http.js";
import { nextId, readDb, toMoney, writeDb } from "../lib/store.js";
import {
  orderLookupSchema,
  orderSchema,
  orderShippingSchema,
  orderStatusSchema,
} from "../schemas.js";
import type { OrderItem } from "../types.js";

export const ordersRouter = Router();

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeOrderNumber(value: string) {
  return value.trim().toUpperCase();
}

function hydrateOrder(order: any) {
  order.shippingProvider ??= "Correo Argentino";
  order.shippingService ??= "PAQ.AR";
  order.shippingCost ??= "0.00";
  order.shippingEta ??= "";
  order.shippingTrackingNumber ??= "";
  order.shippingTrackingUrl ??= "";
  order.subtotalAmount ??= order.totalAmount;
  order.events ??= [];
  return order;
}

function nextEventId(order: { events?: Array<{ id: number }> }) {
  return !order.events || order.events.length === 0
    ? 1
    : Math.max(...order.events.map((event) => event.id)) + 1;
}

function addOrderEvent(
  order: any,
  type: "created" | "status_changed" | "shipping_updated",
  message: string
) {
  hydrateOrder(order);
  order.events.push({
    id: nextEventId(order),
    type,
    message,
    createdAt: new Date().toISOString(),
  });
}

ordersRouter.get("/", requireAdmin, (_req, res) => {
  const db = readDb();
  res.json(db.orders.map(hydrateOrder));
});

ordersRouter.post("/lookup", (req, res) => {
  const input = orderLookupSchema.parse(req.body);
  const db = readDb();
  const orderNumber = normalizeOrderNumber(input.orderNumber);
  const contact = input.contact.trim().toLowerCase();
  const contactPhone = normalizePhone(input.contact);

  const order = db.orders.find((item) => {
    const matchesOrderNumber = item.orderNumber.toUpperCase() === orderNumber;
    const matchesEmail = item.customerEmail.toLowerCase() === contact;
    const matchesPhone =
      contactPhone.length >= 6 &&
      normalizePhone(item.customerPhone).endsWith(contactPhone);

    return matchesOrderNumber && (matchesEmail || matchesPhone);
  });

  if (!order) throw notFound("Order not found");
  hydrateOrder(order);

  res.json({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    shippingProvider: order.shippingProvider,
    shippingService: order.shippingService,
    shippingCost: order.shippingCost,
    shippingEta: order.shippingEta,
    shippingTrackingNumber: order.shippingTrackingNumber,
    shippingTrackingUrl: order.shippingTrackingUrl,
    subtotalAmount: order.subtotalAmount,
    totalAmount: order.totalAmount,
    items: order.items,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  });
});

ordersRouter.get("/:id", requireAdmin, (req, res) => {
  const db = readDb();
  const order = db.orders.find((item) => item.id === Number(req.params.id));

  if (!order) throw notFound("Order not found");
  hydrateOrder(order);

  res.json(order);
});

ordersRouter.post("/", (req, res) => {
  const input = orderSchema.parse(req.body);
  const db = readDb();
  const items: OrderItem[] = [];
  let total = 0;

  for (const item of input.items) {
    const product = db.products.find((candidate) => candidate.id === item.productId);

    if (!product) throw badRequest(`Product ${item.productId} does not exist`);
    if (product.stock < item.quantity) {
      throw badRequest(`Insufficient stock for ${product.name}`);
    }

    const subtotal = Number(product.price) * item.quantity;
    total += subtotal;

    items.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      subtotal: toMoney(subtotal),
    });
  }

  for (const item of items) {
    const product = db.products.find((candidate) => candidate.id === item.productId);
    if (product) product.stock -= item.quantity;
  }

  const shippingCost = input.shipping?.cost ?? 0;
  const totalAmount = total + shippingCost;
  const now = new Date().toISOString();
  const id = nextId(db.orders);
  const order = {
    id,
    orderNumber: `JOL-${String(id).padStart(5, "0")}`,
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
    shippingTrackingNumber: "",
    shippingTrackingUrl: "",
    status: "pending" as const,
    subtotalAmount: toMoney(total),
    totalAmount: toMoney(totalAmount),
    items,
    events: [],
    createdAt: now,
    updatedAt: now,
  };
  addOrderEvent(order, "created", "Pedido creado desde checkout");

  db.orders.push(order);
  writeDb(db);
  res.status(201).json(order);
});

ordersRouter.patch("/:id/status", requireAdmin, (req, res) => {
  const input = orderStatusSchema.parse(req.body);
  const db = readDb();
  const order = db.orders.find((item) => item.id === Number(req.params.id));

  if (!order) throw notFound("Order not found");
  hydrateOrder(order);

  if (input.status === "cancelled" && order.status !== "cancelled") {
    for (const item of order.items) {
      const product = db.products.find(
        (candidate) => candidate.id === item.productId
      );
      if (product) product.stock += item.quantity;
    }
    addOrderEvent(order, "status_changed", "Stock restaurado por cancelacion");
  }

  order.status = input.status;
  order.updatedAt = new Date().toISOString();
  addOrderEvent(order, "status_changed", `Estado actualizado a ${input.status}`);

  writeDb(db);
  res.json(order);
});

ordersRouter.patch("/:id/shipping", requireAdmin, (req, res) => {
  const input = orderShippingSchema.parse(req.body);
  const db = readDb();
  const order = db.orders.find((item) => item.id === Number(req.params.id));

  if (!order) throw notFound("Order not found");
  hydrateOrder(order);

  order.shippingTrackingNumber =
    input.shippingTrackingNumber ?? order.shippingTrackingNumber;
  order.shippingTrackingUrl = input.shippingTrackingUrl ?? order.shippingTrackingUrl;
  order.shippingProvider = input.shippingProvider ?? order.shippingProvider;
  order.shippingService = input.shippingService ?? order.shippingService;
  order.shippingEta = input.shippingEta ?? order.shippingEta;
  if (input.shippingCost !== undefined) {
    order.shippingCost = toMoney(input.shippingCost);
    order.totalAmount = toMoney(Number(order.subtotalAmount) + input.shippingCost);
  }
  order.updatedAt = new Date().toISOString();
  addOrderEvent(order, "shipping_updated", "Datos de envio actualizados");

  writeDb(db);
  res.json(order);
});
