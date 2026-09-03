import { Router } from "express";
import rateLimit from "express-rate-limit";
import { postPaymentPreference } from "../controllers/payments.controller.js";
import { asyncHandler } from "../lib/http.js";

export const paymentsRouter = Router();

const preferenceRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de pago. Probá de nuevo en un rato." },
});

paymentsRouter.post("/preference", preferenceRateLimit, asyncHandler(postPaymentPreference));
