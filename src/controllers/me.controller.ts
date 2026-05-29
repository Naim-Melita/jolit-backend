import type { Request, Response } from "express";
import { badRequest } from "../lib/http.js";
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
    throw badRequest("Invalid order id");
  }

  res.json(await getOrderByIdForClerkUser(requireClerkUserId(req), orderId));
}

function requireClerkUserId(req: Request) {
  const clerkUserId = getClerkUserId(req);

  if (!clerkUserId) {
    throw badRequest("Clerk user id is required");
  }

  return clerkUserId;
}
