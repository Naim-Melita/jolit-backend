import { toMoney } from "../lib/money.js";
import type { Order, OrderStatus } from "../types.js";

type OrderWithRelations = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountry: string;
  shippingProvider: string;
  shippingService: string;
  shippingCost: { toString(): string };
  shippingEta: string;
  shippingTrackingNumber: string;
  shippingTrackingUrl: string;
  status: OrderStatus;
  subtotalAmount: { toString(): string };
  totalAmount: { toString(): string };
  items: Array<{
    productId: number | null;
    slug: string;
    name: string;
    price: { toString(): string };
    quantity: number;
    subtotal: { toString(): string };
  }>;
  events: Array<{
    id: number;
    type: "created" | "status_changed" | "shipping_updated";
    message: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

export function toOrderResponse(order: OrderWithRelations): Order {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    shippingPostalCode: order.shippingPostalCode,
    shippingCountry: order.shippingCountry,
    shippingProvider: order.shippingProvider,
    shippingService: order.shippingService,
    shippingCost: toMoney(order.shippingCost),
    shippingEta: order.shippingEta,
    shippingTrackingNumber: order.shippingTrackingNumber,
    shippingTrackingUrl: order.shippingTrackingUrl,
    status: order.status,
    subtotalAmount: toMoney(order.subtotalAmount),
    totalAmount: toMoney(order.totalAmount),
    items: order.items.map((item) => ({
      productId: item.productId ?? 0,
      slug: item.slug,
      name: item.name,
      price: toMoney(item.price),
      quantity: item.quantity,
      subtotal: toMoney(item.subtotal),
    })),
    events: order.events.map((event) => ({
      id: event.id,
      type: event.type,
      message: event.message,
      createdAt: event.createdAt.toISOString(),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function toPublicOrderLookupResponse(order: OrderWithRelations) {
  const response = toOrderResponse(order);

  return {
    id: response.id,
    orderNumber: response.orderNumber,
    status: response.status,
    shippingProvider: response.shippingProvider,
    shippingService: response.shippingService,
    shippingCost: response.shippingCost,
    shippingEta: response.shippingEta,
    shippingTrackingNumber: response.shippingTrackingNumber,
    shippingTrackingUrl: response.shippingTrackingUrl,
    subtotalAmount: response.subtotalAmount,
    totalAmount: response.totalAmount,
    items: response.items,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}
