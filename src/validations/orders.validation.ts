import { z } from "zod";

export const orderItemsSchema = z
  .array(
    z.object({
      productId: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().positive().max(50),
    })
  )
  .min(1)
  .max(50);

export const orderSchema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(6),
  shippingAddress: z.string().optional().default(""),
  shippingCity: z.string().optional().default(""),
  shippingPostalCode: z.string().optional().default(""),
  shippingCountry: z.string().optional().default("Argentina"),
  // El costo de envio NO se acepta del cliente: se cotiza en el servidor
  // a partir del destino y del subtotal calculado desde la base.
  items: orderItemsSchema,
});

export const orderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "paid",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ]),
});

export const orderShippingSchema = z.object({
  shippingTrackingNumber: z.string().optional().default(""),
  shippingTrackingUrl: z.string().optional().default(""),
  shippingProvider: z.string().optional(),
  shippingService: z.string().optional(),
  shippingEta: z.string().optional(),
  shippingCost: z.coerce.number().min(0).optional(),
});

export const orderLookupSchema = z.object({
  orderNumber: z.string().min(3),
  contact: z.string().min(3),
});
