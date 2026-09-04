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
