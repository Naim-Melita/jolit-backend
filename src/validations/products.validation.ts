import { z } from "zod";
import { cantidadDeLetras } from "../lib/validaciones.js";

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .refine(
      (texto) => cantidadDeLetras(texto) >= 2,
      "El nombre del producto lleva letras."
    ),
  slug: z.string().min(2).optional(),
  sku: z.string().trim().max(40).optional().default(""),
  description: z.string().trim().min(1, "Escribi una descripcion."),
  price: z.coerce
    .number("El precio va en numeros, sin el signo pesos.")
    .positive("El precio tiene que ser mayor a cero."),
  stock: z.coerce
    .number("El stock va en numeros enteros.")
    .int("El stock va en numeros enteros.")
    .min(0, "El stock no puede ser negativo."),
  imageUrl: z.url("La foto principal tiene que ser un enlace."),
  galleryImages: z.array(z.url("Cada foto tiene que ser un enlace.")).optional().default([]),
  category: z.string().trim().min(2),
  featured: z.coerce.boolean().optional().default(false),
});

export const updateProductSchema = productSchema.partial();
