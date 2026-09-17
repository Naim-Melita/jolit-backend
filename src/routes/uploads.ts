import { CODIGOS } from "../lib/errorCodes.js";
import multer from "multer";
import { Router } from "express";
import { uploadImage } from "../controllers/uploads.controller.js";
import { badRequest, asyncHandler } from "../lib/http.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(badRequest("Solo se pueden subir imagenes.", CODIGOS.IMAGEN_INVALIDA));
      return;
    }

    cb(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.post("/", upload.single("image"), asyncHandler(uploadImage));
