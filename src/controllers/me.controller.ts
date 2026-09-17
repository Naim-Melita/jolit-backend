import { CODIGOS } from "../lib/errorCodes.js";
import type { Request, Response } from "express";
import { badRequest, HttpError } from "../lib/http.js";
import { getClerkUserId } from "../middlewares/clerk.js";
import {
  getOrderByIdForClerkUser,
  listOrdersByClerkUserId,
} from "../services/orders.service.js";

export async function getMyOrders(req: Request, res: Response) {
  res.json(await listOrdersByClerkUserId(requireClerkUserId(req)));
}

export async function getMyOrder(req: Request, res: Response) {
  const orderId = Number(req.params.id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw badRequest("No encontramos ese pedido.", CODIGOS.PEDIDO_NO_ENCONTRADO);
  }

  res.json(await getOrderByIdForClerkUser(requireClerkUserId(req), orderId));
}

function requireClerkUserId(req: Request) {
  const clerkUserId = getClerkUserId(req);

  if (!clerkUserId) {
    throw new HttpError(401, "Necesitas iniciar sesion.", CODIGOS.SESION_REQUERIDA);
  }

  return clerkUserId;
}
