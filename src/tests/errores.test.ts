import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { CODIGOS, codigoPorDefecto } from "../lib/errorCodes.js";
import { badRequest, errorHandler, HttpError, notFound } from "../lib/http.js";

/**
 * El contrato de errores de la API.
 *
 * Existe porque el codigo es lo unico estable: el texto del mensaje se puede
 * reescribir cuando queramos, y quien consuma la API no tiene que leerlo para
 * decidir. Antes no habia codigo y el panel comparaba prosa, con el resultado
 * de que un 503 de configuracion deslogueaba a la duenia.
 */

/** Finge un res de Express y guarda lo que se respondio. */
function resFalso() {
  const capturado: { status?: number; body?: any } = {};

  const res: any = {
    status(codigo: number) {
      capturado.status = codigo;
      return res;
    },
    json(cuerpo: unknown) {
      capturado.body = cuerpo;
      return res;
    },
  };

  return { res, capturado };
}

function manejar(error: unknown) {
  const { res, capturado } = resFalso();
  errorHandler(error, {} as any, res, (() => {}) as any);
  return capturado;
}

describe("forma de la respuesta de error", () => {
  it("siempre trae error y code", () => {
    const { status, body } = manejar(notFound("No encontramos ese pedido."));

    assert.equal(status, 404);
    assert.equal(body.error, "No encontramos ese pedido.");
    assert.equal(typeof body.code, "string");
  });

  it("mantiene el campo error de antes, para no romper lo que ya lo usa", () => {
    const { body } = manejar(badRequest("Algo falta."));

    assert.equal(body.error, "Algo falta.");
  });

  it("no filtra detalles internos en un error inesperado", () => {
    const { status, body } = manejar(
      new Error("connect ECONNREFUSED 127.0.0.1:5432")
    );

    assert.equal(status, 500);
    assert.equal(body.code, CODIGOS.ERROR_INTERNO);
    assert.ok(
      !body.error.includes("ECONNREFUSED"),
      "el mensaje interno no puede llegar al navegador"
    );
  });
});

describe("codigos", () => {
  it("usa el codigo que se le pasa", () => {
    const { body } = manejar(
      badRequest("Nos quedamos sin stock de Aros.", CODIGOS.STOCK_INSUFICIENTE)
    );

    assert.equal(body.code, CODIGOS.STOCK_INSUFICIENTE);
  });

  it("si no se pasa ninguno, lo deduce del estado HTTP", () => {
    assert.equal(codigoPorDefecto(401), CODIGOS.NO_AUTENTICADO);
    assert.equal(codigoPorDefecto(403), CODIGOS.SIN_PERMISOS);
    assert.equal(codigoPorDefecto(404), CODIGOS.NO_ENCONTRADO);
    assert.equal(codigoPorDefecto(503), CODIGOS.SERVICIO_NO_DISPONIBLE);

    assert.equal(new HttpError(404, "x").code, CODIGOS.NO_ENCONTRADO);
  });

  it("un problema de configuracion del servidor NO se confunde con sesion vencida", () => {
    // Este es el caso que rompia: el mensaje decia "Clerk authentication is
    // not configured" y el panel, que buscaba la palabra "authentication",
    // deslogueaba a la duenia por un problema que no era de ella.
    const { status, body } = manejar(
      new HttpError(
        503,
        "Las cuentas de clientas no estan disponibles en este momento.",
        CODIGOS.CLERK_NO_CONFIGURADO
      )
    );

    assert.equal(status, 503);
    assert.equal(body.code, CODIGOS.CLERK_NO_CONFIGURADO);
    assert.notEqual(body.code, CODIGOS.SESION_REQUERIDA);
    assert.notEqual(body.code, CODIGOS.ADMIN_AUTH_REQUERIDA);
  });

  it("la sesion vencida si viaja como 401", () => {
    const { status, body } = manejar(
      new HttpError(401, "Necesitas iniciar sesion.", CODIGOS.SESION_REQUERIDA)
    );

    assert.equal(status, 401);
    assert.equal(body.code, CODIGOS.SESION_REQUERIDA);
  });
});

describe("validacion", () => {
  const esquema = z.object({
    customerEmail: z.string().email("Reviso el email: no parece valido."),
    customerPhone: z.string().min(6, "Ingresa un telefono de contacto."),
  });

  it("con un solo campo mal, muestra ese mensaje", () => {
    const resultado = esquema.safeParse({
      customerEmail: "no-es-un-email",
      customerPhone: "1144332211",
    });

    assert.equal(resultado.success, false);

    const { status, body } = manejar(resultado.error);

    assert.equal(status, 400);
    assert.equal(body.code, CODIGOS.VALIDACION);
    assert.equal(body.error, "Reviso el email: no parece valido.");
  });

  it("con varios campos mal, usa el mensaje general y detalla aparte", () => {
    const resultado = esquema.safeParse({ customerEmail: "x", customerPhone: "1" });

    assert.equal(resultado.success, false);

    const { body } = manejar(resultado.error);

    assert.match(body.error, /campo mal completado/);
    assert.equal(body.details.length, 2);
  });
});

describe("los mensajes que ve una clienta estan en castellano", () => {
  // Palabras que delatan un mensaje sin traducir.
  const SOSPECHOSAS = [
    "not found",
    "Insufficient",
    "required",
    "invalid",
    "failed",
    "does not exist",
  ];

  const enCastellano = (texto: string) =>
    !SOSPECHOSAS.some((palabra) =>
      texto.toLowerCase().includes(palabra.toLowerCase())
    );

  it("stock insuficiente", () => {
    const { body } = manejar(
      badRequest("Nos quedamos sin stock de Aros Perla.", CODIGOS.STOCK_INSUFICIENTE)
    );

    assert.ok(enCastellano(body.error), body.error);
  });

  it("error inesperado", () => {
    const { body } = manejar(new Error("boom"));

    assert.ok(enCastellano(body.error), body.error);
  });

  it("pedido inexistente", () => {
    const { body } = manejar(
      notFound("No encontramos ese pedido.", CODIGOS.PEDIDO_NO_ENCONTRADO)
    );

    assert.ok(enCastellano(body.error), body.error);
  });
});
