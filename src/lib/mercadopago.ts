import { createHmac, timingSafeEqual } from "node:crypto";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

let warnedMissingConfig = false;

export function isMercadoPagoConfigured() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

export function warnIfNotConfigured() {
  if (isMercadoPagoConfigured() || warnedMissingConfig) return;

  warnedMissingConfig = true;
  console.warn(
    "Mercado Pago deshabilitado: falta MP_ACCESS_TOKEN. El checkout no va a poder cobrar."
  );
}

function getClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN no esta configurado");
  }

  return new MercadoPagoConfig({
    accessToken,
    options: { timeout: 10000 },
  });
}

export function getPreferenceClient() {
  return new Preference(getClient());
}

export function getPaymentClient() {
  return new Payment(getClient());
}

/**
 * Valida la firma del webhook de Mercado Pago.
 *
 * MP manda `x-signature: ts=<epoch>,v1=<hmac>` y arma el HMAC sobre
 * `id:<dataId>;request-id:<xRequestId>;ts:<ts>;` con el secreto del panel.
 * Sin secreto configurado devolvemos false: preferimos rechazar avisos
 * legitimos antes que aceptar uno falso que marque un pedido como pagado.
 */
export function verifyWebhookSignature(input: {
  signature?: string;
  requestId?: string;
  dataId?: string;
}) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !input.signature || !input.dataId) return false;

  const parts = Object.fromEntries(
    input.signature
      .split(",")
      .map((part) => part.split("=").map((value) => value.trim()))
      .filter((pair): pair is [string, string] => pair.length === 2)
  );

  const ts = parts.ts;
  const received = parts.v1;
  if (!ts || !received) return false;

  const manifest = `id:${input.dataId};request-id:${input.requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");

  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Cuantas cuotas ofrecer segun el total. Debajo del minimo mandamos 1 para que
 * Mercado Pago no muestre cuotas: el "sin interes" lo banca la tienda y en
 * tickets chicos se come el margen sin ganar la venta.
 */
export function resolveInstallments(total: number, minimum: number) {
  return total >= minimum ? 3 : 1;
}
