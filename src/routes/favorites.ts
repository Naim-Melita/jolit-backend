import { Router } from "express";
import {
  deleteFavorite,
  getFavorites,
  postFavorite,
} from "../controllers/favorites.controller.js";
import { asyncHandler } from "../lib/http.js";
import { requireAuth } from "../middlewares/clerk.js";

export const favoritesRouter = Router();

favoritesRouter.get("/", requireAuth, asyncHandler(getFavorites));
favoritesRouter.post("/:productId", requireAuth, asyncHandler(postFavorite));
favoritesRouter.delete("/:productId", requireAuth, asyncHandler(deleteFavorite));
