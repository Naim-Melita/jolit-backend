import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { armarBulto, masBarata, olvidarToken } from "../lib/micorreo.js";
import { quoteCorreoArgentino } from "../lib/correoArgentino.js";
import { cotizarEnvio } from "../services/shipping.service.js";

const CONFIG = {
  freeShippingMinimum: 100000,
  cabaRate: 2500,
  gbaRate: 3500,
  interiorRate: 5500,
  patagoniaRate: 8500,
  originPostalCode: "1425",
  gramsPerItem: 60,
  packageHeight: 4,
  packageWidth: 15,
  packageLength: 20,
};

const fetchOriginal = globalThis.fetch;

/** Deja el entorno como estaba: estas pruebas tocan variables globales. */
function limpiar() {
  globalThis.fetch = fetchOriginal;
  olvidarToken();
  delete process.env.CORREO_ARGENTINO_USER_TOKEN;
  delete process.env.CORREO_ARGENTINO_PASSWORD_TOKEN;
  delete process.env.CORREO_ARGENTINO_CUSTOMER_ID;
}

afterEach(limpiar);

function configurar() {
  process.env.CORREO_ARGENTINO_USER_TOKEN = "usuario";
  process.env.CORREO_ARGENTINO_PASSWORD_TOKEN = "clave";
  process.env.CORREO_ARGENTINO_CUSTOMER_ID = "123";
}

/** Una API de Correo Argentino de mentira, que responde lo que le digamos. */
function simularApi(respuestas: {
  token?: unknown;
  rates?: unknown;
  fallaEn?: "token" | "rates";
}) {
  globalThis.fetch = (async (url: string | URL) => {
    const ruta = String(url);
    const json = (cuerpo: unknown) =>
      ({ ok: true, status: 200, json: async () => cuerpo }) as Response;

    if (ruta.endsWith("/token")) {
      if (respuestas.fallaEn === "token") {
        return { ok: false, status: 401, text: async () => "no autorizado" } as Response;
      }
      return json(respuestas.token ?? { token: "jwt-de-prueba" });
    }

    if (ruta.endsWith("/rates")) {
      if (respuestas.fallaEn === "rates") {
        return { ok: false, status: 500, text: async () => "se rompio" } as Response;
      }
      return json(respuestas.rates ?? { rates: [] });
    }

    throw new Error("ruta inesperada: " + ruta);
  }) as typeof fetch;
}

// La Patagonia pagaba lo mismo que Cordoba, y Correo Argentino cobra bastante
// mas: cada envio al sur lo terminaba pagando la tienda.
describe("la tabla de respaldo", () => {
  it("cobra la Patagonia aparte del resto del interior", () => {
    const cordoba = quoteCorreoArgentino({ postalCode: "5000", subtotal: 0 }, CONFIG);
    const ushuaia = quoteCorreoArgentino({ postalCode: "9410", subtotal: 0 }, CONFIG);

    assert.equal(cordoba.cost, 5500);
    assert.equal(ushuaia.cost, 8500);
  });

  it("reconoce Rio Negro y Neuquen, que tambien son Patagonia", () => {
    assert.equal(quoteCorreoArgentino({ postalCode: "8400", subtotal: 0 }, CONFIG).cost, 8500);
  });

  // 8000 es Bahia Blanca: provincia de Buenos Aires, no Patagonia.
  it("no se lleva puesta a Bahia Blanca", () => {
    assert.equal(quoteCorreoArgentino({ postalCode: "8000", subtotal: 0 }, CONFIG).cost, 5500);
  });

  it("tambien la reconoce por el texto cuando no hay codigo postal", () => {
    const q = quoteCorreoArgentino({ province: "Tierra del Fuego", subtotal: 0 }, CONFIG);
    assert.equal(q.cost, 8500);
  });
});

describe("cotizarEnvio contra Correo Argentino", () => {
  it("usa el precio real cuando la API contesta", async () => {
    configurar();
    simularApi({
      rates: {
        rates: [
          { deliveredType: "D", productType: "CP", productName: "Clasico", price: 7320, deliveryTimeMin: 3, deliveryTimeMax: 5 },
          { deliveredType: "S", productType: "CP", productName: "Sucursal", price: 4100 },
        ],
      },
    });

    const q = await cotizarEnvio({ postalCode: "9410", subtotal: 20000, units: 2 }, CONFIG);

    assert.equal(q.cost, 7320);
    assert.equal(q.source, "correo-argentino");
    assert.equal(q.isEstimated, false);
    assert.match(q.eta, /3 a 5/);
  });

  // Entrega a domicilio: la de sucursal es mas barata pero no es lo que se
  // ofrece en la caja.
  it("elige la de domicilio aunque la de sucursal sea mas barata", async () => {
    configurar();
    simularApi({
      rates: {
        rates: [
          { deliveredType: "S", productType: "CP", productName: "Sucursal", price: 1000 },
          { deliveredType: "D", productType: "CP", productName: "Domicilio", price: 9000 },
        ],
      },
    });

    const q = await cotizarEnvio({ postalCode: "9410", subtotal: 0, units: 1 }, CONFIG);
    assert.equal(q.cost, 9000);
  });

  it("entre varias a domicilio, se queda con la mas barata", async () => {
    configurar();
    simularApi({
      rates: {
        rates: [
          { deliveredType: "D", productType: "EP", productName: "Expreso", price: 12000 },
          { deliveredType: "D", productType: "CP", productName: "Clasico", price: 7320 },
        ],
      },
    });

    const q = await cotizarEnvio({ postalCode: "9410", subtotal: 0, units: 1 }, CONFIG);
    assert.equal(q.cost, 7320);
  });

  // El minimo para envio gratis lo decide la tienda, no el correo.
  it("el envio gratis se aplica sobre el precio real", async () => {
    configurar();
    simularApi({
      rates: { rates: [{ deliveredType: "D", productType: "CP", productName: "Clasico", price: 7320 }] },
    });

    const q = await cotizarEnvio({ postalCode: "9410", subtotal: 150000, units: 20 }, CONFIG);

    assert.equal(q.cost, 0);
    assert.equal(q.source, "correo-argentino");
  });
});

// Nada de esto puede dejar a una clienta sin poder comprar.
describe("cuando Correo Argentino no esta", () => {
  it("cae a la tabla si no hay credenciales", async () => {
    const q = await cotizarEnvio({ postalCode: "9410", subtotal: 0, units: 1 }, CONFIG);

    assert.equal(q.cost, 8500);
    assert.equal(q.source, "tabla");
    assert.equal(q.isEstimated, true);
  });

  it("cae a la tabla si la API devuelve error", async () => {
    configurar();
    simularApi({ fallaEn: "rates" });

    const q = await cotizarEnvio({ postalCode: "9410", subtotal: 0, units: 1 }, CONFIG);
    assert.equal(q.cost, 8500);
    assert.equal(q.source, "tabla");
  });

  it("cae a la tabla si no deja ni sacar el token", async () => {
    configurar();
    simularApi({ fallaEn: "token" });

    const q = await cotizarEnvio({ postalCode: "5000", subtotal: 0, units: 1 }, CONFIG);
    assert.equal(q.cost, 5500);
    assert.equal(q.source, "tabla");
  });

  it("cae a la tabla si contesta sin ninguna tarifa", async () => {
    configurar();
    simularApi({ rates: { rates: [] } });

    const q = await cotizarEnvio({ postalCode: "5000", subtotal: 0, units: 1 }, CONFIG);
    assert.equal(q.source, "tabla");
  });

  it("cae a la tabla si falta el codigo postal de origen", async () => {
    configurar();
    simularApi({ rates: { rates: [{ deliveredType: "D", productType: "CP", productName: "x", price: 999 }] } });

    const q = await cotizarEnvio(
      { postalCode: "5000", subtotal: 0, units: 1 },
      { ...CONFIG, originPostalCode: "" }
    );

    assert.equal(q.source, "tabla");
  });

  it("cae a la tabla si la clienta no puso codigo postal", async () => {
    configurar();
    simularApi({ rates: { rates: [{ deliveredType: "D", productType: "CP", productName: "x", price: 999 }] } });

    const q = await cotizarEnvio({ province: "Cordoba", subtotal: 0, units: 1 }, CONFIG);
    assert.equal(q.source, "tabla");
  });
});

describe("armarBulto", () => {
  it("multiplica el peso por la cantidad de piezas", () => {
    const b = armarBulto(3, { gramosPorPieza: 60, alto: 4, ancho: 15, largo: 20 });

    assert.equal(b.weight, 180);
    assert.equal(b.width, 15);
    assert.equal(b.length, 20);
  });

  it("nunca se sale de lo que acepta la API", () => {
    const enorme = armarBulto(100000, { gramosPorPieza: 60, alto: 4, ancho: 15, largo: 20 });

    assert.ok(enorme.weight <= 50000, "el peso no puede pasar de 50000 g");
    assert.ok(enorme.height <= 200, "el alto no puede pasar de 200 cm");
  });

  it("una pieza como minimo, aunque venga cero", () => {
    assert.equal(armarBulto(0, { gramosPorPieza: 60, alto: 4, ancho: 15, largo: 20 }).weight, 60);
  });
});

describe("masBarata", () => {
  it("devuelve null si no hay ninguna", () => {
    assert.equal(masBarata([]), null);
  });
});

/**
 * Lo que dice el manual oficial de la API MiCorreo.
 *
 * Una primera version se escribio contra la documentacion de un wrapper de
 * terceros y tenia tres cosas mal: mandaba el bulto dentro de un array,
 * cortaba el peso en 25 kg cuando la API acepta 50, y no contemplaba el
 * limite de la suma de los lados.
 */
describe("lo que pide el manual oficial", () => {
  it("manda el bulto como objeto, no como lista", async () => {
    configurar();
    let cuerpoEnviado: any = null;

    globalThis.fetch = (async (url: string | URL, opciones: RequestInit) => {
      const ruta = String(url);
      if (ruta.endsWith("/token")) {
        return { ok: true, status: 200, json: async () => ({ token: "t" }) } as Response;
      }
      cuerpoEnviado = JSON.parse(String(opciones.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          rates: [{ deliveredType: "D", productType: "CP", productName: "Clasico", price: 500 }],
        }),
      } as Response;
    }) as typeof fetch;

    await cotizarEnvio({ postalCode: "1704", subtotal: 0, units: 2 }, CONFIG);

    assert.ok(
      !Array.isArray(cuerpoEnviado.dimensions),
      "dimensions tiene que ser un objeto: el manual lo muestra asi"
    );
    assert.equal(typeof cuerpoEnviado.dimensions.weight, "number");
    assert.equal(cuerpoEnviado.dimensions.weight, 120);
  });

  it("respeta los limites del manual: 50 kg y 200 cm por lado", () => {
    const enorme = armarBulto(100000, {
      gramosPorPieza: 60,
      alto: 500,
      ancho: 500,
      largo: 500,
    });

    assert.ok(enorme.weight <= 50000, "hasta 50000 g");
    assert.ok(enorme.height <= 200, "hasta 200 cm de alto");
    assert.ok(enorme.width <= 200, "hasta 200 cm de ancho");
    assert.ok(enorme.length <= 200, "hasta 200 cm de largo");
  });

  // "La sumatoria total de los lados (maximo 300cm)".
  it("la suma de los tres lados no pasa de 300 cm", () => {
    for (const piezas of [1, 10, 50, 500, 100000]) {
      const b = armarBulto(piezas, { gramosPorPieza: 60, alto: 4, ancho: 15, largo: 20 });
      const suma = b.height + b.width + b.length;

      assert.ok(suma <= 300, `con ${piezas} piezas la suma dio ${suma}`);
    }
  });

  // El manual los documenta como texto: "deliveryTimeMin": "2".
  it("entiende los dias de demora aunque vengan como texto", async () => {
    configurar();
    simularApi({
      rates: {
        rates: [
          {
            deliveredType: "D",
            productType: "CP",
            productName: "Correo Argentino Clasico",
            price: 498.06,
            deliveryTimeMin: "2",
            deliveryTimeMax: "5",
          },
        ],
      },
    });

    const q = await cotizarEnvio({ postalCode: "1704", subtotal: 0, units: 1 }, CONFIG);

    assert.equal(q.cost, 498.06);
    assert.equal(q.eta, "2 a 5 días hábiles");
  });
});
