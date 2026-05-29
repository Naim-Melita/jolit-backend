import type { Request, Response } from "express";
import { badRequest } from "../lib/http.js";
import { getClerkUserId } from "../middlewares/clerk.js";
import {
  addCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../services/cart.service.js";

export async function getMyCart(req: Request, res: Response) {
  res.json(await getCart(requireClerkUserId(req)));
}

export async function postCartItem(req: Request, res: Response) {
  const input = parseCartItemInput(req);

  res.status(201).json(
    await addCartItem(requireClerkUserId(req), input.productId, input.quantity)
  );
}

export async function patchCartItem(req: Request, res: Response) {
  const productId = parseProductId(req.params.productId);
  const quantity = Number(req.body?.quantity);

  if (!Number.isInteger(quantity)) {
    throw badRequest("Quantity is required");
  }

  res.json(await updateCartItem(requireClerkUserId(req), productId, quantity));
}

export async function deleteCartItem(req: Request, res: Response) {
  const productId = parseProductId(req.params.productId);

  res.json(await removeCartItem(requireClerkUserId(req), productId));
}

export async function deleteMyCart(req: Request, res: Response) {
  res.json(await clearCart(requireClerkUserId(req)));
}

function parseCartItemInput(req: Request) {
  const productId = Number(req.body?.productId);
  const quantity = Number(req.body?.quantity ?? 1);

  if (!Number.isInteger(productId) || productId <= 0) {
    throw badRequest("Valid productId is required");
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw badRequest("Valid quantity is required");
  }

  return { productId, quantity };
}

function parseProductId(value: string) {
  const productId = Number(value);

  if (!Number.isInteger(productId) || productId <= 0) {
    throw badRequest("Invalid product id");
  }

  return productId;
}

function requireClerkUserId(req: Request) {
  const clerkUserId = getClerkUserId(req);

  if (!clerkUserId) {
    throw badRequest("Clerk user id is required");
  }

  return clerkUserId;
}
