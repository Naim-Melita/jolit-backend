import type { Request, Response } from "express";
import { leerPaginacion } from "../lib/paginacion.js";
import { productSchema, updateProductSchema } from "../schemas.js";
import {
  createProduct,
  deleteProduct,
  getProduct as findProduct,
  listProducts,
  resolverProducto,
  updateProduct,
} from "../services/products.service.js";

export async function getProducts(req: Request, res: Response) {
  const category = String(req.query.category ?? "");
  const search = String(req.query.search ?? "");

  const { limit, cursor } = leerPaginacion(req.query);

  res.json(await listProducts({ category, search, limit, cursor }));
}

export async function getProduct(req: Request, res: Response) {
  res.json(await findProduct(req.params.identificador));
}

export async function postProduct(req: Request, res: Response) {
  const input = productSchema.parse(req.body);
  const product = await createProduct(input);

  res.status(201).json(product);
}

export async function patchProduct(req: Request, res: Response) {
  const id = await resolverProducto(req.params.identificador);
  const input = updateProductSchema.parse(req.body);
  const product = await updateProduct(id, input);

  res.json(product);
}

export async function removeProduct(req: Request, res: Response) {
  await deleteProduct(await resolverProducto(req.params.identificador));

  res.status(204).send();
}
