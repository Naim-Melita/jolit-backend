import { z } from "zod";

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
