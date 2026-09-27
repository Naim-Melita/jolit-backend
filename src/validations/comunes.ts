import { z } from "zod";

/**
 * Texto opcional que los formularios mandan como cadena vacia.
 *
 * `.optional()` de Zod deja pasar que el campo no venga, pero no que venga
 * vacio. El panel manda `slug: ""` cuando no se completa —el casillero dice
 * "opcional"— y la peticion se rechazaba con "Too small: expected string to
 * have >=2 characters". Asi no se podia crear ni una categoria ni un producto
 * sin completar a mano un campo que no era obligatorio.
 *
 * Vacio pasa a ser "no vino", que es lo que despues esperan los servicios:
 * `input.slug ?? slugify(input.name)` solo funciona con undefined.
 */
export function textoOpcional(minimo: number, mensaje: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((valor) => valor || undefined)
    .refine(
      (valor) => valor === undefined || valor.length >= minimo,
      mensaje
    );
}
