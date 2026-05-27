import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { Router } from "express";
import { badRequest } from "../lib/http.js";

const uploadDir = path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(badRequest("Only image files are allowed"));
      return;
    }

    cb(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.post("/", upload.single("image"), (req, res) => {
  if (!req.file) {
    throw badRequest("Image file is required");
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  res.status(201).json({
    imageUrl: `${baseUrl}/uploads/${req.file.filename}`,
  });
});
