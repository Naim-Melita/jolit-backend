import { CODIGOS } from "../lib/errorCodes.js";
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

    next(new HttpError(
        401,
        "Necesitas iniciar sesion en el panel.",
        CODIGOS.ADMIN_AUTH_REQUERIDA
      ));
  } catch (error) {
    next(error);
  }
}
