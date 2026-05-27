import type { NextFunction, Request, Response } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { badRequest, HttpError } from "./http.js";
import { readDb, writeDb } from "./store.js";

const DEFAULT_ADMIN_EMAIL = "admin@jolit.local";
const DEFAULT_ADMIN_PASSWORD = "admin123";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function getAdminEmail() {
  const admin = readDb().admin;
  if (admin?.email) return admin.email;

  const email = process.env.ADMIN_EMAIL;

  if (isProduction()) {
    throw new Error("Admin account must be configured in production");
  }

  return email || DEFAULT_ADMIN_EMAIL;
}

function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;

  if (isProduction()) {
    throw new Error("Admin account must be configured in production");
  }

  return password || DEFAULT_ADMIN_PASSWORD;
}

export function getAdminToken() {
  return Buffer.from(`${getAdminEmail()}:${getAdminTokenSecret()}`).toString(
    "base64"
  );
}

function getAdminTokenSecret() {
  const admin = readDb().admin;
  return admin?.passwordHash || getAdminPassword();
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString("hex"),
  };
}

function verifyPassword(password: string, hash: string, salt: string) {
  const candidate = Buffer.from(hashPassword(password, salt).hash, "hex");
  const expected = Buffer.from(hash, "hex");

  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

function verifyAdminPassword(password: string) {
  const admin = readDb().admin;

  if (admin?.passwordHash && admin.passwordSalt) {
    return verifyPassword(password, admin.passwordHash, admin.passwordSalt);
  }

  return password === getAdminPassword();
}

export function loginAdmin(email: string, password: string) {
  if (!email || !password) {
    throw badRequest("Email and password are required");
  }

  if (email !== getAdminEmail() || !verifyAdminPassword(password)) {
    throw new HttpError(401, "Invalid admin credentials");
  }

  return {
    token: getAdminToken(),
    user: {
      name: "Admin",
      email: getAdminEmail(),
    },
  };
}

export function changeAdminPassword(currentPassword: string, newPassword: string) {
  if (!verifyAdminPassword(currentPassword)) {
    throw new HttpError(401, "Invalid current password");
  }

  const db = readDb();
  const nextPassword = hashPassword(newPassword);

  db.admin = {
    name: db.admin?.name ?? "Admin",
    email: db.admin?.email ?? getAdminEmail(),
    passwordHash: nextPassword.hash,
    passwordSalt: nextPassword.salt,
  };

  writeDb(db);

  return {
    token: getAdminToken(),
    user: {
      name: db.admin.name,
      email: db.admin.email,
    },
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";

  if (token !== getAdminToken()) {
    next(new HttpError(401, "Admin authentication required"));
    return;
  }

  next();
}
