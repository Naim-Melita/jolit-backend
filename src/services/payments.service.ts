import { badRequest, HttpError, notFound } from "../lib/http.js";
import {
  getPaymentClient,
  getPreferenceClient,
  isMercadoPagoConfigured,
  resolveInstallments,
} from "../lib/mercadopago.js";
import { prisma } from "../lib/prisma.js";
import { getStoreSettings } from "./settings.service.js";

function getFrontendUrl() {
  const first = (process.env.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)[0];

  return first || "http://localhost:5173";
}

function getNotificationUrl() {
  const base = process.env.BACKEND_PUBLIC_URL?.trim();
  if (!base) return undefined;

  return `${base.replace(/\/$/, "")}/api/webhooks/mercadopago`;
}

/**
 * Crea la preferencia de Mercado Pago para un pedido y devuelve el link de
 * pago. El precio de cada item ya viene calculado desde la base: nunca se
 * toma un monto del navegador.
 */
export async function createPaymentPreference(orderId: number) {
  if (!isMercadoPagoConfigured()) {
    throw new HttpError(503, "Mercado Pago no esta configurado");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw notFound("Order not found");

  if (order.status !== "pending") {
    throw badRequest("Este pedido ya no esta pendiente de pago");
  }

  const settings = await getStoreSettings();
  const total = Number(order.totalAmount.toString());
  const installments = resolveInstallments(
    total,
    settings.payments.installmentsMinimum
  );

  const frontendUrl = getFrontendUrl();
  const notificationUrl = getNotificationUrl();

  const preference = await getPreferenceClient().create({
    body: {
      items: order.items.map((item) => ({
        id: String(item.productId ?? item.slug),
        title: item.name,
        quantity: item.quantity,
        unit_price: Number(item.price.toString()),
        currency_id: "ARS",
      })),
      payer: {
        name: order.customerName,
        email: order.customerEmail,
      },
      shipments: {
        cost: Number(order.shippingCost.toString()),
        mode: "not_specified",
      },
      // Con esto el webhook y la vuelta al sitio saben de que pedido hablan.
      external_reference: String(order.id),
      back_urls: {
        success: `${frontendUrl}/order-success/${order.id}`,
        pending: `${frontendUrl}/order-success/${order.id}`,
        failure: `${frontendUrl}/checkout?pago=rechazado`,
      },
      auto_return: "approved",
      payment_methods: {
        installments,
        excluded_payment_types: [],
      },
      statement_descriptor: settings.storeName.slice(0, 22),
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    },
  });

  if (!preference.id || !preference.init_point) {
    throw new HttpError(502, "Mercado Pago no devolvio un link de pago");
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentPreferenceId: preference.id },
  });

  return {
    preferenceId: preference.id,
    initPoint: preference.init_point,
    sandboxInitPoint: preference.sandbox_init_point ?? null,
    installments,
  };
}

export type MercadoPagoPaymentSnapshot = {
  paymentId: string;
  status: string;
  orderId: number | null;
  approved: boolean;
};

/** Consulta el pago en Mercado Pago. Nunca confiamos en el cuerpo del webhook. */
export async function fetchPaymentSnapshot(
  paymentId: string
): Promise<MercadoPagoPaymentSnapshot> {
  const payment = await getPaymentClient().get({ id: paymentId });
  const externalReference = payment.external_reference;
  const orderId = externalReference ? Number(externalReference) : null;

  return {
    paymentId: String(payment.id ?? paymentId),
    status: payment.status ?? "unknown",
    orderId: Number.isFinite(orderId) && orderId ? orderId : null,
    approved: payment.status === "approved",
  };
}
