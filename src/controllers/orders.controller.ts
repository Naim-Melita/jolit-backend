import type { Request, Response } from "express";
import { getClerkUserId } from "../middlewares/clerk.js";
import { notifyNewOrder } from "../services/notifications.service.js";
import { getStoreSettings } from "../services/settings.service.js";
import {
  orderLookupSchema,
  orderSchema,
  orderShippingSchema,
  orderStatusSchema,
} from "../schemas.js";
import {
  createOrder,
  getOrderById,
  listOrders,
  lookupOrder,
  updateOrderShipping,
  updateOrderStatus,
} from "../services/orders.service.js";

export async function getOrders(_req: Request, res: Response) {
  res.json(await listOrders());
}

export async function postOrderLookup(req: Request, res: Response) {
  const input = orderLookupSchema.parse(req.body);
  res.json(await lookupOrder(input));
}

export async function getOrder(req: Request, res: Response) {
  res.json(await getOrderById(Number(req.params.id)));
}

export async function postOrder(req: Request, res: Response) {
  const input = orderSchema.parse(req.body);
  const order = await createOrder(input, {
    clerkUserId: getClerkUserId(req),
  });

  res.status(201).json(order);

  // Los mails salen despues de responder: el pedido ya esta guardado y
  // una notificacion que falla no puede voltear la venta.
  void getStoreSettings()
    .then((settings) => notifyNewOrder(order, settings.storeName))
    .catch((error) =>
      console.error(`No se pudo notificar el pedido ${order.orderNumber}`, error)
    );
}

export async function patchOrderStatus(req: Request, res: Response) {
  const input = orderStatusSchema.parse(req.body);
  res.json(await updateOrderStatus(Number(req.params.id), input));
}

export async function patchOrderShipping(req: Request, res: Response) {
  const input = orderShippingSchema.parse(req.body);
  res.json(await updateOrderShipping(Number(req.params.id), input));
}
