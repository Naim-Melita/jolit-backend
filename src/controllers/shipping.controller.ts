import type { Request, Response } from "express";
import { quoteCorreoArgentino } from "../lib/correoArgentino.js";
import { badRequest } from "../lib/http.js";
import { shippingQuoteSchema } from "../schemas.js";
import { getStoreSettings } from "../services/settings.service.js";

export async function postShippingQuote(req: Request, res: Response) {
  const input = shippingQuoteSchema.parse(req.body);
  const numericPostalCode = Number(input.postalCode.replace(/\D/g, ""));

  if (input.postalCode && !Number.isFinite(numericPostalCode)) {
    throw badRequest("Invalid postal code");
  }

  const settings = await getStoreSettings();

  res.json(quoteCorreoArgentino(input, settings.shipping));
}
