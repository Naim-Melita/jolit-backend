import { prisma } from "../lib/prisma.js";

const DEFAULT_PENDING_HOURS = 48;

function getPendingTtlHours() {
  const raw = Number(process.env.PENDING_ORDER_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PENDING_HOURS;
}

/**
 * Cancela los pedidos que quedaron en `pending` mas alla del TTL y devuelve
 * el stock reservado. Sin esto, cada checkout abandonado retiene inventario
 * para siempre.
 */
export async function expireStalePendingOrders() {
  const cutoff = new Date(Date.now() - getPendingTtlHours() * 60 * 60 * 1000);

  const staleOrders = await prisma.order.findMany({
    where: {
      status: "pending",
      createdAt: { lt: cutoff },
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
