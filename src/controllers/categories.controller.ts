import type { Request, Response } from "express";
import { categorySchema } from "../schemas.js";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../services/categories.service.js";

export async function getCategories(_req: Request, res: Response) {
  res.json(await listCategories());
}

export async function postCategory(req: Request, res: Response) {
  const input = categorySchema.parse(req.body);
  const category = await createCategory(input);

  res.status(201).json(category);
}

export async function patchCategory(req: Request, res: Response) {
  const id = Number(req.params.id);
  const input = categorySchema.partial().parse(req.body);
  const category = await updateCategory(id, input);

  res.json(category);
}

export async function removeCategory(req: Request, res: Response) {
  const id = Number(req.params.id);
  await deleteCategory(id);

  res.status(204).send();
}
