import express, { Router } from "express";
import { postClerkWebhook } from "../controllers/webhooks.controller.js";
import { asyncHandler } from "../lib/http.js";

export const webhooksRouter = Router();

webhooksRouter.post(
  "/clerk",
  express.raw({ type: "application/json" }),
  asyncHandler(postClerkWebhook)
);
