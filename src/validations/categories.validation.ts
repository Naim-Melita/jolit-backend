import { z } from "zod";
import { cantidadDeLetras } from "../lib/validaciones.js";
import { textoOpcional } from "./comunes.js";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .refine(
      (texto) => cantidadDeLetras(texto) >= 2,
      "El nombre de la categoría lleva letras."
    ),
  // Vacio significa "generalo desde el nombre".
  slug: textoOpcional(2, "El enlace necesita al menos 2 caracteres."),
  // Tres letras con las que empiezan los codigos de sus piezas: ANI-BLA-0001.
  // Si no se carga, sale del nombre.
  prefix: textoOpcional(2, "El prefijo lleva al menos 2 letras."),
});
