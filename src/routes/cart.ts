import { Router } from "express";
import {
  deleteCartItem,
  deleteMyCart,
  getMyCart,
  patchCartItem,
  postCartItem,
} from "../controllers/cart.controller.js";
import { asyncHandler } from "../lib/http.js";
import { requireAuth } from "../middlewares/clerk.js";

export const cartRouter = Router();

cartRouter.get("/", requireAuth, asyncHandler(getMyCart));
cartRouter.post("/items", requireAuth, asyncHandler(postCartItem));
cartRouter.patch("/items/:productId", requireAuth, asyncHandler(patchCartItem));
cartRouter.delete("/items/:productId", requireAuth, asyncHandler(deleteCartItem));
cartRouter.delete("/", requireAuth, asyncHandler(deleteMyCart));
