/**
 * De que instancia de Clerk son las claves que tenemos puestas.
 *
 * Clerk usa el mismo prefijo en todos lados: `pk_test_` / `sk_test_` para la
 * instancia de desarrollo y `pk_live_` / `sk_live_` para la de produccion.
 *
 * Importa porque la instancia de desarrollo tiene topes de uso, usa
 * credenciales de OAuth compartidas que Clerk desaconseja para un sitio real,
 * y manda los correos desde su dominio y no desde el nuestro. La tienda
 * publicada estuvo corriendo con las de desarrollo y el unico aviso era una
 * linea en la consola del navegador que nadie mira.
 */

export type InstanciaDeClerk = "desarrollo" | "produccion" | "sin configurar";

export function instanciaDeClerk(clave: string | undefined): InstanciaDeClerk {
  const valor = clave?.trim() ?? "";

  if (!valor) return "sin configurar";
  if (/^(pk|sk)_live_/.test(valor)) return "produccion";
  if (/^(pk|sk)_test_/.test(valor)) return "desarrollo";

  return "sin configurar";
}

/**
 * Avisa al arrancar si la tienda publicada quedo con las claves de prueba.
 *
 * Va por consola de error y no corta el arranque a proposito: dejar la tienda
 * sin poder levantar seria peor que tener las cuentas en modo desarrollo.
 */
export function avisarSiClerkEsDeDesarrollo({
  claveSecreta = process.env.CLERK_SECRET_KEY,
  enProduccion = process.env.NODE_ENV === "production",
}: { claveSecreta?: string; enProduccion?: boolean } = {}) {
  if (!enProduccion) return false;
  if (instanciaDeClerk(claveSecreta) !== "desarrollo") return false;

  console.error(
    [
      "",
      "  AVISO: Clerk esta corriendo con las claves de DESARROLLO (sk_test_).",
      "",
      "  La instancia de desarrollo tiene topes de uso y no esta pensada para",
      "  una tienda real: en algun momento van a empezar a fallar los registros",
      "  de clientas. Hay que crear la instancia de produccion en Clerk, cargar",
      "  sus registros DNS y cambiar las claves por las pk_live_ / sk_live_.",
      "",
    ].join("\n")
  );

  return true;
}
