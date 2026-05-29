import { z } from "zod";

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
