import { z } from "zod";
import { orderItemsSchema } from "./orders.validation.js";
import { esCodigoPostal } from "../lib/validaciones.js";

export const shippingQuoteSchema = z
  .object({
    // De aca sale la zona y por lo tanto el precio del envio: un codigo mal
    // formado cae en "interior" sin avisar y se cobra de mas.
    postalCode: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine(
        (texto) => texto === "" || esCodigoPostal(texto),
        "El codigo postal va con 4 numeros (1425) o en formato CPA (C1425DYB)."
      ),
    address: z.string().trim().optional().default(""),
    city: z.string().trim().optional().default(""),
    province: z.string().trim().optional().default(""),
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
