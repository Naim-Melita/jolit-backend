import { HttpError } from "../lib/http.js";
import { verifyWebhookSignature } from "../lib/mercadopago.js";
import { prisma } from "../lib/prisma.js";
import { updateOrderStatus } from "./orders.service.js";
import { fetchPaymentSnapshot } from "./payments.service.js";

type WebhookHeaders = {
  signature?: string;
  requestId?: string;
};

type WebhookBody = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

/**
 * Procesa el aviso de Mercado Pago.
 *
 * Nunca confiamos en el cuerpo del aviso: valida la firma y despues consulta
 * el pago contra la API de MP. Lo unico que se toma del body es el id.
 */
export async function handleMercadoPagoWebhook(
  rawBody: string,
  headers: WebhookHeaders
) {
  let body: WebhookBody;

  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  const dataId = body.data?.id ? String(body.data.id) : undefined;

  // Mercado Pago manda varios tipos de aviso; solo nos interesan los pagos.
  if (body.type && body.type !== "payment") {
    return { received: true, ignored: body.type };
  }

  if (!dataId) {
    return { received: true, ignored: "sin data.id" };
  }

  if (!verifyWebhookSignature({ ...headers, dataId })) {
    throw new HttpError(401, "Firma de webhook invalida");
  }

  const payment = await fetchPaymentSnapshot(dataId);

  if (!payment.orderId) {
    console.warn(`Pago ${payment.paymentId} sin external_reference utilizable`);
    return { received: true, ignored: "sin pedido asociado" };
  }

  const order = await prisma.order.findUnique({
    where: { id: payment.orderId },
    select: {
      id: true,
      status: true,
      paymentId: true,
      orderNumber: true,
      totalAmount: true,
      customerEmail: true,
    },
  });

  if (!order) {
    console.warn(`Pago ${payment.paymentId} apunta a un pedido inexistente`);
    return { received: true, ignored: "pedido inexistente" };
  }

  // Idempotencia: Mercado Pago reintenta los avisos, y no queremos procesar
  // dos veces el mismo pago ni reenviar el comprobante.
  if (order.paymentId === payment.paymentId && order.status === "paid") {
    return { received: true, alreadyProcessed: true };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentId: payment.paymentId,
      paymentStatus: payment.status,
      ...(payment.approved ? { paidAt: new Date() } : {}),
    },
  });

  if (!payment.approved) {
    // Rechazado o pendiente: dejamos el pedido en "pending" para que se pueda
    // reintentar. Si nunca se paga, lo limpia la expiracion de pendientes.
    console.log(
      `Pago ${payment.paymentId} del pedido ${order.orderNumber}: ${payment.status}`
    );
    return { received: true, status: payment.status };
  }

  // Verificamos el monto antes de dar el pedido por pagado. La preferencia
  // se arma en el servidor, asi que no deberia diferir nunca; si difiere,
  // algo esta mal y preferimos que quede pendiente y se mire a mano.
  const esperado = Number(order.totalAmount.toString());

  if (Math.abs(payment.paidAmount - esperado) > 0.01) {
    console.error(
      `Pedido ${order.orderNumber}: se pago ${payment.paidAmount} y se esperaba ${esperado}. No se marca como pagado.`
    );

    return { received: true, status: payment.status, amountMismatch: true };
  }

  // Un pedido cancelado ya devolvio su stock, y esas piezas pueden estar
  // vendidas a otra persona. Marcarlo como pagado aca lo venderia dos veces.
  // Pasa de verdad con el efectivo: el pago puede acreditarse despues de que
  // el pedido expiro. Lo dejamos cancelado y avisamos para resolverlo a mano.
  if (order.status === "cancelled") {
    console.error(
      `Pedido ${order.orderNumber}: se acredito el pago ${payment.paymentId} sobre un pedido ya cancelado. Requiere revision manual.`
    );

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "status_changed",
        message:
          "Se acredito un pago sobre este pedido ya cancelado. Revisar si hay stock para cumplirlo o si corresponde devolver el dinero.",
      },
    });

    return { received: true, status: payment.status, paidAfterCancel: true };
  }

  if (order.status !== "paid") {
    // Reusa la transicion normal, que registra el evento y dispara el
    // comprobante por mail.
    await updateOrderStatus(order.id, { status: "paid" });
  }

  return { received: true, status: payment.status, paid: true };
}
