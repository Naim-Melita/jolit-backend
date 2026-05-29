import { Router } from "express";
import {
  getSettings,
  patchSettings,
} from "../controllers/settings.controller.js";
import { asyncHandler } from "../lib/http.js";
import { requireAdminAccess } from "../middlewares/admin.js";

export const settingsRouter = Router();

settingsRouter.get("/", asyncHandler(getSettings));
settingsRouter.patch("/", requireAdminAccess, asyncHandler(patchSettings));
