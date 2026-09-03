import { z } from "zod";

export const subscriberSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .default("")
    .transform((value) => value || null),
  source: z.string().trim().max(40).optional().default("home"),
});
