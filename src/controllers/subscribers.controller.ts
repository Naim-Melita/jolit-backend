import type { Request, Response } from "express";
import { leerPaginacion } from "../lib/paginacion.js";
import { subscriberSchema } from "../schemas.js";
import {
  createSubscriber,
  listSubscribers,
} from "../services/subscribers.service.js";

export async function postSubscriber(req: Request, res: Response) {
  const input = subscriberSchema.parse(req.body);
  await createSubscriber(input);

  res.status(201).json({ subscribed: true });
}

export async function getSubscribers(req: Request, res: Response) {
  res.json(await listSubscribers(leerPaginacion(req.query)));
}
