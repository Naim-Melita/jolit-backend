import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  resolveInstallments,
  verifyWebhookSignature,
} from "../lib/mercadopago.js";

const SECRET = "un-secreto-de-webhook-para-pruebas";

function firmar(dataId: string, requestId: string, ts: string, secret = SECRET) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("resolveInstallments", () => {
  it("no ofrece cuotas debajo del minimo", () => {
    assert.equal(resolveInstallments(27999.99, 45000), 1);
    assert.equal(resolveInstallments(44999.99, 45000), 1);
  });

  it("ofrece 3 cuotas justo en el minimo", () => {
    assert.equal(resolveInstallments(45000, 45000), 3);
  });

  it("ofrece 3 cuotas por encima del minimo", () => {
    assert.equal(resolveInstallments(124999, 45000), 3);
  });

  it("respeta un minimo distinto configurado en el panel", () => {
    assert.equal(resolveInstallments(50000, 60000), 1);
    assert.equal(resolveInstallments(60000, 60000), 3);
  });
});

describe("verifyWebhookSignature", () => {
  const dataId = "1234567890";
  const requestId = "req-abc";
  const ts = "1788400000";

  it("acepta una firma valida", () => {
    process.env.MP_WEBHOOK_SECRET = SECRET;

    assert.equal(
      verifyWebhookSignature({
        signature: firmar(dataId, requestId, ts),
        requestId,
        dataId,
      }),
      true
    );
  });

  it("rechaza si cambia el id del pago", () => {
    process.env.MP_WEBHOOK_SECRET = SECRET;

    assert.equal(
      verifyWebhookSignature({
        signature: firmar(dataId, requestId, ts),
        requestId,
        dataId: "9999999999",
      }),
      false
    );
  });

  it("rechaza una firma hecha con otro secreto", () => {
    process.env.MP_WEBHOOK_SECRET = SECRET;

    assert.equal(
      verifyWebhookSignature({
        signature: firmar(dataId, requestId, ts, "otro-secreto-distinto-largo"),
        requestId,
        dataId,
      }),
      false
    );
  });

  it("rechaza cuando no hay secreto configurado", () => {
    delete process.env.MP_WEBHOOK_SECRET;

    assert.equal(
      verifyWebhookSignature({
        signature: firmar(dataId, requestId, ts),
        requestId,
        dataId,
      }),
      false
    );
  });

  it("rechaza firmas mal formadas o ausentes", () => {
    process.env.MP_WEBHOOK_SECRET = SECRET;

    assert.equal(verifyWebhookSignature({ dataId }), false);
    assert.equal(
      verifyWebhookSignature({ signature: "basura", requestId, dataId }),
      false
    );
    assert.equal(
      verifyWebhookSignature({ signature: `ts=${ts}`, requestId, dataId }),
      false
    );
  });

  it("rechaza si falta el id del pago", () => {
    process.env.MP_WEBHOOK_SECRET = SECRET;

    assert.equal(
      verifyWebhookSignature({
        signature: firmar(dataId, requestId, ts),
        requestId,
      }),
      false
    );
  });
});
