import type { Request, Response } from "express";
import { createPaymentPreference } from "../services/payments.service.js";

export async function postPaymentPreference(req: Request, res: Response) {
  const orderId = Number(req.body?.orderId);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    res.status(400).json({ error: "orderId invalido" });
    return;
  }

  res.status(201).json(await createPaymentPreference(orderId));
}
