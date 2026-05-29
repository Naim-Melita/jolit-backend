import type { Request, Response } from "express";
import { settingsSchema } from "../schemas.js";
import {
  getStoreSettings,
  updateStoreSettings,
} from "../services/settings.service.js";

export async function getSettings(_req: Request, res: Response) {
  res.json(await getStoreSettings());
}

export async function patchSettings(req: Request, res: Response) {
  const input = settingsSchema.parse(req.body);
  res.json(await updateStoreSettings(input));
}
