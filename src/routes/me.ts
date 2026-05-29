import { Router } from "express";
import { getMyOrder, getMyOrders } from "../controllers/me.controller.js";
import { asyncHandler } from "../lib/http.js";
import { requireAuth } from "../middlewares/clerk.js";

export const meRouter = Router();

meRouter.get("/orders", requireAuth, asyncHandler(getMyOrders));
meRouter.get("/orders/:id", requireAuth, asyncHandler(getMyOrder));
