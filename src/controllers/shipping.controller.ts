import { CODIGOS } from "../lib/errorCodes.js";
import type { Request, Response } from "express";
import { quoteCorreoArgentino } from "../lib/correoArgentino.js";
import { badRequest } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { shippingQuoteSchema } from "../schemas.js";
import { priceItems } from "../services/pricing.service.js";
import { getStoreSettings } from "../services/settings.service.js";

export async function postShippingQuote(req: Request, res: Response) {
  const input = shippingQuoteSchema.parse(req.body);
  const numericPostalCode = Number(input.postalCode.replace(/\D/g, ""));

  if (input.postalCode && !Number.isFinite(numericPostalCode)) {
    throw badRequest(
      "Reviso el codigo postal: no parece valido.",
      CODIGOS.CODIGO_POSTAL_INVALIDO
    );
  }

  const settings = await getStoreSettings();
  const { subtotal } = await priceItems(prisma, input.items, {
    checkStock: false,
  });

  res.json(
    quoteCorreoArgentino(
      {
        postalCode: input.postalCode,
        address: input.address,
        city: input.city,
        province: input.province,
        subtotal,
      },
      settings.shipping
    )
  );
}
