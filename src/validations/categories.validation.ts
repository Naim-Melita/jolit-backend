import { z } from "zod";
import { cantidadDeLetras } from "../lib/validaciones.js";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .refine(
      (texto) => cantidadDeLetras(texto) >= 2,
      "El nombre de la categoria lleva letras."
    ),
  slug: z.string().min(2).optional(),
});
