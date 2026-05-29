import {
  v2 as cloudinary,
  type UploadApiOptions,
  type UploadApiResponse,
} from "cloudinary";
import { HttpError } from "../lib/http.js";

type UploadImageInput = {
  buffer: Buffer;
  originalName: string;
};

export type UploadedImage = {
  imageUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
};

let configured = false;

function configureCloudinary() {
  if (configured) return;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  configured = true;
}

function assertCloudinaryEnv() {
  const missing = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new HttpError(
      500,
      `Cloudinary is not configured. Missing: ${missing.join(", ")}`
    );
  }
}

export async function uploadImageToCloudinary({
  buffer,
  originalName,
}: UploadImageInput): Promise<UploadedImage> {
  assertCloudinaryEnv();
  configureCloudinary();

  const folder = process.env.CLOUDINARY_FOLDER || "jolit/products";
  const result = await uploadBuffer(buffer, {
    folder,
    public_id: buildPublicId(originalName),
    resource_type: "image",
    overwrite: false,
  });

  return {
    imageUrl: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
  };
}

function uploadBuffer(buffer: Buffer, options: UploadApiOptions) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      if (!result) {
        reject(new Error("Cloudinary upload failed"));
        return;
      }

      resolve(result);
    });

    stream.end(buffer);
  });
}

function buildPublicId(originalName: string) {
  const baseName = originalName
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${Date.now()}-${baseName || "image"}`;
}
