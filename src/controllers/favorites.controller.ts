import type { Request, Response } from "express";
import { badRequest } from "../lib/http.js";
import { getClerkUserId } from "../middlewares/clerk.js";
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from "../services/favorites.service.js";

export async function getFavorites(req: Request, res: Response) {
  const clerkUserId = requireClerkUserId(req);

  res.json(await listFavorites(clerkUserId));
}

export async function postFavorite(req: Request, res: Response) {
  const clerkUserId = requireClerkUserId(req);
  const productId = Number(req.params.productId);

  if (!Number.isInteger(productId) || productId <= 0) {
    throw badRequest("Invalid product id");
  }

  res.status(201).json(await addFavorite(clerkUserId, productId));
}

export async function deleteFavorite(req: Request, res: Response) {
  const clerkUserId = requireClerkUserId(req);
  const productId = Number(req.params.productId);

  if (!Number.isInteger(productId) || productId <= 0) {
    throw badRequest("Invalid product id");
  }

  await removeFavorite(clerkUserId, productId);

  res.status(204).send();
}

function requireClerkUserId(req: Request) {
  const clerkUserId = getClerkUserId(req);

  if (!clerkUserId) {
    throw badRequest("Clerk user id is required");
  }

  return clerkUserId;
}
