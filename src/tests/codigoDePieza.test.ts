import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  armarCodigo,
  normalizarCodigo,
  numeroDeCodigo,
  prefijoDeCategoria,
  siguienteCodigo,
} from "../lib/codigoDePieza.js";

/**
 * El codigo identifica una pieza fisica. Si dos joyas terminan con el mismo,
 * se manda la equivocada: es el error que este archivo trata de evitar.
 */

describe("prefijoDeCategoria", () => {
  it("toma tres letras de la categoria", () => {
    assert.equal(prefijoDeCategoria("Anillos"), "ANI");
    assert.equal(prefijoDeCategoria("Pulseras"), "PUL");
    assert.equal(prefijoDeCategoria("Aros"), "ARO");
  });

  it("distingue categorias que empiezan igual", () => {
    // Con dos letras, "collares" y "corbateros" darian las dos "CO".
    assert.notEqual(
      prefijoDeCategoria("Collares"),
      prefijoDeCategoria("Corbateros")
    );
  });

  it("el prefijo se reconoce de un vistazo", () => {
    // Se probo saltear I, O y L y "Anillos" daba "ANS": irreconocible.
    assert.equal(prefijoDeCategoria("Llaveros"), "LLA");
    assert.equal(prefijoDeCategoria("Collares"), "COL");
  });

  it("aguanta tildes, enes y nombres cortos", () => {
    assert.equal(prefijoDeCategoria("Dijes"), "DIJ");
    assert.match(prefijoDeCategoria("Ñandú"), /^[A-Z]{3}$/);
    assert.match(prefijoDeCategoria("Ax"), /^[A-Z]{3}$/);
    assert.match(prefijoDeCategoria(""), /^[A-Z]{3}$/);
  });
});

describe("siguienteCodigo", () => {
  it("empieza en uno cuando la categoria esta vacia", () => {
    assert.equal(siguienteCodigo("Anillos", []), "ANI-0001");
  });

  it("sigue desde el mayor que ya existe", () => {
    const codigos = ["ANI-0001", "ANI-0002", "ANI-0003"];
    assert.equal(siguienteCodigo("Anillos", codigos), "ANI-0004");
  });

  it("no reusa los huecos que dejan las piezas borradas", () => {
    // Reusar el 2 haria que un pedido viejo apunte a otra joya.
    const codigos = ["ANI-0001", "ANI-0003"];
    assert.equal(siguienteCodigo("Anillos", codigos), "ANI-0004");
  });

  it("cuenta por categoria, no en general", () => {
    const codigos = ["COL-0001", "COL-0002", "COL-0050"];
    assert.equal(siguienteCodigo("Anillos", codigos), "ANI-0001");
    assert.equal(siguienteCodigo("Collares", codigos), "COL-0051");
  });

  it("ignora codigos cargados a mano con otro formato", () => {
    const codigos = ["ANI-0001", "amatista-77", "XYZ", "ANI-0002"];
    assert.equal(siguienteCodigo("Anillos", codigos), "ANI-0003");
  });

  it("nunca devuelve uno que ya este en uso", () => {
    const codigos: string[] = [];

    for (let i = 0; i < 30; i += 1) {
      const nuevo = siguienteCodigo("Anillos", codigos);
      assert.ok(!codigos.includes(nuevo), `se repitio ${nuevo}`);
      codigos.push(nuevo);
    }

    assert.equal(codigos.length, new Set(codigos).size);
  });

  it("pasa de los 9999 sin romper el orden", () => {
    assert.equal(siguienteCodigo("Anillos", ["ANI-9999"]), "ANI-10000");
  });
});

describe("numeroDeCodigo", () => {
  it("lee el numero de su propia serie", () => {
    assert.equal(numeroDeCodigo("ANI-0042", "ANI"), 42);
  });

  it("ignora el de otra categoria", () => {
    assert.equal(numeroDeCodigo("COL-0042", "ANI"), null);
  });

  it("ignora lo que no tenga el formato", () => {
    assert.equal(numeroDeCodigo("ANI-XX", "ANI"), null);
    assert.equal(numeroDeCodigo("", "ANI"), null);
  });
});

describe("normalizarCodigo", () => {
  it("guarda siempre igual lo que se escribe a mano", () => {
    assert.equal(normalizarCodigo(" ani-0042 "), "ANI-0042");
    assert.equal(normalizarCodigo("ANI 0042"), "ANI0042");
  });
});

describe("armarCodigo", () => {
  it("completa con ceros para que ordenen bien", () => {
    assert.equal(armarCodigo("ANI", 7), "ANI-0007");
    assert.equal(armarCodigo("ANI", 1234), "ANI-1234");
  });
});
