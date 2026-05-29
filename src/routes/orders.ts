import { Router } from "express";
import {
  getOrder,
  getOrders,
  patchOrderShipping,
  patchOrderStatus,
  postOrder,
  postOrderLookup,
} from "../controllers/orders.controller.js";
import { asyncHandler } from "../lib/http.js";
import { requireAdminAccess } from "../middlewares/admin.js";

export const ordersRouter = Router();

ordersRouter.get("/", requireAdminAccess, asyncHandler(getOrders));
ordersRouter.post("/lookup", asyncHandler(postOrderLookup));
ordersRouter.get("/:id", requireAdminAccess, asyncHandler(getOrder));
ordersRouter.post("/", asyncHandler(postOrder));
ordersRouter.patch("/:id/status", requireAdminAccess, asyncHandler(patchOrderStatus));
ordersRouter.patch("/:id/shipping", requireAdminAccess, asyncHandler(patchOrderShipping));
