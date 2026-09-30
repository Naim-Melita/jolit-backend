import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  armarCodigo,
  normalizarCodigo,
  numeroDeCodigo,
  prefijoDeCategoria,
  prefijoDeMaterial,
  prefijoLibre,
  serieDe,
  siguienteCodigo,
} from "../lib/codigoDePieza.js";

// El codigo va pegado en la pieza: si cambia la forma de generarlo, las
// etiquetas que ya estan puestas dejan de coincidir con la lista.
describe("prefijoDeCategoria", () => {
  it("toma las tres primeras letras: en un tipo de pieza distingue el principio", () => {
    assert.equal(prefijoDeCategoria("Anillos"), "ANI");
    assert.equal(prefijoDeCategoria("Aros"), "ARO");
    assert.equal(prefijoDeCategoria("Collares"), "COL");
    assert.equal(prefijoDeCategoria("Tobilleras"), "TOB");
    assert.equal(prefijoDeCategoria("Dijes"), "DIJ");
  });

  it("ignora acentos, mayusculas y lo que no sea letra", () => {
    assert.equal(prefijoDeCategoria("  aros  "), "ARO");
    assert.equal(prefijoDeCategoria("Órbitas"), "ORB");
    assert.equal(prefijoDeCategoria("A-R-O-S"), "ARO");
  });

  it("rellena los nombres cortos y cae en GEN si no hay letras", () => {
    assert.equal(prefijoDeCategoria("Ab"), "ABX");
    assert.equal(prefijoDeCategoria("123"), "GEN");
    assert.equal(prefijoDeCategoria(""), "GEN");
  });
});

describe("prefijoDeMaterial", () => {
  // Al reves que la categoria, y a proposito: "Acero blanco" y "Acero dorado"
  // empiezan igual, asi que con las tres primeras letras los dos darian ACE.
  it("mira la ultima palabra, que es la que distingue el material", () => {
    assert.equal(prefijoDeMaterial("Acero blanco"), "BLA");
    assert.equal(prefijoDeMaterial("Acero dorado"), "DOR");
    assert.equal(prefijoDeMaterial("Acero quirurgico"), "QUI");
  });

  it("descarta las palabras sin letras: 'Plata 925' es PLA", () => {
    assert.equal(prefijoDeMaterial("Plata 925"), "PLA");
    assert.equal(prefijoDeMaterial("Plata"), "PLA");
  });

  it("no deja que dos materiales de acero choquen", () => {
    const prefijos = ["Acero blanco", "Acero dorado", "Acero quirurgico"].map(
      prefijoDeMaterial
    );

    assert.equal(new Set(prefijos).size, 3);
  });
});

describe("serieDe y armarCodigo", () => {
  it("arma el codigo con material", () => {
    assert.equal(armarCodigo(serieDe("ARO", "BLA"), 1), "ARO-BLA-0001");
    assert.equal(armarCodigo(serieDe("ANI", "DOR"), 7), "ANI-DOR-0007");
  });

  // Las piezas cargadas antes de que existiera el material no tienen ninguno:
  // su codigo viejo tiene que seguir siendo valido.
  it("sin material queda el formato viejo", () => {
    assert.equal(armarCodigo(serieDe("ARO", null), 1), "ARO-0001");
    assert.equal(armarCodigo(serieDe("ARO"), 42), "ARO-0042");
  });
});

describe("siguienteCodigo", () => {
  it("empieza en 0001 cuando la serie esta vacia", () => {
    assert.equal(siguienteCodigo("ARO", "BLA", []), "ARO-BLA-0001");
  });

  it("sigue desde el mayor de la serie", () => {
    assert.equal(
      siguienteCodigo("ARO", "BLA", ["ARO-BLA-0001", "ARO-BLA-0002"]),
      "ARO-BLA-0003"
    );
  });

  // Cada par tipo + material lleva su propia numeracion: los aros de plata
  // no heredan el numero de los de acero.
  it("no mezcla series distintas", () => {
    const deAcero = ["ARO-BLA-0001", "ARO-BLA-0002", "ARO-BLA-0003"];

    assert.equal(siguienteCodigo("ARO", "PLA", deAcero), "ARO-PLA-0001");
    assert.equal(siguienteCodigo("ANI", "BLA", deAcero), "ANI-BLA-0001");
  });

  // Reusar el hueco de una pieza borrada haria que un codigo apunte a dos
  // joyas distintas en pedidos viejos, que ya estan impresos.
  it("no reusa los huecos que dejan las piezas borradas", () => {
    assert.equal(
      siguienteCodigo("ARO", "BLA", ["ARO-BLA-0001", "ARO-BLA-0005"]),
      "ARO-BLA-0006"
    );
  });

  it("ignora los codigos cargados a mano con otro formato", () => {
    assert.equal(
      siguienteCodigo("ARO", "BLA", ["PROVEEDOR-77", "", "ARO-BLA-0002"]),
      "ARO-BLA-0003"
    );
  });

  it("convive con los codigos viejos de la misma categoria", () => {
    // ARO-0001 es del formato viejo y no pertenece a la serie ARO-BLA.
    assert.equal(siguienteCodigo("ARO", "BLA", ["ARO-0009"]), "ARO-BLA-0001");
    assert.equal(siguienteCodigo("ARO", null, ["ARO-0009"]), "ARO-0010");
  });
});

describe("numeroDeCodigo", () => {
  it("lee el numero de su propia serie y nada mas", () => {
    assert.equal(numeroDeCodigo("ARO-BLA-0042", "ARO-BLA"), 42);
    assert.equal(numeroDeCodigo("ARO-PLA-0042", "ARO-BLA"), null);
    assert.equal(numeroDeCodigo("ARO-0042", "ARO-BLA"), null);
    assert.equal(numeroDeCodigo("cualquier cosa", "ARO-BLA"), null);
  });
});

describe("prefijoLibre", () => {
  it("devuelve el natural cuando nadie lo usa", () => {
    assert.equal(prefijoLibre("COL", ["ANI", "ARO"]), "COL");
  });

  // "Collares" y "Colgantes" dan las dos COL. La segunda lleva numero, igual
  // que hace la migracion, para que no dependa de cual se creo antes.
  it("numera desde la segunda letra cuando esta tomado", () => {
    assert.equal(prefijoLibre("COL", ["COL"]), "CO2");
    assert.equal(prefijoLibre("COL", ["COL", "CO2"]), "CO3");
  });

  it("no le importan las mayusculas de los que ya estan", () => {
    assert.equal(prefijoLibre("COL", ["col"]), "CO2");
  });
});

describe("normalizarCodigo", () => {
  it("deja una sola forma de escribir el mismo codigo", () => {
    assert.equal(normalizarCodigo("  aro-bla-0001 "), "ARO-BLA-0001");
    assert.equal(normalizarCodigo("ARO BLA 0001"), "AROBLA0001");
  });
});
