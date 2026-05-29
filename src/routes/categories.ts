import { Router } from "express";
import {
  getCategories,
  patchCategory,
  postCategory,
  removeCategory,
} from "../controllers/categories.controller.js";
import { asyncHandler } from "../lib/http.js";
import { requireAdminAccess } from "../middlewares/admin.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", asyncHandler(getCategories));
categoriesRouter.post("/", requireAdminAccess, asyncHandler(postCategory));
categoriesRouter.patch("/:id", requireAdminAccess, asyncHandler(patchCategory));
categoriesRouter.delete("/:id", requireAdminAccess, asyncHandler(removeCategory));
