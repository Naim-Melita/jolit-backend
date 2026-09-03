import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quoteCorreoArgentino } from "../lib/correoArgentino.js";
import { toMoney } from "../lib/money.js";
import { slugify } from "../lib/slug.js";

const rates = {
  freeShippingMinimum: 100000,
  cabaRate: 2500,
  gbaRate: 3500,
  interiorRate: 5500,
};

// El costo de envio se cobra de verdad, asi que estas son las funciones que
// mas caro salen si se rompen sin que nadie se entere.
describe("quoteCorreoArgentino", () => {
  it("cobra tarifa CABA para codigos postales de 1000 a 1499", () => {
    const quote = quoteCorreoArgentino(
      { postalCode: "1425", subtotal: 10000 },
      rates
    );

    assert.equal(quote.cost, 2500);
    assert.match(quote.label, /CABA/);
  });

  it("cobra tarifa GBA para codigos postales de 1500 a 1999", () => {
    const quote = quoteCorreoArgentino(
      { postalCode: "1888", subtotal: 10000 },
      rates
    );

    assert.equal(quote.cost, 3500);
  });

  it("cobra tarifa interior para el resto", () => {
    const quote = quoteCorreoArgentino(
      { postalCode: "5000", subtotal: 10000 },
      rates
    );

    assert.equal(quote.cost, 5500);
  });

  it("bonifica el envio al llegar al minimo", () => {
    const quote = quoteCorreoArgentino(
      { postalCode: "5000", subtotal: 100000 },
      rates
    );

    assert.equal(quote.cost, 0);
  });

  it("no bonifica un peso por debajo del minimo", () => {
    const quote = quoteCorreoArgentino(
      { postalCode: "5000", subtotal: 99999 },
      rates
    );

    assert.equal(quote.cost, 5500);
  });

  it("cae en interior cuando no hay codigo postal ni texto reconocible", () => {
    const quote = quoteCorreoArgentino({ subtotal: 10000 }, rates);

    assert.equal(quote.cost, 5500);
  });

  it("reconoce CABA por texto cuando no hay codigo postal", () => {
    const quote = quoteCorreoArgentino(
      { city: "Ciudad Autonoma de Buenos Aires", subtotal: 10000 },
      rates
    );

    assert.equal(quote.cost, 2500);
  });

  it("avisa que la cotizacion es estimada mientras no haya convenio", () => {
    const quote = quoteCorreoArgentino({ postalCode: "1425", subtotal: 0 }, rates);

    assert.equal(quote.isEstimated, true);
    assert.equal(quote.configured, false);
  });
});

describe("toMoney", () => {
  it("deja siempre dos decimales", () => {
    assert.equal(toMoney(1000), "1000.00");
    assert.equal(toMoney("27999.9"), "27999.90");
  });

  it("redondea a dos decimales", () => {
    assert.equal(toMoney(10.005), "10.01");
    assert.equal(toMoney(10.004), "10.00");
  });

  it("acepta lo que devuelve Prisma para Decimal", () => {
    assert.equal(toMoney({ toString: () => "55999.98" }), "55999.98");
  });
});

describe("slugify", () => {
  it("saca acentos y espacios", () => {
    assert.equal(slugify("Anillo Corazón Rosé"), "anillo-corazon-rose");
  });

  it("no deja guiones sueltos en los bordes", () => {
    const slug = slugify("  ¡Aros de plata!  ");

    assert.ok(!slug.startsWith("-"), `empieza con guion: ${slug}`);
    assert.ok(!slug.endsWith("-"), `termina con guion: ${slug}`);
  });
});
