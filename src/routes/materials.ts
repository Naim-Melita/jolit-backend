import { Router } from "express";
import {
  getMaterials,
  patchMaterial,
  postMaterial,
  removeMaterial,
} from "../controllers/materials.controller.js";
import { asyncHandler } from "../lib/http.js";
import { requireAdminAccess } from "../middlewares/admin.js";

export const materialsRouter = Router();

// El listado es publico: la tienda filtra por material.
materialsRouter.get("/", asyncHandler(getMaterials));
materialsRouter.post("/", requireAdminAccess, asyncHandler(postMaterial));
materialsRouter.patch("/:id", requireAdminAccess, asyncHandler(patchMaterial));
materialsRouter.delete("/:id", requireAdminAccess, asyncHandler(removeMaterial));
