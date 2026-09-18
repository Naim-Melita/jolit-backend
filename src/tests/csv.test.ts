import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { leerCsv } from "../lib/csv.js";
import { leerPrecio } from "../lib/precio.js";

/**
 * El lector de CSV es la parte fragil de la carga masiva: si parte mal una
 * descripcion, el producto entra con el texto cortado y hay que corregirlo a
 * mano. Estos casos son los que de verdad aparecen al exportar de Excel o de
 * Google Sheets.
 */

describe("leerCsv", () => {
  it("lee un archivo simple", () => {
    const filas = leerCsv("nombre,precio\nAros Perla,27999.99\nCollar Luna,15000");

    assert.equal(filas.length, 2);
    assert.deepEqual(filas[0], { nombre: "Aros Perla", precio: "27999.99" });
    assert.equal(filas[1].nombre, "Collar Luna");
  });

  it("no parte una descripcion que tiene comas", () => {
    const filas = leerCsv(
      'nombre,descripcion\nAros,"Acero quirurgico, con perla natural, no se oxida"'
    );

    assert.equal(
      filas[0].descripcion,
      "Acero quirurgico, con perla natural, no se oxida"
    );
  });

  it("soporta comillas adentro del texto", () => {
    const filas = leerCsv(
      'nombre,descripcion\nAnillo,"Talle ""M"" ajustable"'
    );

    assert.equal(filas[0].descripcion, 'Talle "M" ajustable');
  });

  it("soporta saltos de linea dentro de un campo", () => {
    const filas = leerCsv(
      'nombre,descripcion\nCollar,"Primera linea\nSegunda linea"\nAros,Simple'
    );

    assert.equal(filas.length, 2);
    assert.equal(filas[0].descripcion, "Primera linea\nSegunda linea");
    assert.equal(filas[1].nombre, "Aros");
  });

  it("entiende el punto y coma, que es como exporta Excel en castellano", () => {
    const filas = leerCsv("nombre;precio;stock\nAros Perla;27999,99;1");

    assert.equal(filas[0].nombre, "Aros Perla");
    assert.equal(filas[0].precio, "27999,99");
    assert.equal(filas[0].stock, "1");
  });

  it("aguanta finales de linea de Windows", () => {
    const filas = leerCsv("nombre,precio\r\nAros,100\r\nCollar,200\r\n");

    assert.equal(filas.length, 2);
    assert.equal(filas[1].nombre, "Collar");
  });

  it("ignora la marca invisible que agrega Excel al principio", () => {
    const filas = leerCsv("﻿nombre,precio\nAros,100");

    assert.equal(filas[0].nombre, "Aros");
    assert.ok(!("﻿nombre" in filas[0]), "la primera columna quedo con basura");
  });

  it("salta las lineas en blanco del final", () => {
    const filas = leerCsv("nombre,precio\nAros,100\n\n\n");

    assert.equal(filas.length, 1);
  });

  it("no se cae si a una fila le faltan columnas", () => {
    const filas = leerCsv("nombre,precio,stock\nAros,100");

    assert.equal(filas[0].stock, "");
  });

  it("acepta los titulos en mayusculas o con espacios", () => {
    const filas = leerCsv(" Nombre , PRECIO \nAros,100");

    assert.equal(filas[0].nombre, "Aros");
    assert.equal(filas[0].precio, "100");
  });

  it("devuelve vacio con un archivo vacio", () => {
    assert.deepEqual(leerCsv(""), []);
    assert.deepEqual(leerCsv("   \n  "), []);
  });
});

describe("leerPrecio", () => {
  const casos: Array<[string, number | null]> = [
    ["27999.99", 27999.99],
    ["27999,99", 27999.99],
    ["27.999,99", 27999.99],
    ["27,999.99", 27999.99],
    ["$ 27.999,99", 27999.99],
    ["$27999", 27999],
    ["27.999", 27999],
    ["27,999", 27999],
    ["1.234.567,89", 1234567.89],
    ["100", 100],
    ["0,5", 0.5],
    ["", null],
    ["  ", null],
    ["gratis", null],
  ];

  for (const [entrada, esperado] of casos) {
    it(`"${entrada}" -> ${esperado}`, () => {
      assert.equal(leerPrecio(entrada), esperado);
    });
  }

  it("un precio de miles nunca se lee como centavos", () => {
    // El error caro: cargar una joya de 27 mil a 27 pesos.
    for (const escrito of ["27.999", "27999", "$ 27.999", "27.999,00"]) {
      assert.ok(
        (leerPrecio(escrito) ?? 0) >= 27999,
        `"${escrito}" se leyo como ${leerPrecio(escrito)}`
      );
    }
  });
});
