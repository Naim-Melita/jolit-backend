import express, { Router } from "express";
import {
  postClerkWebhook,
  postMercadoPagoWebhook,
} from "../controllers/webhooks.controller.js";
import { asyncHandler } from "../lib/http.js";

export const webhooksRouter = Router();

webhooksRouter.post(
  "/clerk",
  express.raw({ type: "application/json" }),
  asyncHandler(postClerkWebhook)
);

webhooksRouter.post(
  "/mercadopago",
  express.raw({ type: "*/*" }),
  asyncHandler(postMercadoPagoWebhook)
);
