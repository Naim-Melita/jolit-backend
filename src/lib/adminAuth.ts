import type { NextFunction, Request, Response } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { badRequest, HttpError } from "./http.js";
import { prisma } from "./prisma.js";

const DEFAULT_ADMIN_EMAIL = "admin@jolit.local";
const DEFAULT_ADMIN_PASSWORD = "admin123";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export async function getAdminAccount() {
  const admin = await prisma.adminAccount.findFirst({
    orderBy: { id: "asc" },
  });

  if (admin) return admin;

  if (isProduction()) {
    throw new Error("Admin account must be configured in production");
  }

  const password = hashPassword(getEnvAdminPassword());

  return prisma.adminAccount.create({
    data: {
      name: "Admin",
      email: process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
      passwordHash: password.hash,
      passwordSalt: password.salt,
    },
  });
}

export async function getAdminEmail() {
  const admin = await getAdminAccount();
  if (admin?.email) return admin.email;

  const email = process.env.ADMIN_EMAIL;

  if (isProduction()) {
    throw new Error("Admin account must be configured in production");
  }

  return email || DEFAULT_ADMIN_EMAIL;
}

function getEnvAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;

  if (isProduction()) {
    throw new Error("Admin account must be configured in production");
  }

  return password || DEFAULT_ADMIN_PASSWORD;
}

export async function getAdminToken() {
  return Buffer.from(`${await getAdminEmail()}:${await getAdminTokenSecret()}`).toString(
    "base64"
  );
}

async function getAdminTokenSecret() {
  const admin = await getAdminAccount();
  return admin.passwordHash;
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

async function verifyAdminPassword(password: string) {
  const admin = await getAdminAccount();

  if (admin?.passwordHash && admin.passwordSalt) {
    return verifyPassword(password, admin.passwordHash, admin.passwordSalt);
  }

  return password === getEnvAdminPassword();
}

export async function loginAdmin(email: string, password: string) {
  if (!email || !password) {
    throw badRequest("Email and password are required");
  }

  const admin = await getAdminAccount();

  if (email !== admin.email || !(await verifyAdminPassword(password))) {
    throw new HttpError(401, "Invalid admin credentials");
  }

  return {
    token: await getAdminToken(),
    user: {
      name: admin.name,
      email: admin.email,
    },
  };
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
) {
  if (!(await verifyAdminPassword(currentPassword))) {
    throw new HttpError(401, "Invalid current password");
  }

  const nextPassword = hashPassword(newPassword);
  const admin = await getAdminAccount();

  const updatedAdmin = await prisma.adminAccount.update({
    where: { id: admin.id },
    data: {
      passwordHash: nextPassword.hash,
      passwordSalt: nextPassword.salt,
    },
  });

  return {
    token: await getAdminToken(),
    user: {
      name: updatedAdmin.name,
      email: updatedAdmin.email,
    },
  };
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";

    if (token !== (await getAdminToken())) {
      next(new HttpError(401, "Admin authentication required"));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
