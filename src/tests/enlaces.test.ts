import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slugify } from "../lib/slug.js";

/**
 * El campo "Enlace" del panel es libre, y en la tienda alguien escribio
 * "Acero Blanco" en el de la categoria AROS. Quedo un enlace con una
 * mayuscula y un espacio: anda porque el navegador lo codifica, pero deja
 * URLs como ?category=Acero%20Blanco y se rompe apenas alguien lo arma a
 * mano. Ahora lo que se carga se normaliza igual que si saliera del nombre.
 */
const resolverSlug = (nombre: string, pedido?: string | null) =>
  (pedido?.trim() ? slugify(pedido) : "") || slugify(nombre);

describe("enlace de una categoria o material", () => {
  it("normaliza lo que se escribe a mano", () => {
    assert.equal(resolverSlug("AROS", "Acero Blanco"), "acero-blanco");
    assert.equal(resolverSlug("AROS", "  AROS  "), "aros");
    assert.equal(resolverSlug("Aros", "Plata 925"), "plata-925");
  });

  it("sale del nombre cuando no se carga nada", () => {
    assert.equal(resolverSlug("ACERO BLANCO"), "acero-blanco");
    assert.equal(resolverSlug("Aros", ""), "aros");
    assert.equal(resolverSlug("Aros", "   "), "aros");
  });

  it("cae en el nombre si lo escrito no deja letras ni numeros", () => {
    assert.equal(resolverSlug("Anillos", "!!!"), "anillos");
    assert.equal(resolverSlug("Anillos", "---"), "anillos");
  });

  it("saca los acentos, que en una URL dan problemas", () => {
    assert.equal(resolverSlug("Niños"), "ninos");
    assert.equal(resolverSlug("Aros", "Plata Laminada – Lágrima"), "plata-laminada-lagrima");
  });

  it("no deja guiones sueltos en las puntas", () => {
    assert.equal(resolverSlug("Aros", " - aros - "), "aros");
  });
});
