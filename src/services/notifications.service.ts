import { escapeHtml, sendEmail } from "../lib/email.js";
import type { Order } from "../types.js";

const money = (value: string | number) =>
  `$${Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

function itemRows(order: Order) {
  return order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3e8ee;">
            ${escapeHtml(item.name)} &times; ${item.quantity}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f3e8ee;text-align:right;">
            ${money(item.subtotal)}
          </td>
        </tr>`
    )
    .join("");
}

function totalsBlock(order: Order) {
  const shipping =
    Number(order.shippingCost) === 0 ? "Gratis" : money(order.shippingCost);

  return `
    <tr>
      <td style="padding:8px 0;">Subtotal</td>
      <td style="padding:8px 0;text-align:right;">${money(order.subtotalAmount)}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;">Envio (${escapeHtml(order.shippingProvider)})</td>
      <td style="padding:8px 0;text-align:right;">${shipping}</td>
    </tr>
    <tr>
      <td style="padding:12px 0 0;font-weight:bold;font-size:17px;">Total</td>
      <td style="padding:12px 0 0;text-align:right;font-weight:bold;font-size:17px;color:#db2777;">
        ${money(order.totalAmount)}
      </td>
    </tr>`;
}

function layout(title: string, body: string) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fdf2f8;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
      <h1 style="margin:0 0 18px;font-size:22px;color:#111827;">${title}</h1>
      ${body}
    </div>
  </div>`;
}

function customerEmail(order: Order, storeName: string) {
  const body = `
    <p style="color:#374151;line-height:1.6;">
      Hola ${escapeHtml(order.customerName)}, guardamos tu pedido
      <strong>${escapeHtml(order.orderNumber)}</strong>.
    </p>
    <p style="background:#fdf2f8;border-radius:8px;padding:14px;color:#374151;line-height:1.6;">
      Todavia falta un paso: escribinos por WhatsApp para coordinar el pago y el
      envio. Si ya lo hiciste, ignora este mensaje.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:18px;color:#374151;font-size:15px;">
      ${itemRows(order)}
      ${totalsBlock(order)}
    </table>
    <p style="margin-top:22px;color:#6b7280;font-size:14px;line-height:1.6;">
      Entrega en ${escapeHtml(order.shippingAddress || "-")},
      ${escapeHtml(order.shippingCity)} ${escapeHtml(order.shippingPostalCode)}.
      ${order.shippingEta ? `Estimado: ${escapeHtml(order.shippingEta)}.` : ""}
    </p>
    <p style="margin-top:22px;color:#6b7280;font-size:13px;">
      ${escapeHtml(storeName)}
    </p>`;

  return {
    subject: `Tu pedido ${order.orderNumber} en ${storeName}`,
    html: layout("Recibimos tu pedido", body),
  };
}

function ownerEmail(order: Order, storeName: string) {
  const body = `
    <p style="color:#374151;line-height:1.6;">
      Entro el pedido <strong>${escapeHtml(order.orderNumber)}</strong> por
      <strong>${money(order.totalAmount)}</strong>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:8px;color:#374151;font-size:15px;">
      ${itemRows(order)}
      ${totalsBlock(order)}
    </table>
    <h2 style="margin:24px 0 8px;font-size:16px;color:#111827;">Cliente</h2>
    <p style="color:#374151;line-height:1.7;margin:0;">
      ${escapeHtml(order.customerName)}<br>
      ${escapeHtml(order.customerEmail)}<br>
      ${escapeHtml(order.customerPhone)}
    </p>
    <h2 style="margin:24px 0 8px;font-size:16px;color:#111827;">Entrega</h2>
    <p style="color:#374151;line-height:1.7;margin:0;">
      ${escapeHtml(order.shippingAddress || "-")}<br>
      ${escapeHtml(order.shippingCity)} ${escapeHtml(order.shippingPostalCode)}<br>
      ${escapeHtml(order.shippingProvider)} ${escapeHtml(order.shippingService)}
    </p>`;

  return {
    subject: `Pedido nuevo ${order.orderNumber} - ${money(order.totalAmount)}`,
    html: layout("Pedido nuevo", body),
  };
}

/**
 * Avisa al cliente y a la tienda. Se llama despues de que el pedido quedo
 * guardado y no se espera el resultado: un mail que falla no puede voltear
 * una venta.
 */
export async function notifyNewOrder(order: Order, storeName: string) {
  const customer = customerEmail(order, storeName);
  const owner = ownerEmail(order, storeName);
  const ownerAddress = process.env.OWNER_EMAIL;

  const tasks = [
    sendEmail({
      to: order.customerEmail,
      subject: customer.subject,
      html: customer.html,
      replyTo: ownerAddress,
    }),
  ];

  if (ownerAddress) {
    tasks.push(
      sendEmail({
        to: ownerAddress,
        subject: owner.subject,
        html: owner.html,
        replyTo: order.customerEmail,
      })
    );
  }

  const results = await Promise.all(tasks);
  return results.filter(Boolean).length;
}
