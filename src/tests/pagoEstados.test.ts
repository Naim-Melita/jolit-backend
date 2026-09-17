// Va primero: la conexion a la base se arma al importar prisma, asi que las
// variables de entorno tienen que estar cargadas antes.
import "dotenv/config";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "../lib/prisma.js";
import { aplicarPagoAlPedido } from "../services/mercadoPagoWebhook.service.js";
import { createOrder, updateOrderStatus } from "../services/orders.service.js";
import type { MercadoPagoPaymentSnapshot } from "../services/payments.service.js";

/**
 * Prueba que el pedido reaccione bien a cada estado que puede devolver
 * Mercado Pago: aprobado, rechazado y pendiente. Es la logica que decide si
 * una venta se cobra o no, asi que no puede depender de probarla a mano con
 * tarjetas cada vez que se toca algo.
 *
 * Usa la base local con un producto propio que se borra al final: no toca el
 * catalogo ni los pedidos de verdad.
 */

const SLUG = "zz-producto-de-prueba-pagos";
const EMAIL = "prueba-pagos@jolit.test";
const PRECIO = 10000;

let productId: number;
let categoryId: number;
let categoriaCreada = false;
let fetchReal: typeof globalThis.fetch;
let mailsEnviados = 0;

before(async () => {
  // A diferencia del resto de los tests, este necesita la base levantada:
  // prueba la transicion de estados de un pedido de verdad.
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Estos tests necesitan DATABASE_URL: levanta PostgreSQL y revisa el .env"
    );
  }

  // Ningun mail de verdad: notifyOrderPaid habla con Resend por fetch.
  fetchReal = globalThis.fetch;
  globalThis.fetch = (async () => {
    mailsEnviados += 1;
    return { ok: true, status: 200, text: async () => "" } as any;
  }) as any;

  const categoria = await prisma.category.findFirst();
  if (categoria) {
    categoryId = categoria.id;
  } else {
    const nueva = await prisma.category.create({
      data: { slug: "zz-prueba", name: "Prueba" },
    });
    categoryId = nueva.id;
    categoriaCreada = true;
  }

  await prisma.product.deleteMany({ where: { slug: SLUG } });

  const producto = await prisma.product.create({
    data: {
      slug: SLUG,
      name: "Producto de prueba (pagos)",
      description: "Se crea y se borra en los tests. No es del catalogo.",
      categoryId,
      prices: { create: { amount: PRECIO, active: true } },
      inventory: { create: { quantity: 500 } },
    },
  });

  productId = producto.id;
});

after(async () => {
  await prisma.orderEvent.deleteMany({
    where: { order: { customerEmail: EMAIL } },
  });
  await prisma.orderItem.deleteMany({ where: { productId } });
  await prisma.order.deleteMany({ where: { customerEmail: EMAIL } });
  await prisma.product.deleteMany({ where: { slug: SLUG } });
  if (categoriaCreada) {
    await prisma.category.deleteMany({ where: { id: categoryId } });
  }

  globalThis.fetch = fetchReal;
  await prisma.$disconnect();
});

/** Crea un pedido nuevo, siempre en "pending", listo para recibir un pago. */
async function pedidoNuevo() {
  return createOrder({
    customerName: "Clienta De Prueba",
    customerEmail: EMAIL,
    customerPhone: "1144332211",
    shippingAddress: "Calle Falsa 123",
    shippingCity: "CABA",
    shippingPostalCode: "1425",
    shippingCountry: "Argentina",
    items: [{ productId, quantity: 1 }],
  });
}

let contador = 0;

/** Arma la respuesta que devolveria Mercado Pago para ese pedido. */
function pagoDe(
  orderId: number,
  total: string,
  status: string,
  paymentId?: string
): MercadoPagoPaymentSnapshot {
  contador += 1;

  return {
    paymentId: paymentId ?? `test-${contador}`,
    status,
    orderId,
    approved: status === "approved",
    paidAmount: Number(total),
  };
}

/**
 * El comprobante se manda sin await para que un mail caido no voltee la venta,
 * asi que su evento aparece un rato despues de que el pedido ya quedo pagado.
 * Sin esperarlo, contar eventos da numeros distintos en cada corrida.
 */
async function esperarComprobante(orderId: number) {
  for (let intento = 0; intento < 60; intento += 1) {
    const listo = await prisma.orderEvent.count({
      where: { orderId, message: { startsWith: "Comprobante" } },
    });

    if (listo > 0) return;

    await new Promise((resolver) => setTimeout(resolver, 100));
  }

  throw new Error("el comprobante nunca quedo registrado");
}

const estadoDe = async (id: number) =>
  prisma.order.findUniqueOrThrow({
    where: { id },
    select: {
      status: true,
      paymentId: true,
      paymentStatus: true,
      paidAt: true,
    },
  });

describe("pago aceptado", () => {
  it("marca el pedido como pagado y guarda el numero de pago", async () => {
    const pedido = await pedidoNuevo();
    const pago = pagoDe(pedido.id, pedido.totalAmount, "approved");

    const resultado = await aplicarPagoAlPedido(pago);

    assert.equal(resultado.paid, true);

    const despues = await estadoDe(pedido.id);
    assert.equal(despues.status, "paid");
    assert.equal(despues.paymentStatus, "approved");
    assert.equal(despues.paymentId, pago.paymentId);
    assert.ok(despues.paidAt, "tendria que quedar la fecha de acreditacion");
  });

  it("deja registrado el cambio en la linea de tiempo del pedido", async () => {
    const pedido = await pedidoNuevo();
    await aplicarPagoAlPedido(pagoDe(pedido.id, pedido.totalAmount, "approved"));

    const eventos = await prisma.orderEvent.findMany({
      where: { orderId: pedido.id },
    });

    assert.ok(
      eventos.length > 0,
      "el pedido tiene que quedar con su historial de estados"
    );
  });

  it("no lo procesa dos veces si Mercado Pago reintenta el aviso", async () => {
    const pedido = await pedidoNuevo();
    const pago = pagoDe(pedido.id, pedido.totalAmount, "approved");

    await aplicarPagoAlPedido(pago);
    await esperarComprobante(pedido.id);

    const eventosPrimera = await prisma.orderEvent.count({
      where: { orderId: pedido.id },
    });
    const mailsPrimera = mailsEnviados;

    const segunda = await aplicarPagoAlPedido(pago);
    assert.equal(segunda.alreadyProcessed, true);

    // Margen por si el reintento hubiera disparado un segundo comprobante,
    // que tambien sale sin await.
    await new Promise((resolver) => setTimeout(resolver, 500));

    assert.equal(
      mailsEnviados,
      mailsPrimera,
      "el reintento no puede volver a mandarle el comprobante a la clienta"
    );
    assert.equal(
      await prisma.orderEvent.count({ where: { orderId: pedido.id } }),
      eventosPrimera,
      "el reintento no puede duplicar el historial del pedido"
    );
  });
});

describe("pago rechazado", () => {
  it("deja el pedido pendiente para que se pueda reintentar", async () => {
    const pedido = await pedidoNuevo();

    const resultado = await aplicarPagoAlPedido(
      pagoDe(pedido.id, pedido.totalAmount, "rejected")
    );

    assert.equal(resultado.status, "rejected");
    assert.notEqual(resultado.paid, true);

    const despues = await estadoDe(pedido.id);
    assert.equal(despues.status, "pending");
    assert.equal(despues.paymentStatus, "rejected");
    assert.equal(despues.paidAt, null, "un rechazo no puede dejar fecha de pago");
  });

  it("despues de un rechazo, el mismo pedido se puede pagar bien", async () => {
    const pedido = await pedidoNuevo();

    await aplicarPagoAlPedido(pagoDe(pedido.id, pedido.totalAmount, "rejected"));
    await aplicarPagoAlPedido(pagoDe(pedido.id, pedido.totalAmount, "approved"));

    const despues = await estadoDe(pedido.id);
    assert.equal(despues.status, "paid");
    assert.equal(despues.paymentStatus, "approved");
  });
});

describe("pago pendiente", () => {
  it("el efectivo todavia no acreditado no marca el pedido como pagado", async () => {
    const pedido = await pedidoNuevo();

    await aplicarPagoAlPedido(
      pagoDe(pedido.id, pedido.totalAmount, "in_process")
    );

    const despues = await estadoDe(pedido.id);
    assert.equal(despues.status, "pending");
    assert.equal(despues.paymentStatus, "in_process");
  });
});

describe("casos que no tienen que pasar nunca", () => {
  it("si el monto no coincide, no da el pedido por pagado", async () => {
    const pedido = await pedidoNuevo();
    const deMenos = String(Number(pedido.totalAmount) - 5000);

    const resultado = await aplicarPagoAlPedido(
      pagoDe(pedido.id, deMenos, "approved")
    );

    assert.equal(resultado.amountMismatch, true);

    const despues = await estadoDe(pedido.id);
    assert.equal(despues.status, "pending");
  });

  it("un pago que entra tarde no resucita un pedido cancelado", async () => {
    const pedido = await pedidoNuevo();
    await updateOrderStatus(pedido.id, { status: "cancelled" });

    const resultado = await aplicarPagoAlPedido(
      pagoDe(pedido.id, pedido.totalAmount, "approved")
    );

    assert.equal(resultado.paidAfterCancel, true);

    const despues = await estadoDe(pedido.id);
    assert.equal(
      despues.status,
      "cancelled",
      "esas piezas ya volvieron al stock y pueden estar vendidas"
    );
  });

  it("un pago que apunta a un pedido inexistente no rompe nada", async () => {
    const resultado = await aplicarPagoAlPedido(
      pagoDe(99999999, "1000", "approved")
    );

    assert.equal(resultado.received, true);
    assert.equal(resultado.ignored, "pedido inexistente");
  });
});

describe("historial del pedido", () => {
  it("arranca con el evento de creacion", async () => {
    const pedido = await pedidoNuevo();

    assert.equal(pedido.events.length, 1);
    assert.equal(pedido.events[0].type, "created");
  });

  it("nombra los estados como los nombra el panel, no como los guarda la base", async () => {
    const pedido = await pedidoNuevo();

    // Se busca el mensaje entre todos los eventos y no en el ultimo: el
    // comprobante sale sin await y se cuela en el medio cuando quiere.
    const mensajes = (orden: { events: Array<{ message: string }> }) =>
      orden.events.map((evento) => evento.message);

    const pagado = await updateOrderStatus(pedido.id, { status: "paid" });

    // Antes decia "Estado actualizado a paid": el historial hablaba en ingles
    // mientras el pedido de al lado decia "Pagado".
    assert.ok(
      mensajes(pagado).includes("Estado actualizado a Pagado"),
      mensajes(pagado).join(" | ")
    );

    const enviado = await updateOrderStatus(pedido.id, { status: "shipped" });

    assert.ok(
      mensajes(enviado).includes("Estado actualizado a Enviado"),
      mensajes(enviado).join(" | ")
    );

    // Y que no quede ningun estado crudo de la base.
    assert.ok(
      !mensajes(enviado).some((mensaje) => /a (paid|shipped|pending)$/.test(mensaje)),
      "no puede quedar el nombre interno del estado"
    );
  });

  it("deja asentado que cancelar un pedido cobrado no devuelve la plata", async () => {
    const pedido = await pedidoNuevo();
    await aplicarPagoAlPedido(pagoDe(pedido.id, pedido.totalAmount, "approved"));

    const cancelado = await updateOrderStatus(pedido.id, { status: "cancelled" });
    const mensajes = cancelado.events.map((evento) => evento.message).join(" | ");

    assert.match(mensajes, /devolucion NO es automatica/);
    assert.match(mensajes, /Stock restaurado/);
  });

  it("viene ordenado del mas viejo al mas nuevo", async () => {
    const pedido = await pedidoNuevo();
    await updateOrderStatus(pedido.id, { status: "paid" });
    const final = await updateOrderStatus(pedido.id, { status: "processing" });

    const fechas = final.events.map((evento) => new Date(evento.createdAt).getTime());
    const ordenadas = [...fechas].sort((a, b) => a - b);

    assert.deepEqual(fechas, ordenadas);
    assert.equal(final.events[0].type, "created");
  });
});
