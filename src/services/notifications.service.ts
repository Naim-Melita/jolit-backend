import { escapeHtml, sendEmail } from "../lib/email.js";
import type { Order, StoreSettings } from "../types.js";
import { orderUrl } from "./emailCopy.js";
import { buildOrderReceiptPdf, receiptFileName } from "./receipt.service.js";

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

/**
 * El costo y el plazo de envio son de lo primero que la clienta busca en el
 * mail. Van en su propio bloque, no perdidos en una linea gris al final.
 */
function shippingBlock(order: Order) {
  const costo =
    Number(order.shippingCost) === 0 ? "Envio gratis" : money(order.shippingCost);
  const plazo = order.shippingEta
    ? ` &middot; llega en ${escapeHtml(order.shippingEta)}`
    : "";
  const domicilio = [
    order.shippingAddress,
    [order.shippingCity, order.shippingPostalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");

  return `
    <div style="margin-top:22px;border-top:1px solid #f3e8ee;padding-top:16px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">
        Envio
      </p>
      <p style="margin:0;color:#111827;font-size:15px;line-height:1.6;">
        ${escapeHtml(order.shippingProvider)} ${escapeHtml(order.shippingService)}<br>
        <strong>${costo}</strong>${plazo}
        ${domicilio ? `<br><span style="color:#6b7280;">${domicilio}</span>` : ""}
      </p>
    </div>`;
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
      Si ya pagaste, en un momento te llega la confirmacion con el comprobante
      y podes ignorar este mensaje.
      <br><br>
      Si no llegaste a completar el pago, guardamos tus piezas y podes
      retomarlo desde
      <a href="${orderUrl(order.id)}" style="color:#db2777;font-weight:bold;">
        esta pagina</a>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:18px;color:#374151;font-size:15px;">
      ${itemRows(order)}
      ${totalsBlock(order)}
    </table>
    ${shippingBlock(order)}
    <p style="margin-top:22px;color:#6b7280;font-size:13px;">
      ${escapeHtml(storeName)}
    </p>`;

  return {
    subject: `Tu pedido ${order.orderNumber} en ${storeName}`,
    html: layout("Recibimos tu pedido", body),
  };
}

/** Aviso a la tienda de que la plata ya entro y hay que despachar. */
function ownerPaidEmail(order: Order, storeName: string) {
  const body = `
    <p style="color:#374151;line-height:1.6;">
      Se acredito el pago del pedido
      <strong>${escapeHtml(order.orderNumber)}</strong> por
      <strong>${money(order.totalAmount)}</strong>. Ya se puede preparar.
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
    ${shippingBlock(order)}
    ${
      order.paymentId
        ? `<p style="margin-top:22px;color:#6b7280;font-size:13px;">
             Pago de Mercado Pago N.o ${escapeHtml(order.paymentId)}. Buscalo con
             ese numero para cruzarlo con el movimiento en tu cuenta.
           </p>`
        : ""
    }`;

  return {
    // El monto va en el asunto: es lo que se lee en la notificacion del
    // celular sin llegar a abrir el mail.
    subject: `Cobraste ${money(order.totalAmount)} - pedido ${order.orderNumber}`,
    html: layout(`Cobraste ${money(order.totalAmount)}`, body),
  };
}

/**
 * Avisa al cliente y a la tienda. Se llama despues de que el pedido quedo
 * guardado y no se espera el resultado: un mail que falla no puede voltear
 * una venta.
 */
export async function notifyNewOrder(order: Order, storeName: string) {
  const customer = customerEmail(order, storeName);

  // A la tienda no se le avisa aca: el pedido todavia no se pago. El aviso
  // sale cuando la plata entra, en notifyOrderPaid.
  const enviado = await sendEmail({
    to: order.customerEmail,
    subject: customer.subject,
    html: customer.html,
    replyTo: process.env.OWNER_EMAIL,
  });

  return enviado ? 1 : 0;
}

function paidEmail(order: Order, storeName: string) {
  const body = `
    <p style="color:#374151;line-height:1.6;">
      Hola ${escapeHtml(order.customerName)}, confirmamos el pago de tu pedido
      <strong>${escapeHtml(order.orderNumber)}</strong>. Ya lo estamos preparando.
    </p>
    <p style="background:#f0fdf4;border-radius:8px;padding:14px;color:#374151;line-height:1.6;">
      Te adjuntamos el comprobante en PDF. Cuando lo despachemos te pasamos el
      codigo de seguimiento.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:18px;color:#374151;font-size:15px;">
      ${itemRows(order)}
      ${totalsBlock(order)}
    </table>
    ${shippingBlock(order)}
    <p style="margin-top:22px;color:#6b7280;font-size:13px;">
      ${escapeHtml(storeName)}
    </p>`;

  return {
    subject: `Confirmamos tu pago - pedido ${order.orderNumber}`,
    html: layout("Recibimos tu pago", body),
  };
}

/**
 * Avisa a la clienta que el pago entro y le manda el comprobante en PDF.
 * Se dispara al pasar el pedido a "paid". Si falla el PDF, igual sale el mail:
 * la confirmacion importa mas que el adjunto.
 */
export async function notifyOrderPaid(order: Order, settings: StoreSettings) {
  const cliente = paidEmail(order, settings.storeName);
  const tienda = ownerPaidEmail(order, settings.storeName);
  const ownerAddress = process.env.OWNER_EMAIL;

  let attachments;
  try {
    attachments = [
      {
        filename: receiptFileName(order),
        content: await buildOrderReceiptPdf(order, settings),
      },
    ];
  } catch (error) {
    console.error(`No se pudo generar el comprobante de ${order.orderNumber}`, error);
  }

  const tasks = [
    sendEmail({
      to: order.customerEmail,
      subject: cliente.subject,
      html: cliente.html,
      replyTo: ownerAddress,
      attachments,
    }),
  ];

  if (ownerAddress) {
    tasks.push(
      sendEmail({
        to: ownerAddress,
        subject: tienda.subject,
        html: tienda.html,
        replyTo: order.customerEmail,
      })
    );
  }

  const resultados = await Promise.all(tasks);

  // Devuelve true si al menos le llego a la clienta, que es lo que se
  // registra en la linea de tiempo del pedido.
  return resultados[0];
}
