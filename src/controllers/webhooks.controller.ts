import type { Request, Response } from "express";
import { handleClerkWebhook } from "../services/clerkWebhook.service.js";

export async function postClerkWebhook(req: Request, res: Response) {
  const result = await handleClerkWebhook(req.body.toString("utf-8"), {
    svixId: req.header("svix-id") ?? undefined,
    svixTimestamp: req.header("svix-timestamp") ?? undefined,
    svixSignature: req.header("svix-signature") ?? undefined,
  });

  res.json(result);
}
