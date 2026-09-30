import { z } from "zod";
import { cantidadDeLetras } from "../lib/validaciones.js";
import { textoOpcional } from "./comunes.js";

export const materialSchema = z.object({
  name: z
    .string()
    .trim()
    .refine(
      (texto) => cantidadDeLetras(texto) >= 2,
      "El nombre del material lleva letras."
    ),
  slug: textoOpcional(2, "El enlace necesita al menos 2 caracteres."),
  // Tres letras del medio del codigo: ARO-BLA-0001. Si no se carga, sale del
  // nombre, mirando su ultima palabra.
  prefix: textoOpcional(2, "El prefijo lleva al menos 2 letras."),
});
