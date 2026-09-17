import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { ZodError } from "zod";
import { CODIGOS, codigoPorDefecto, type CodigoDeError } from "./errorCodes.js";

export class HttpError extends Error {
  public code: CodigoDeError;

  constructor(
    public status: number,
    message: string,
    code?: CodigoDeError
  ) {
    super(message);
    this.code = code ?? codigoPorDefecto(status);
  }
}

export function notFound(message = "No lo encontramos", code?: CodigoDeError) {
  return new HttpError(404, message, code);
}

export function badRequest(message = "Solicitud invalida", code?: CodigoDeError) {
  return new HttpError(400, message, code);
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

/**
 * Toda respuesta de error sale con la misma forma:
 *
 *   { error: "texto para mostrar", code: "CODIGO_ESTABLE", details?: ... }
 *
 * "error" existia antes y se mantiene para no romper nada; "code" es el que
 * hay que mirar para decidir, porque el texto puede cambiar.
 */
function responder(
  res: Response,
  status: number,
  code: CodigoDeError,
  message: string,
  details?: unknown
) {
  return res.status(status).json({
    error: message,
    code,
    ...(details === undefined ? {} : { details }),
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    // Con un solo campo mal, se muestra ese mensaje: es mucho mas util que
    // "hay algun campo mal completado" cuando lo unico que falta es el
    // telefono. Con varios, el detalle va en "details".
    const unico = error.issues.length === 1 ? error.issues[0].message : "";

    return responder(
      res,
      400,
      CODIGOS.VALIDACION,
      unico || "Reviso los datos: hay algun campo mal completado.",
      error.issues
    );
  }

  if (error instanceof HttpError) {
    return responder(res, error.status, error.code, error.message);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return responder(res, 409, CODIGOS.CONFLICTO, "Ese registro ya existe.");
    }

    if (error.code === "P2025") {
      return responder(res, 404, CODIGOS.NO_ENCONTRADO, "No lo encontramos.");
    }
  }

  if (isClerkError(error)) {
    return responder(
      res,
      401,
      CODIGOS.SESION_REQUERIDA,
      "Tu sesion vencio. Volve a ingresar."
    );
  }

  if (isMercadoPagoError(error)) {
    console.error("Mercado Pago rechazo la operacion", error);
    return responder(
      res,
      502,
      CODIGOS.PAGO_RECHAZADO_POR_PASARELA,
      "Mercado Pago no pudo procesar la operacion. Intentalo de nuevo en un momento."
    );
  }

  console.error(error);
  return responder(
    res,
    500,
    CODIGOS.ERROR_INTERNO,
    "Tuvimos un problema de nuestro lado. Intentalo de nuevo."
  );
}

function isMercadoPagoError(error: unknown): error is { message: string } {
  return error instanceof Error && error.constructor.name.startsWith("MP");
}

function isClerkError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  return "clerkError" in error;
}
