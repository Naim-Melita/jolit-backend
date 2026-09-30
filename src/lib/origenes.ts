/**
 * Los origenes que son "nuestro sitio".
 *
 * Lo usan dos cosas: CORS, para decidir a quien le contesta la API, y Clerk,
 * para saber desde donde acepta una sesion (authorizedParties). Es la misma
 * lista y conviene que no se puedan desincronizar.
 */

/**
 * Cada origen configurado, con y sin "www".
 *
 * Para una persona jolit.com.ar y www.jolit.com.ar son el mismo sitio; para
 * el navegador son dos origenes distintos. Con uno solo configurado, entrar
 * por el otro quedaba bloqueado: paso de verdad y no se podia entrar al panel
 * desde www.
 *
 * Solo se agrega esa variante, no cualquier subdominio: es el mismo dominio y
 * lo controla quien controla el que ya estaba configurado.
 */
/** localhost y las IP no tienen variante con www: "www.localhost" no existe. */
function admiteWww(host: string) {
  const sinPuerto = host.replace(/:\d+$/, "");

  if (sinPuerto === "localhost" || sinPuerto.endsWith(".localhost")) return false;
  // IPv4, o IPv6 entre corchetes.
  if (/^\d+(\.\d+)*$/.test(sinPuerto) || sinPuerto.startsWith("[")) return false;

  return sinPuerto.includes(".");
}

export function conYSinWww(origenes: string[]) {
  const todos = new Set<string>();

  for (const origen of origenes) {
    todos.add(origen);

    try {
      const url = new URL(origen);

      if (url.host.startsWith("www.")) {
        todos.add(`${url.protocol}//${url.host.slice(4)}`);
      } else if (admiteWww(url.host)) {
        todos.add(`${url.protocol}//www.${url.host}`);
      }
    } catch {
      // Si no es una URL valida queda solo tal cual se escribio.
    }
  }

  return todos;
}

/** Lo que diga FRONTEND_ORIGIN, separado por comas. */
export function origenesConfigurados() {
  return (process.env.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((origen) => origen.trim())
    .filter(Boolean);
}
