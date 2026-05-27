import { Router } from "express";
import { requireAdmin } from "../lib/adminAuth.js";
import { readDb, writeDb } from "../lib/store.js";
import { settingsSchema } from "../schemas.js";

export const settingsRouter = Router();

settingsRouter.get("/", (_req, res) => {
  const db = readDb();
  res.json(db.settings);
});

settingsRouter.patch("/", requireAdmin, (req, res) => {
  const input = settingsSchema.parse(req.body);
  const db = readDb();

  db.settings = {
    ...db.settings,
    ...input,
    shipping: {
      ...db.settings.shipping,
      ...input.shipping,
    },
    promoBanner: {
      ...db.settings.promoBanner,
      ...input.promoBanner,
    },
  };
  writeDb(db);

  res.json(db.settings);
});
