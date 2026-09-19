import { z } from "zod";
import {
  cantidadDeLetras,
  esCuit,
  esEmail,
  esTelefono,
  esUrlWeb,
} from "../lib/validaciones.js";

/** Los datos del vendedor son opcionales: solo se revisan si se cargaron. */
const siLoCargo = (valido: (texto: string) => boolean) => (texto: string) =>
  texto.trim() === "" || valido(texto);

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2),
  whatsappNumber: z
    .string()
    .trim()
    .refine(esTelefono, "El WhatsApp va con numeros, al menos 8."),
  shipping: z
    .object({
      provider: z.string().min(2).default("Correo Argentino"),
      service: z.string().min(2).default("PAQ.AR"),
      freeShippingMinimum: z.coerce.number().min(0).default(100000),
      cabaRate: z.coerce.number().min(0).default(2500),
      gbaRate: z.coerce.number().min(0).default(3500),
      interiorRate: z.coerce.number().min(0).default(5500),
    })
    .optional()
    .default({
      provider: "Correo Argentino",
      service: "PAQ.AR",
      freeShippingMinimum: 100000,
      cabaRate: 2500,
      gbaRate: 3500,
      interiorRate: 5500,
    }),
  seller: z
    .object({
      legalName: z
        .string()
        .trim()
        .max(120)
        .default("")
        .refine(
          siLoCargo((texto) => cantidadDeLetras(texto) >= 2),
          "La razon social lleva letras."
        ),
      // El CUIT se imprime en el comprobante: se valida el digito
      // verificador, no solo que sean once numeros.
      taxId: z
        .string()
        .trim()
        .max(20)
        .default("")
        .refine(
          siLoCargo(esCuit),
          "Ese CUIT no es valido. Son 11 numeros y el ultimo tiene que cerrar."
        ),
      address: z
        .string()
        .trim()
        .max(160)
        .default("")
        .refine(
          siLoCargo((texto) => cantidadDeLetras(texto) >= 3),
          "El domicilio lleva calle y altura."
        ),
      email: z
        .string()
        .trim()
        .max(120)
        .default("")
        .refine(siLoCargo(esEmail), "Ese email no parece valido."),
      dataFiscalUrl: z
        .string()
        .trim()
        .max(300)
        .default("")
        .refine(
          siLoCargo(esUrlWeb),
          "El Data Fiscal es un enlace: tiene que empezar con https://"
        ),
    })
    .optional()
    .default({
      legalName: "",
      taxId: "",
      address: "",
      email: "",
      dataFiscalUrl: "",
    }),
  payments: z
    .object({
      // Debajo de este total no se ofrecen cuotas.
      installmentsMinimum: z.coerce.number().min(0).default(45000),
    })
    .optional()
    .default({ installmentsMinimum: 45000 }),
  promoBanner: z.object({
    enabled: z.coerce.boolean(),
    title: z.string().max(80).default(""),
    message: z.string().max(180).default(""),
    ctaLabel: z.string().max(40).default(""),
    ctaUrl: z.string().default(""),
    startsAt: z.string().optional().default(""),
    endsAt: z.string().optional().default(""),
  }),
});
