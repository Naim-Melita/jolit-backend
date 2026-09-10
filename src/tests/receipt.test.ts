import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOrderReceiptPdf, receiptFileName } from "../services/receipt.service.js";
import type { Order, StoreSettings } from "../types.js";

const settings = {
  storeName: "Jolit",
  whatsappNumber: "5491131134189",
  seller: {
    legalName: "Ana Perez",
    taxId: "27-12345678-4",
    address: "Av Siempreviva 742, CABA",
    email: "hola@jolit.com",
    dataFiscalUrl: "https://arca.gob.ar/f960/123",
  },
  payments: {
    installmentsMinimum: 45000,
  },
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
  id: 12,
  orderNumber: "JOL-00012",
  customerName: "Sofia Navarro",
  customerEmail: "sofia@example.com",
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
  subtotalAmount: "55999.98",
  totalAmount: "61499.98",
  items: [
    {
      id: 1,
      productId: 4,
      slug: "aros-perla-elegance",
      name: "Aros Perla Elegance",
      price: "27999.99",
      quantity: 2,
      subtotal: "55999.98",
    },
  ],
  events: [],
  createdAt: "2026-09-03T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
} as unknown as Order;

describe("buildOrderReceiptPdf", () => {
  it("devuelve un PDF valido", async () => {
    const pdf = await buildOrderReceiptPdf(order, settings);

    assert.ok(Buffer.isBuffer(pdf));
    assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.ok(pdf.length > 1000, `el PDF quedo demasiado chico: ${pdf.length} bytes`);
  });

  it("no explota cuando todavia no se cargaron los datos del vendedor", async () => {
    const sinDatos = {
      ...settings,
      seller: {
        legalName: "",
        taxId: "",
        address: "",
        email: "",
        dataFiscalUrl: "",
      },
    } satisfies StoreSettings;

    const pdf = await buildOrderReceiptPdf(order, sinDatos);

    assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  it("soporta pedidos con varios items y envio gratis", async () => {
    const gratis = {
      ...order,
      shippingCost: "0.00",
      items: Array.from({ length: 12 }, (_, index) => ({
        ...order.items[0],
        id: index + 1,
        name: `Producto de prueba numero ${index + 1}`,
      })),
    } as unknown as Order;

    const pdf = await buildOrderReceiptPdf(gratis, settings);

    assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  });
});

describe("receiptFileName", () => {
  it("nombra el archivo con el numero de pedido", () => {
    assert.equal(receiptFileName(order), "comprobante-JOL-00012.pdf");
  });
});

describe("notifyOrderPaid", () => {
  it("manda el mail a la clienta con el comprobante adjunto en base64", async () => {
    process.env.RESEND_API_KEY = "test";
    process.env.EMAIL_FROM = "Jolit <pedidos@jolit.com>";
    process.env.OWNER_EMAIL = "duenia@jolit.com";

    const { notifyOrderPaid } = await import("../services/notifications.service.js");

    const enviados: Array<Record<string, any>> = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: any, init: any) => {
      enviados.push(JSON.parse(init.body));
      return { ok: true, status: 200, text: async () => "" } as any;
    }) as any;

    try {
      const ok = await notifyOrderPaid(order, settings);

      assert.equal(ok, true);
      // Dos mails: el de la clienta con el comprobante y el aviso de cobro a
      // la tienda. Aca solo nos interesa el primero.
      assert.equal(enviados.length, 2);

      const mail = enviados[0];
      assert.deepEqual(mail.to, ["sofia@example.com"]);
      assert.equal(mail.reply_to, "duenia@jolit.com");
      assert.match(mail.subject, /JOL-00012/);

      assert.equal(mail.attachments.length, 1);
      assert.equal(mail.attachments[0].filename, "comprobante-JOL-00012.pdf");

      const decodificado = Buffer.from(mail.attachments[0].content, "base64");
      assert.equal(decodificado.subarray(0, 5).toString("latin1"), "%PDF-");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
