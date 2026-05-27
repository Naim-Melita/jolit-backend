import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
});

export const productSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
  description: z.string().min(1),
  price: z.coerce.number().positive(),
  stock: z.coerce.number().int().min(0),
  imageUrl: z.string().url(),
  galleryImages: z.array(z.string().url()).optional().default([]),
  category: z.string().min(2),
  featured: z.coerce.boolean().optional().default(false),
});

export const updateProductSchema = productSchema.partial();

export const orderSchema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(6),
  shippingAddress: z.string().optional().default(""),
  shippingCity: z.string().optional().default(""),
  shippingPostalCode: z.string().optional().default(""),
  shippingCountry: z.string().optional().default("Argentina"),
  shipping: z
    .object({
      provider: z.string().default("Correo Argentino"),
      service: z.string().default("PAQ.AR"),
      cost: z.coerce.number().min(0),
      eta: z.string().default(""),
    })
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().positive(),
      })
    )
    .min(1),
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

export const settingsSchema = z.object({
  storeName: z.string().min(2),
  whatsappNumber: z.string().min(8),
  shipping: z
    .object({
      provider: z.string().min(2).default("Correo Argentino"),
      service: z.string().min(2).default("PAQ.AR"),
      freeShippingMinimum: z.coerce.number().min(0).default(100000),
      cabaRate: z.coerce.number().min(0).default(2500),
      gbaRate: z.coerce.number().min(0).default(3500),
      interiorRate: z.coerce.number().min(0).default(5500),
    })
    .optional()
    .default({
      provider: "Correo Argentino",
      service: "PAQ.AR",
      freeShippingMinimum: 100000,
      cabaRate: 2500,
      gbaRate: 3500,
      interiorRate: 5500,
    }),
  promoBanner: z.object({
    enabled: z.coerce.boolean(),
    title: z.string().max(80).default(""),
    message: z.string().max(180).default(""),
    ctaLabel: z.string().max(40).default(""),
    ctaUrl: z.string().default(""),
    startsAt: z.string().optional().default(""),
    endsAt: z.string().optional().default(""),
  }),
});

export const shippingQuoteSchema = z
  .object({
    postalCode: z.string().optional().default(""),
    address: z.string().optional().default(""),
    city: z.string().optional().default(""),
    province: z.string().optional().default(""),
    subtotal: z.coerce.number().min(0).default(0),
    quantity: z.coerce.number().int().positive().default(1),
  })
  .refine(
    (input) =>
      input.postalCode.trim().length >= 4 ||
      input.address.trim().length >= 4 ||
      input.city.trim().length >= 2,
    {
      message: "Postal code or address is required",
      path: ["postalCode"],
    }
  );

export const adminPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[a-zA-Z]/, "Password must contain letters")
    .regex(/[0-9]/, "Password must contain numbers"),
});
