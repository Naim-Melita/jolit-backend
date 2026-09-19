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
// Un producto se nombra por su id o por su enlace, igual en las tres rutas:
// antes se leia por enlace y se editaba por numero, asi que quien lo leia no
// podia editarlo con lo que acababa de recibir.
productsRouter.get("/:identificador", asyncHandler(getProduct));
productsRouter.post("/", requireAdminAccess, asyncHandler(postProduct));
productsRouter.patch(
  "/:identificador",
  requireAdminAccess,
  asyncHandler(patchProduct)
);
productsRouter.delete(
  "/:identificador",
  requireAdminAccess,
  asyncHandler(removeProduct)
);
