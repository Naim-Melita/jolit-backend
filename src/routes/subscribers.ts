import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getSubscribers,
  postSubscriber,
} from "../controllers/subscribers.controller.js";
import { asyncHandler } from "../lib/http.js";
import { requireAdminAccess } from "../middlewares/admin.js";

export const subscribersRouter = Router();

const subscribeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Probá de nuevo en un rato." },
});

subscribersRouter.get("/", requireAdminAccess, asyncHandler(getSubscribers));
subscribersRouter.post("/", subscribeRateLimit, asyncHandler(postSubscriber));
