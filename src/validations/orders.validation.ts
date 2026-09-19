import { z } from "zod";
import {
  esCodigoPostal,
  esDireccion,
  esLocalidad,
  esNombreDePersona,
  esTelefono,
} from "../lib/validaciones.js";

export const orderItemsSchema = z
  .array(
    z.object({
      productId: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().positive().max(50),
    })
  )
  .min(1)
  .max(50);

/** Los opcionales solo se revisan si vienen con algo cargado. */
const siLoCargo = (valido: (texto: string) => boolean) => (texto: string) =>
  texto.trim() === "" || valido(texto);

export const orderSchema = z.object({
  customerName: z
    .string()
    .trim()
    .refine(esNombreDePersona, "Ingresa tu nombre y apellido, sin numeros."),
  customerEmail: z.string().trim().email("Revisa el email: no parece valido."),
  customerPhone: z
    .string()
    .trim()
    .refine(esTelefono, "Ingresa un telefono con al menos 8 numeros."),
  shippingAddress: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine(siLoCargo(esDireccion), "Ingresa la calle y la altura."),
  shippingCity: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine(siLoCargo(esLocalidad), "Ingresa el nombre de la ciudad."),
  shippingPostalCode: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine(
      siLoCargo(esCodigoPostal),
      "El codigo postal va con 4 numeros (1425) o en formato CPA (C1425DYB)."
    ),
  shippingCountry: z.string().trim().optional().default("Argentina"),
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
  orderNumber: z.string().trim().min(3, "Ingresa el numero de pedido."),
  contact: z.string().trim().min(3, "Ingresa el email o telefono de la compra."),
});
