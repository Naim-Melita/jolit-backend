import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Order, StoreSettings } from "../types.js";

process.env.RESEND_API_KEY = "test";
process.env.EMAIL_FROM = "Jolit <pedidos@jolit.com>";
process.env.OWNER_EMAIL = "tienda@jolit.com";

const { notifyNewOrder, notifyOrderPaid } = await import(
  "../services/notifications.service.js"
);

const settings = {
  storeName: "Jolit",
  whatsappNumber: "5491131134189",
  seller: {
    legalName: "Ana Perez",
    taxId: "27-12345678-4",
    address: "Av Siempreviva 742",
    email: "hola@jolit.com",
    dataFiscalUrl: "",
  },
  payments: { installmentsMinimum: 45000 },
  shipping: {
    provider: "Correo Argentino",
    service: "PAQ.AR",
    freeShippingMinimum: 100000,
    cabaRate: 2500,
    gbaRate: 3500,
    interiorRate: 5500,
  },
  promoBanner: {
    enabled: false,
    title: "",
    message: "",
    ctaLabel: "",
    ctaUrl: "",
    startsAt: "",
    endsAt: "",
  },
} satisfies StoreSettings;

const order = {
  id: 99,
  orderNumber: "JOL-00099",
  customerName: "Sofia Navarro",
  customerEmail: "sofia@ejemplo.com",
  customerPhone: "1144332211",
  shippingAddress: "Av Colon 1200",
  shippingCity: "Cordoba",
  shippingPostalCode: "5000",
  shippingCountry: "Argentina",
  shippingProvider: "Correo Argentino",
  shippingService: "PAQ.AR",
  shippingCost: "5500.00",
  shippingEta: "3 a 7 dias habiles",
  shippingTrackingNumber: "",
  shippingTrackingUrl: "",
  status: "paid",
  paymentId: "1351272661",
  paymentStatus: "approved",
  paidAt: null,
  subtotalAmount: "55999.98",
  totalAmount: "61499.98",
  items: [
    {
      id: 1,
      productId: 4,
      slug: "aros",
      name: "Aros Perla Elegance",
      price: "27999.99",
      quantity: 2,
      subtotal: "55999.98",
    },
  ],
  events: [],
  createdAt: "",
  updatedAt: "",
} as unknown as Order;

let enviados: Array<Record<string, any>>;

beforeEach(() => {
  enviados = [];
  globalThis.fetch = (async (_url: any, init: any) => {
    enviados.push(JSON.parse(init.body));
    return { ok: true, status: 200, text: async () => "" } as any;
  }) as any;
});

const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("notifyNewOrder", () => {
  it("le escribe solo a la clienta: el pedido todavia no se pago", async () => {
    await notifyNewOrder(order, "Jolit");

    assert.equal(enviados.length, 1);
    assert.deepEqual(enviados[0].to, ["sofia@ejemplo.com"]);
  });

  it("muestra el costo y el plazo de envio", async () => {
    await notifyNewOrder(order, "Jolit");

    const cuerpo = texto(enviados[0].html);
    assert.match(cuerpo, /\$5\.500,00/);
    assert.match(cuerpo, /3 a 7 dias habiles/);
    assert.match(cuerpo, /Correo Argentino PAQ\.AR/);
  });
});

describe("notifyOrderPaid", () => {
  it("avisa a la clienta y a la tienda", async () => {
    await notifyOrderPaid(order, settings);

    assert.equal(enviados.length, 2);
    assert.deepEqual(enviados[0].to, ["sofia@ejemplo.com"]);
    assert.deepEqual(enviados[1].to, ["tienda@jolit.com"]);
  });

  it("pone el monto cobrado en el asunto del aviso a la tienda", async () => {
    await notifyOrderPaid(order, settings);

    const tienda = enviados[1];
    assert.match(tienda.subject, /Cobraste \$61\.499,98/);
    assert.match(tienda.subject, /JOL-00099/);
  });

  it("solo adjunta el comprobante en el mail de la clienta", async () => {
    await notifyOrderPaid(order, settings);

    assert.equal(enviados[0].attachments.length, 1);
    assert.equal(enviados[1].attachments, undefined);
  });

  it("le da a la tienda lo que necesita para despachar y conciliar", async () => {
    await notifyOrderPaid(order, settings);

    const cuerpo = texto(enviados[1].html);
    assert.match(cuerpo, /Aros Perla Elegance/);
    assert.match(cuerpo, /Av Colon 1200/);
    assert.match(cuerpo, /sofia@ejemplo\.com/);
    assert.match(cuerpo, /1351272661/);
  });

  it("cruza los reply-to para poder contestar de una", async () => {
    await notifyOrderPaid(order, settings);

    assert.equal(enviados[0].reply_to, "tienda@jolit.com");
    assert.equal(enviados[1].reply_to, "sofia@ejemplo.com");
  });

  it("no manda el aviso a la tienda si no hay OWNER_EMAIL", async () => {
    const previo = process.env.OWNER_EMAIL;
    delete process.env.OWNER_EMAIL;

    try {
      await notifyOrderPaid(order, settings);
      assert.equal(enviados.length, 1);
      assert.deepEqual(enviados[0].to, ["sofia@ejemplo.com"]);
    } finally {
      process.env.OWNER_EMAIL = previo;
    }
  });
});
