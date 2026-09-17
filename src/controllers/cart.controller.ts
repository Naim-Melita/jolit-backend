import { CODIGOS } from "../lib/errorCodes.js";
import type { Request, Response } from "express";
import { badRequest, HttpError } from "../lib/http.js";
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
    throw badRequest("Falta la cantidad.", CODIGOS.CANTIDAD_INVALIDA);
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
    throw badRequest("No encontramos ese producto.", CODIGOS.PRODUCTO_NO_ENCONTRADO);
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw badRequest("La cantidad no es valida.", CODIGOS.CANTIDAD_INVALIDA);
  }

  return { productId, quantity };
}

function parseProductId(value: string) {
  const productId = Number(value);

  if (!Number.isInteger(productId) || productId <= 0) {
    throw badRequest("No encontramos ese producto.", CODIGOS.PRODUCTO_NO_ENCONTRADO);
  }

  return productId;
}

function requireClerkUserId(req: Request) {
  const clerkUserId = getClerkUserId(req);

  if (!clerkUserId) {
    throw new HttpError(401, "Necesitas iniciar sesion.", CODIGOS.SESION_REQUERIDA);
  }

  return clerkUserId;
}
