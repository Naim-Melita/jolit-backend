import { z } from "zod";
import { orderItemsSchema } from "./orders.validation.js";

export const shippingQuoteSchema = z
  .object({
    postalCode: z.string().optional().default(""),
    address: z.string().optional().default(""),
    city: z.string().optional().default(""),
    province: z.string().optional().default(""),
    // El subtotal se calcula en el servidor desde estos items.
    items: orderItemsSchema,
  })
  .refine(
    (input) =>
      input.postalCode.trim().length >= 4 ||
      input.address.trim().length >= 4 ||
      input.city.trim().length >= 2,
    {
      message: "Necesitamos tu codigo postal, tu direccion o tu ciudad.",
      path: ["postalCode"],
    }
  );
