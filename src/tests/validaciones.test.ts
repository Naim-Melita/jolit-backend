import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esCodigoPostal,
  esCuit,
  esNombreDePersona,
  esTelefono,
} from "../lib/validaciones.js";
import { orderSchema } from "../validations/orders.validation.js";
import { settingsSchema } from "../validations/settings.validation.js";

// Lo que se rompia: los campos solo median largo, asi que un nombre podia ser
// "12" y un telefono "hola mundo". El pedido entraba igual.
describe("esNombreDePersona", () => {
  it("acepta nombres con acentos, apostrofes y guiones", () => {
    for (const nombre of [
      "Ana Perez",
      "Ma. Jose O'Brien-Perez",
      "Ñandu Iñiguez",
      "Jean-Luc",
    ]) {
      assert.equal(esNombreDePersona(nombre), true, nombre);
    }
  });

  it("rechaza numeros donde va el nombre", () => {
    for (const nombre of ["12", "123456", "Ana 2", "", " ", "-", "1425"]) {
      assert.equal(esNombreDePersona(nombre), false, nombre);
    }
  });
});

describe("esTelefono", () => {
  it("acepta las formas en que se escribe un telefono", () => {
    for (const telefono of [
      "1122334455",
      "+54 9 11 2233-4455",
      "(011) 2233 4455",
      "351 555 1234",
    ]) {
      assert.equal(esTelefono(telefono), true, telefono);
    }
  });

  it("rechaza letras y numeros que no alcanzan", () => {
    for (const telefono of ["hola mundo", "11 2233 hola", "1234567", ""]) {
      assert.equal(esTelefono(telefono), false, telefono);
    }
  });
});

describe("esCodigoPostal", () => {
  it("acepta el de 4 digitos y el CPA", () => {
    for (const cp of ["1425", "5000", "C1425DYB", "c1425dyb"]) {
      assert.equal(esCodigoPostal(cp), true, cp);
    }
  });

  // Seis digitos entraban y caian en "interior": se le cobraba de mas a
  // alguien de CABA sin que nadie lo notara.
  it("rechaza largos que no existen y texto suelto", () => {
    for (const cp of ["123", "123456", "abcd", "CABA", "14 25 99"]) {
      assert.equal(esCodigoPostal(cp), false, cp);
    }
  });
});

describe("esCuit", () => {
  it("acepta un CUIT cuyo digito verificador cierra", () => {
    assert.equal(esCuit("27366300681"), true);
    assert.equal(esCuit("27-36630068-1"), true);
  });

  // El caso real: se cargo el prefijo equivocado. Once digitos, pero el
  // verificador no daba. Antes se imprimia asi en el comprobante.
  it("rechaza un CUIT con un digito cambiado", () => {
    assert.equal(esCuit("20366300681"), false);
  });

  it("rechaza texto y largos que no son 11 digitos", () => {
    for (const cuit of ["hola", "", "2736630068", "273663006812"]) {
      assert.equal(esCuit(cuit), false, cuit);
    }
  });
});

const pedidoValido = {
  customerName: "Ana Perez",
  customerEmail: "ana@ejemplo.com",
  customerPhone: "11 2233 4455",
  shippingAddress: "Av Corrientes 1234",
  shippingCity: "CABA",
  shippingPostalCode: "1425",
  items: [{ productId: 1, quantity: 1 }],
};

describe("orderSchema", () => {
  it("deja pasar un pedido normal", () => {
    assert.equal(orderSchema.safeParse(pedidoValido).success, true);
  });

  it("frena numeros en el nombre y letras en el telefono", () => {
    const casos = [
      { customerName: "123456" },
      { customerPhone: "no tengo" },
      { shippingPostalCode: "abcd" },
      { shippingCity: "1425" },
    ];

    for (const caso of casos) {
      const resultado = orderSchema.safeParse({ ...pedidoValido, ...caso });
      assert.equal(resultado.success, false, JSON.stringify(caso));
    }
  });

  it("no exige los datos de envio que son opcionales", () => {
    const resultado = orderSchema.safeParse({
      ...pedidoValido,
      shippingAddress: "",
      shippingCity: "",
      shippingPostalCode: "",
    });

    assert.equal(resultado.success, true);
  });
});

const configuracionValida = {
  storeName: "Jolit",
  whatsappNumber: "1122334455",
  promoBanner: { enabled: false },
};

describe("settingsSchema", () => {
  it("acepta los datos fiscales vacios: cargarlos es opcional", () => {
    assert.equal(settingsSchema.safeParse(configuracionValida).success, true);
  });

  it("frena un CUIT invalido antes de que llegue al comprobante", () => {
    const resultado = settingsSchema.safeParse({
      ...configuracionValida,
      seller: { taxId: "20366300681" },
    });

    assert.equal(resultado.success, false);
  });

  it("frena un Data Fiscal que no es un enlace", () => {
    const resultado = settingsSchema.safeParse({
      ...configuracionValida,
      seller: { dataFiscalUrl: "completar" },
    });

    assert.equal(resultado.success, false);
  });
});
