import type { Request, Response } from "express";
import { badRequest } from "../lib/http.js";
import { uploadImageToCloudinary } from "../services/uploads.service.js";

export async function uploadImage(req: Request, res: Response) {
  if (!req.file) {
    throw badRequest("Image file is required");
  }

  const image = await uploadImageToCloudinary({
    buffer: req.file.buffer,
    originalName: req.file.originalname,
  });

  res.status(201).json(image);
}
