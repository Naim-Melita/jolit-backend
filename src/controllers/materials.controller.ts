import type { Request, Response } from "express";
import { materialSchema } from "../schemas.js";
import {
  createMaterial,
  deleteMaterial,
  listMaterials,
  updateMaterial,
} from "../services/materials.service.js";

export async function getMaterials(_req: Request, res: Response) {
  res.json(await listMaterials());
}

export async function postMaterial(req: Request, res: Response) {
  const input = materialSchema.parse(req.body);
  const material = await createMaterial(input);

  res.status(201).json(material);
}

export async function patchMaterial(req: Request, res: Response) {
  const id = Number(req.params.id);
  const input = materialSchema.partial().parse(req.body);
  const material = await updateMaterial(id, input);

  res.json(material);
}

export async function removeMaterial(req: Request, res: Response) {
  const id = Number(req.params.id);
  await deleteMaterial(id);

  res.status(204).send();
}
