import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  avisarSiClerkEsDeDesarrollo,
  instanciaDeClerk,
} from "../lib/clerkEntorno.js";

// La tienda publicada estuvo corriendo con las claves de desarrollo de Clerk
// y el unico aviso era una linea en la consola del navegador.
describe("instanciaDeClerk", () => {
  it("distingue desarrollo de produccion por el prefijo", () => {
    assert.equal(instanciaDeClerk("pk_test_ZXhwZXJ0LXNs"), "desarrollo");
    assert.equal(instanciaDeClerk("sk_test_abc123"), "desarrollo");
    assert.equal(instanciaDeClerk("pk_live_ZXhwZXJ0LXNs"), "produccion");
    assert.equal(instanciaDeClerk("sk_live_abc123"), "produccion");
  });

  it("trata como sin configurar lo vacio y lo que no reconoce", () => {
    for (const clave of [undefined, "", "   ", "pegar-aca-la-clave"]) {
      assert.equal(instanciaDeClerk(clave), "sin configurar");
    }
  });
});

describe("avisarSiClerkEsDeDesarrollo", () => {
  it("avisa cuando produccion corre con claves de prueba", () => {
    assert.equal(
      avisarSiClerkEsDeDesarrollo({
        claveSecreta: "sk_test_abc",
        enProduccion: true,
      }),
      true
    );
  });

  it("no molesta en desarrollo, que es donde corresponde usarlas", () => {
    assert.equal(
      avisarSiClerkEsDeDesarrollo({
        claveSecreta: "sk_test_abc",
        enProduccion: false,
      }),
      false
    );
  });

  it("calla cuando produccion ya tiene las claves que corresponden", () => {
    assert.equal(
      avisarSiClerkEsDeDesarrollo({
        claveSecreta: "sk_live_abc",
        enProduccion: true,
      }),
      false
    );
  });
});
