import { Router } from "express";
import rateLimit from "express-rate-limit";
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

// Crear pedidos descuenta stock, asi que la ruta publica va limitada por IP.
const createOrderRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados pedidos seguidos. Intenta de nuevo en un rato." },
});

const lookupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

ordersRouter.get("/", requireAdminAccess, asyncHandler(getOrders));
ordersRouter.post("/lookup", lookupRateLimit, asyncHandler(postOrderLookup));
ordersRouter.get("/:id", requireAdminAccess, asyncHandler(getOrder));
ordersRouter.post("/", createOrderRateLimit, asyncHandler(postOrder));
ordersRouter.patch("/:id/status", requireAdminAccess, asyncHandler(patchOrderStatus));
ordersRouter.patch("/:id/shipping", requireAdminAccess, asyncHandler(patchOrderShipping));
