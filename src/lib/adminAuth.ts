import { CODIGOS } from "../lib/errorCodes.js";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { badRequest, HttpError } from "./http.js";
import { prisma } from "./prisma.js";

const DEFAULT_ADMIN_EMAIL = "admin@jolit.local";
const DEFAULT_ADMIN_PASSWORD = "admin123";
const TOKEN_TTL = "8h";
const MIN_SECRET_LENGTH = 32;

let devSecret: string | null = null;
let warnedDevSecret = false;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * Secreto para firmar el token de admin.
 * En produccion es obligatorio; en desarrollo se genera uno al vuelo, que
 * cambia en cada reinicio (y por eso invalida las sesiones abiertas).
 */
function getJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;

  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;

  if (isProduction()) {
    throw new Error(
      `ADMIN_JWT_SECRET es obligatorio en produccion y debe tener al menos ${MIN_SECRET_LENGTH} caracteres`
    );
  }

  if (secret) {
    throw new Error(
      `ADMIN_JWT_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`
    );
  }

  if (!warnedDevSecret) {
    warnedDevSecret = true;
    console.warn(
      "ADMIN_JWT_SECRET no esta configurado: usando un secreto temporal de desarrollo."
    );
  }

  devSecret ??= randomBytes(32).toString("hex");
  return devSecret;
}

export async function getAdminAccount() {
  const admin = await prisma.adminAccount.findFirst({
    orderBy: { id: "asc" },
  });

  if (admin) return admin;

  if (isProduction()) {
    throw new Error(
      "No hay cuenta de admin. Crearla con: npm run admin:set"
    );
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
  return admin.email;
}

function getEnvAdminPassword() {
  if (isProduction()) {
    throw new Error("La cuenta de admin debe configurarse con: npm run admin:set");
  }

  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

export function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex")
) {
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

  if (!admin.passwordHash || !admin.passwordSalt) {
    throw new Error("La cuenta de admin no tiene contraseña configurada");
  }

  return verifyPassword(password, admin.passwordHash, admin.passwordSalt);
}

type AdminTokenPayload = {
  sub: string;
  email: string;
};

function issueAdminToken(admin: { id: number; email: string }) {
  return jwt.sign(
    { email: admin.email } satisfies Omit<AdminTokenPayload, "sub">,
    getJwtSecret(),
    {
      algorithm: "HS256",
      subject: String(admin.id),
      expiresIn: TOKEN_TTL,
    }
  );
}

/** Devuelve el payload si el token es valido y no vencio; si no, null. */
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  if (!token) return null;

  // Fuera del try: un secreto mal configurado tiene que explotar, no
  // disfrazarse de token invalido.
  const secret = getJwtSecret();

  try {
    // Fijamos el algoritmo: nunca se lee el del header del token.
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    });

    if (typeof payload === "string" || !payload.sub) return null;

    return {
      sub: String(payload.sub),
      email: String((payload as jwt.JwtPayload).email ?? ""),
    };
  } catch {
    return null;
  }
}

export function readBearerToken(req: Request) {
  const header = req.header("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export function isAdminTokenRequest(req: Request) {
  return verifyAdminToken(readBearerToken(req)) !== null;
}

/**
 * Se llama al arrancar: si falta configuracion, el servidor no levanta.
 * Es preferible a descubrirlo cuando alguien no puede entrar al panel.
 */
export function assertAdminAuthConfig() {
  getJwtSecret();
}

export async function loginAdmin(email: string, password: string) {
  if (!email || !password) {
    throw badRequest("Completa el email y la contrasenia.", CODIGOS.SOLICITUD_INVALIDA);
  }

  const admin = await getAdminAccount();
  const emailMatches =
    email.trim().toLowerCase() === admin.email.trim().toLowerCase();

  // Verificamos la contraseña aunque el email no coincida, para no revelar
  // por el tiempo de respuesta si el email existe.
  const passwordMatches = await verifyAdminPassword(password);

  if (!emailMatches || !passwordMatches) {
    throw new HttpError(
      401,
      "Email o contrasenia incorrectos.",
      CODIGOS.CREDENCIALES_INVALIDAS
    );
  }

  return {
    token: issueAdminToken(admin),
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
    throw new HttpError(
      401,
      "La contrasenia actual no es correcta.",
      CODIGOS.PASSWORD_ACTUAL_INVALIDA
    );
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
    token: issueAdminToken(updatedAdmin),
    user: {
      name: updatedAdmin.name,
      email: updatedAdmin.email,
    },
  };
}

export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    if (!isAdminTokenRequest(req)) {
      next(new HttpError(
        401,
        "Necesitas iniciar sesion en el panel.",
        CODIGOS.ADMIN_AUTH_REQUERIDA
      ));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
