import type { NextFunction, Request, Response } from "express";
import { getAdminToken } from "../lib/adminAuth.js";
import { HttpError } from "../lib/http.js";
import { isClerkAdminRequest } from "./clerk.js";

export async function requireAdminAccess(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";

    if (token && token === (await getAdminToken())) {
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
