import type { Request, Response } from "express";
import { handleClerkWebhook } from "../services/clerkWebhook.service.js";
import { handleMercadoPagoWebhook } from "../services/mercadoPagoWebhook.service.js";

export async function postClerkWebhook(req: Request, res: Response) {
  const result = await handleClerkWebhook(req.body.toString("utf-8"), {
    svixId: req.header("svix-id") ?? undefined,
    svixTimestamp: req.header("svix-timestamp") ?? undefined,
    svixSignature: req.header("svix-signature") ?? undefined,
  });

  res.json(result);
}

export async function postMercadoPagoWebhook(req: Request, res: Response) {
  const result = await handleMercadoPagoWebhook(req.body.toString("utf-8"), {
    signature: req.header("x-signature") ?? undefined,
    requestId: req.header("x-request-id") ?? undefined,
  });

  res.json(result);
}
