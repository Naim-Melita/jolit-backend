import { z } from "zod";
import { cantidadDeLetras } from "../lib/validaciones.js";
import { textoOpcional } from "./comunes.js";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .refine(
      (texto) => cantidadDeLetras(texto) >= 2,
      "El nombre de la categoria lleva letras."
    ),
  // Vacio significa "generalo desde el nombre".
  slug: textoOpcional(2, "El enlace necesita al menos 2 caracteres."),
});
