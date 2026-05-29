import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http.js";

export function isClerkConfigured() {
  return Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export function optionalClerkMiddleware() {
  if (!isClerkConfigured()) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return clerkMiddleware();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!isClerkConfigured()) {
    next(new HttpError(503, "Clerk authentication is not configured"));
    return;
  }

  const { userId } = getAuth(req);

  if (!userId) {
    next(new HttpError(401, "Authentication required"));
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
      next(new HttpError(503, "Clerk authentication is not configured"));
      return;
    }

    const { userId } = getAuth(req);

    if (!userId) {
      next(new HttpError(401, "Authentication required"));
      return;
    }

    const user = await clerkClient.users.getUser(userId);
    const emails = user.emailAddresses.map((email) =>
      email.emailAddress.toLowerCase()
    );
    const allowedEmails = getAllowedAdminEmails();
    const isAllowed = emails.some((email) => allowedEmails.has(email));

    if (!isAllowed) {
      next(new HttpError(403, "Admin access required"));
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
