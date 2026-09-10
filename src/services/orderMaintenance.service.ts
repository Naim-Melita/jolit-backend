import { isMercadoPagoConfigured } from "../lib/mercadopago.js";
import { prisma } from "../lib/prisma.js";
import { aplicarPagoAlPedido } from "./mercadoPagoWebhook.service.js";
import { buscarPagoDePedido } from "./payments.service.js";

const DEFAULT_PENDING_HOURS = 48;

/**
 * Estados de Mercado Pago que significan "el pago arranco pero todavia no se
 * acredito". El efectivo en Rapipago o Pago Facil puede tardar varios dias,
 * asi que a esos pedidos no se les puede soltar el stock a las 48 horas.
 */
const PAGOS_EN_CURSO = ["pending", "in_process", "in_mediation", "authorized"];
const DEFAULT_PENDING_PAYMENT_HOURS = 24 * 7;

function getPendingTtlHours() {
  const raw = Number(process.env.PENDING_ORDER_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PENDING_HOURS;
}

function getPendingPaymentTtlHours() {
  const raw = Number(process.env.PENDING_PAYMENT_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PENDING_PAYMENT_HOURS;
}

/**
 * Cancela los pedidos que quedaron en `pending` mas alla del TTL y devuelve
 * el stock reservado. Sin esto, cada checkout abandonado retiene inventario
 * para siempre.
 */
export async function expireStalePendingOrders() {
  const cutoff = new Date(Date.now() - getPendingTtlHours() * 60 * 60 * 1000);

  const cutoffConPago = new Date(
    Date.now() - getPendingPaymentTtlHours() * 60 * 60 * 1000
  );

  const staleOrders = await prisma.order.findMany({
    where: {
      status: "pending",
      OR: [
        // Sin pago iniciado: checkout abandonado, se libera rapido.
        {
          paymentStatus: { notIn: PAGOS_EN_CURSO },
          createdAt: { lt: cutoff },
        },
        // Con pago en curso: se le da mucho mas tiempo a que se acredite.
        {
          paymentStatus: { in: PAGOS_EN_CURSO },
          createdAt: { lt: cutoffConPago },
        },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      items: { select: { productId: true, quantity: true } },
    },
  });

  for (const order of staleOrders) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          if (!item.productId) continue;

          await tx.inventory.update({
            where: { productId: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: "cancelled" },
        });

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "status_changed",
            message: `Cancelado automaticamente tras ${getPendingTtlHours()} hs sin confirmar. Stock restaurado.`,
          },
        });
      });
    } catch (error) {
      console.error(`No se pudo expirar el pedido ${order.orderNumber}`, error);
    }
  }

  return staleOrders.length;
}

const DEFAULT_RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

export function startPaymentReconciliation(
  intervalMs = DEFAULT_RECONCILE_INTERVAL_MS
) {
  const run = () => {
    reconcilePendingPayments().catch((error) =>
      console.error("Fallo la reconciliacion de pagos", error)
    );
  };

  run();

  const timer = setInterval(run, intervalMs);
  timer.unref?.();

  return timer;
}

export function startOrderMaintenance(intervalMs = 60 * 60 * 1000) {
  const run = () => {
    expireStalePendingOrders()
      .then((count) => {
        if (count > 0) {
          console.log(`Pedidos pendientes expirados: ${count}`);
        }
      })
      .catch((error) => console.error("Fallo la expiracion de pedidos", error));
  };

  run();

  const timer = setInterval(run, intervalMs);
  timer.unref?.();

  return timer;
}

/**
 * Busca en Mercado Pago pagos de pedidos que seguimos viendo como pendientes.
 *
 * Existe porque los avisos de webhook se pierden: el servidor pudo estar caido,
 * pudo haber un corte, o Mercado Pago pudo no alcanzarnos. Sin esta red, la
 * clienta paga, nadie se entera, y a las 48 horas el pedido se cancela solo.
 *
 * Es idempotente porque aplicarPagoAlPedido lo es: si el webhook ya proceso el
 * pago, esto no vuelve a mandar mails.
 */
export async function reconcilePendingPayments() {
  if (!isMercadoPagoConfigured()) return 0;

  const cutoff = new Date(Date.now() - getPendingPaymentTtlHours() * 60 * 60 * 1000);

  const pendientes = await prisma.order.findMany({
    where: {
      status: "pending",
      // Solo los que llegaron a la pasarela: si no hay preferencia, no hay
      // nada que buscar del otro lado.
      paymentPreferenceId: { not: "" },
      createdAt: { gte: cutoff },
    },
    select: { id: true, orderNumber: true },
  });

  let aplicados = 0;

  for (const order of pendientes) {
    try {
      const pago = await buscarPagoDePedido(order.id);
      if (!pago || !pago.approved) continue;

      const resultado = await aplicarPagoAlPedido(pago);

      if (resultado.paid) {
        aplicados += 1;
        console.log(
          `Reconciliacion: el pedido ${order.orderNumber} estaba pagado y no nos habiamos enterado.`
        );
      }
    } catch (error) {
      console.error(`No se pudo reconciliar el pedido ${order.orderNumber}`, error);
    }
  }

  return aplicados;
}
