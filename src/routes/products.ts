import { Router } from "express";
import {
  getProduct,
  getProducts,
  patchProduct,
  postProduct,
  removeProduct,
} from "../controllers/products.controller.js";
import { asyncHandler } from "../lib/http.js";
import { requireAdminAccess } from "../middlewares/admin.js";

export const productsRouter = Router();

productsRouter.get("/", asyncHandler(getProducts));
productsRouter.get("/:slug", asyncHandler(getProduct));
productsRouter.post("/", requireAdminAccess, asyncHandler(postProduct));
productsRouter.patch("/:id", requireAdminAccess, asyncHandler(patchProduct));
productsRouter.delete("/:id", requireAdminAccess, asyncHandler(removeProduct));
