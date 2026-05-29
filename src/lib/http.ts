import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function notFound(message = "Resource not found") {
  return new HttpError(404, message);
}

export function badRequest(message = "Invalid request") {
  return new HttpError(400, message);
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "Validation error",
      details: error.issues,
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Resource already exists" });
    }

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Resource not found" });
    }
  }

  if (isClerkError(error)) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  if (isCloudinaryError(error)) {
    return res.status(502).json({ error: "Image upload failed" });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}

function isCloudinaryError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  return ("http_code" in error || "error" in error) && "message" in error;
}

function isClerkError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  return "clerkError" in error;
}
