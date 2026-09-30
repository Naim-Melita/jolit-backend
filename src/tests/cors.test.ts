import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conYSinWww } from "../lib/origenes.js";

// Lo que paso: FRONTEND_ORIGIN tenia https://jolit.com.ar y entrar al panel
// por https://www.jolit.com.ar quedaba bloqueado. Los dos sirven el sitio, no
// hay redireccion de uno al otro, asi que se entra por cualquiera de los dos.
describe("conYSinWww", () => {
  it("acepta el mismo sitio con y sin www", () => {
    const permitidos = conYSinWww(["https://jolit.com.ar"]);

    assert.equal(permitidos.has("https://jolit.com.ar"), true);
    assert.equal(permitidos.has("https://www.jolit.com.ar"), true);
  });

  it("funciona igual si lo configurado es el www", () => {
    const permitidos = conYSinWww(["https://www.jolit.com.ar"]);

    assert.equal(permitidos.has("https://www.jolit.com.ar"), true);
    assert.equal(permitidos.has("https://jolit.com.ar"), true);
  });

  it("no abre otros subdominios ni otros dominios", () => {
    const permitidos = conYSinWww(["https://jolit.com.ar"]);

    for (const origen of [
      "https://api.jolit.com.ar",
      "https://admin.jolit.com.ar",
      "https://jolit.com.ar.otrositio.com",
      "https://otrositio.com",
      // El protocolo tambien cuenta: http no es https.
      "http://jolit.com.ar",
    ]) {
      assert.equal(permitidos.has(origen), false, origen);
    }
  });

  it("respeta el puerto, que es parte del origen", () => {
    const permitidos = conYSinWww(["http://localhost:5173"]);

    assert.equal(permitidos.has("http://localhost:5173"), true);
    assert.equal(permitidos.has("http://localhost:3000"), false);
  });

  it("deja pasar lo que no es una URL sin romperse", () => {
    const permitidos = conYSinWww(["jolit.com.ar", "https://jolit.com.ar"]);

    assert.equal(permitidos.has("jolit.com.ar"), true);
    assert.equal(permitidos.has("https://www.jolit.com.ar"), true);
  });
});

// "www.localhost" no existe, y tampoco "www.127.0.0.1". Ensuciaban la lista
// de origenes autorizados sin agregar nada.
describe("variantes que no corresponden", () => {
  it("no inventa www para localhost ni para una IP", () => {
    const permitidos = conYSinWww([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);

    assert.deepEqual(
      [...permitidos].sort(),
      ["http://127.0.0.1:5173", "http://localhost:5173"]
    );
  });

  it("sigue agregandola para un dominio de verdad", () => {
    assert.equal(
      conYSinWww(["https://jolit.com.ar"]).has("https://www.jolit.com.ar"),
      true
    );
  });
});
