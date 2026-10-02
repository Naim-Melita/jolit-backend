import { z } from "zod";
import { esNombreDePersona, esTelefono } from "../lib/validaciones.js";

export const subscriberSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80)
    .refine(esNombreDePersona, "Ingresá tu nombre, sin números."),
  email: z.string().trim().toLowerCase().email(),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .default("")
    .refine(
      (texto) => texto === "" || esTelefono(texto),
      "Ingresá un teléfono con al menos 8 números."
    )
    .transform((value) => value || null),
  source: z.string().trim().max(40).optional().default("home"),
});
