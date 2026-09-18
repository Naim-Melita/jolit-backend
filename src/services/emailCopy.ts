/**
 * URL publica del sitio, para poder linkear el pedido desde los mails.
 * Se toma el primer origen configurado, que es el del dominio propio.
 */
export function getSiteUrl() {
  const first = (process.env.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)[0];

  return (first || "http://localhost:5173").replace(/\/$/, "");
}

export function orderUrl(orderId: number) {
  return `${getSiteUrl()}/order-success/${orderId}`;
}

/**
 * Link para retomar un pedido desde el mail.
 *
 * NO puede apuntar a /order-success/:id: esa pantalla lee el pedido de la
 * memoria de la pestania, que al abrir un link desde el correo siempre esta
 * vacia. La clienta caia en "Pedido no encontrado", justo en el caso para el
 * que existe el boton.
 *
 * La pantalla de consulta, en cambio, trae el pedido del servidor y ya acepta
 * el numero por la URL: queda precargado y solo hace falta el email, que es lo
 * que prueba que el pedido es suyo. Sin ese dato, cualquiera que pruebe
 * numeros veria el nombre, el telefono y la direccion de otra persona.
 */
export function orderLookupUrl(orderNumber: string) {
  return `${getSiteUrl()}/order-status?orderNumber=${encodeURIComponent(orderNumber)}`;
}
