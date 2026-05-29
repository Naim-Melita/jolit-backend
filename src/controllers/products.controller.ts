import type { Request, Response } from "express";
import { productSchema, updateProductSchema } from "../schemas.js";
import {
  createProduct,
  deleteProduct,
  getProductBySlug,
  listProducts,
  updateProduct,
} from "../services/products.service.js";

export async function getProducts(req: Request, res: Response) {
  const category = String(req.query.category ?? "");
  const search = String(req.query.search ?? "");

  res.json(await listProducts({ category, search }));
}

export async function getProduct(req: Request, res: Response) {
  res.json(await getProductBySlug(req.params.slug));
}

export async function postProduct(req: Request, res: Response) {
  const input = productSchema.parse(req.body);
  const product = await createProduct(input);

  res.status(201).json(product);
}

export async function patchProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  const input = updateProductSchema.parse(req.body);
  const product = await updateProduct(id, input);

  res.json(product);
}

export async function removeProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  await deleteProduct(id);

  res.status(204).send();
}
