import { CODIGOS } from "../lib/errorCodes.js";
import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http.js";

export function isClerkConfigured() {
  return Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

/**
 * Margen de desfase de reloj que toleramos al validar el token de sesion.
 *
 * Clerk firma el token con SU hora. Si el reloj del servidor esta unos
 * segundos atrasado, ve un token "emitido en el futuro" y lo rechaza sin decir
 * por que: la clienta queda logueada en la pantalla pero el backend la trata
 * como desconocida, y en la caja aparece "No se pudo sincronizar el carrito".
 *
 * Nos paso con 8 segundos de atraso, tres mas que los 5 que Clerk tolera por
 * defecto. Esto es una red de seguridad, no la solucion: el reloj del servidor
 * tiene que estar sincronizado por NTP. Tampoco conviene agrandarlo mucho mas,
 * porque alarga la ventana en la que un token vencido se sigue aceptando.
 */
const TOLERANCIA_DE_RELOJ_MS = 30_000;

export function optionalClerkMiddleware() {
  if (!isClerkConfigured()) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return clerkMiddleware({ clockSkewInMs: TOLERANCIA_DE_RELOJ_MS });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!isClerkConfigured()) {
    next(new HttpError(
        503,
        "Las cuentas de clientas no estan disponibles en este momento.",
        CODIGOS.CLERK_NO_CONFIGURADO
      ));
    return;
  }

  const { userId } = getAuth(req);

  if (!userId) {
    next(new HttpError(401, "Necesitas iniciar sesion.", CODIGOS.SESION_REQUERIDA));
    return;
  }

  next();
}

export function getClerkUserId(req: Request) {
  if (!isClerkConfigured()) return null;

  const { userId } = getAuth(req);
  return userId ?? null;
}

export async function requireClerkAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    if (!isClerkConfigured()) {
      next(new HttpError(
        503,
        "Las cuentas de clientas no estan disponibles en este momento.",
        CODIGOS.CLERK_NO_CONFIGURADO
      ));
      return;
    }

    const { userId } = getAuth(req);

    if (!userId) {
      next(new HttpError(401, "Necesitas iniciar sesion.", CODIGOS.SESION_REQUERIDA));
      return;
    }

    const user = await clerkClient.users.getUser(userId);
    const emails = user.emailAddresses.map((email) =>
      email.emailAddress.toLowerCase()
    );
    const allowedEmails = getAllowedAdminEmails();
    const isAllowed = emails.some((email) => allowedEmails.has(email));

    if (!isAllowed) {
      next(new HttpError(
        403,
        "No tenes permisos para hacer esto.",
        CODIGOS.SIN_PERMISOS
      ));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}

export async function isClerkAdminRequest(req: Request) {
  if (!isClerkConfigured()) return false;

  const { userId } = getAuth(req);
  if (!userId) return false;

  const user = await clerkClient.users.getUser(userId);
  const emails = user.emailAddresses.map((email) =>
    email.emailAddress.toLowerCase()
  );
  const allowedEmails = getAllowedAdminEmails();

  return emails.some((email) => allowedEmails.has(email));
}

function getAllowedAdminEmails() {
  return new Set(
    [
      ...(process.env.CLERK_ADMIN_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
      process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "",
    ].filter(Boolean)
  );
}
