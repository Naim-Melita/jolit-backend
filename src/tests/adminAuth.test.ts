import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { before, describe, it } from "node:test";

// El secreto tiene que estar antes de importar el modulo.
process.env.ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET ?? randomBytes(32).toString("hex");

const { verifyAdminToken } = await import("../lib/adminAuth.js");
const jwt = (await import("jsonwebtoken")).default;

const secret = process.env.ADMIN_JWT_SECRET;

function sign(payload: object, options: object = {}) {
  return jwt.sign(payload, secret, { algorithm: "HS256", ...options });
}

describe("verifyAdminToken", () => {
  let validToken: string;

  before(() => {
    validToken = sign({ email: "admin@jolit.local" }, {
      subject: "1",
      expiresIn: "8h",
    });
  });

  it("acepta un token bien firmado", () => {
    const payload = verifyAdminToken(validToken);

    assert.ok(payload);
    assert.equal(payload.sub, "1");
    assert.equal(payload.email, "admin@jolit.local");
  });

  it("rechaza un token vencido", () => {
    const expired = sign({ email: "admin@jolit.local" }, {
      subject: "1",
      expiresIn: "-1s",
    });

    assert.equal(verifyAdminToken(expired), null);
  });

  it("rechaza un token con el payload manipulado", () => {
    const [header, , signature] = validToken.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ sub: "1", email: "hacker@evil.com", exp: 9999999999 })
    ).toString("base64url");

    assert.equal(verifyAdminToken(`${header}.${tampered}.${signature}`), null);
  });

  it("rechaza alg=none", () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" })
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "1", email: "admin@jolit.local", exp: 9999999999 })
    ).toString("base64url");

    assert.equal(verifyAdminToken(`${header}.${payload}.`), null);
  });

  it("rechaza un token firmado con otro secreto", () => {
    const otro = jwt.sign({ email: "admin@jolit.local" }, randomBytes(32).toString("hex"), {
      algorithm: "HS256",
      subject: "1",
      expiresIn: "8h",
    });

    assert.equal(verifyAdminToken(otro), null);
  });

  it("rechaza el token viejo en base64 de email:hash", () => {
    const viejo = Buffer.from("admin@jolit.local:unhash").toString("base64");

    assert.equal(verifyAdminToken(viejo), null);
  });

  it("rechaza un token sin subject", () => {
    const sinSub = sign({ email: "admin@jolit.local" }, { expiresIn: "8h" });

    assert.equal(verifyAdminToken(sinSub), null);
  });

  it("rechaza cadenas vacias y basura", () => {
    assert.equal(verifyAdminToken(""), null);
    assert.equal(verifyAdminToken("no-es-un-token"), null);
    assert.equal(verifyAdminToken("a.b.c"), null);
  });

  it("rechaza HS256 firmado sobre el header manipulado", () => {
    // Firma valida para el contenido, pero declarando otro algoritmo.
    const header = Buffer.from(
      JSON.stringify({ alg: "HS512", typ: "JWT" })
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "1", email: "admin@jolit.local", exp: 9999999999 })
    ).toString("base64url");
    const signature = createHmac("sha512", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");

    assert.equal(verifyAdminToken(`${header}.${payload}.${signature}`), null);
  });
});
