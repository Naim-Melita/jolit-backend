import { Router } from "express";
import { badRequest } from "../lib/http.js";
import { quoteCorreoArgentino } from "../lib/correoArgentino.js";
import { readDb } from "../lib/store.js";
import { shippingQuoteSchema } from "../schemas.js";

export const shippingRouter = Router();

shippingRouter.post("/quote", (req, res) => {
  const input = shippingQuoteSchema.parse(req.body);
  const numericPostalCode = Number(input.postalCode.replace(/\D/g, ""));

  if (input.postalCode && !Number.isFinite(numericPostalCode)) {
    throw badRequest("Invalid postal code");
  }

  const db = readDb();
  res.json(quoteCorreoArgentino(input, db.settings.shipping));
});
