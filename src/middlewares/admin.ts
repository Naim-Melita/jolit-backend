import type { NextFunction, Request, Response } from "express";
import { isAdminTokenRequest } from "../lib/adminAuth.js";
import { HttpError } from "../lib/http.js";
import { isClerkAdminRequest } from "./clerk.js";

export async function requireAdminAccess(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    if (isAdminTokenRequest(req)) {
      next();
      return;
    }

    if (await isClerkAdminRequest(req)) {
      next();
      return;
    }

    next(new HttpError(401, "Admin authentication required"));
  } catch (error) {
    next(error);
  }
}
