/**
 * Cliente de la API MiCorreo, de Correo Argentino.
 *
 * Hasta ahora el costo de envio salia de una tabla de tres zonas cargada a
 * mano. Servia para arrancar, pero es una estimacion: un envio a Ushuaia
 * costaba lo mismo que uno a Cordoba, y la diferencia la pagaba la tienda.
 *
 * Esto cotiza de verdad. Si no esta configurado, o si la API no contesta a
 * tiempo, se vuelve a la tabla: una clienta nunca puede quedarse sin poder
 * comprar porque un servicio ajeno no respondio.
 *
 * Las credenciales las entrega un ejecutivo de cuentas de Correo Argentino,
 * no hay registro publico. Son dos juegos distintos, uno por entorno.
 *
 * Verificar con:  npm run envio:check
 */

const BASES = {
  prueba: "https://apitest.correoargentino.com.ar/micorreo/v1",
  produccion: "https://api.correoargentino.com.ar/micorreo/v1",
} as const;

/**
 * Cuanto esperamos a Correo Argentino antes de rendirnos.
 *
 * Cuatro segundos. Esto corre mientras la clienta mira la pantalla de la
 * caja: mas que eso y abandona. Si no llego, cae a la tabla y sigue.
 */
const ESPERA_MS = 4000;

/** El JWT dura un rato; pedir uno por cotizacion seria absurdo. */
const MARGEN_DE_VENCIMIENTO_MS = 60_000;

export type TipoDeEntrega = "D" | "S";

export type Bulto = {
  /** En gramos. La API acepta de 1 a 25000. */
  weight: number;
  /** En centimetros, hasta 150 cada una. */
  height: number;
  width: number;
  length: number;
};

export type TarifaDeCorreo = {
  deliveredType: TipoDeEntrega;
  productType: string;
  productName: string;
  price: number;
  deliveryTimeMin?: number;
  deliveryTimeMax?: number;
};

export function micorreoConfigurado() {
  return Boolean(
    process.env.CORREO_ARGENTINO_USER_TOKEN &&
      process.env.CORREO_ARGENTINO_PASSWORD_TOKEN &&
      process.env.CORREO_ARGENTINO_CUSTOMER_ID
  );
}

export function entornoDeMicorreo() {
  return process.env.CORREO_ARGENTINO_ENV === "produccion" ? "produccion" : "prueba";
}

function base() {
  // El override existe para poder apuntar a un servidor propio en las pruebas,
  // y por si Correo Argentino alguna vez mueve la direccion.
  return process.env.CORREO_ARGENTINO_BASE_URL?.trim() || BASES[entornoDeMicorreo()];
}

/** Error propio, para distinguir "no contesto" de "contesto que no". */
export class ErrorDeCorreo extends Error {
  constructor(
    message: string,
    readonly estado?: number
  ) {
    super(message);
    this.name = "ErrorDeCorreo";
  }
}

async function pedir(ruta: string, opciones: RequestInit & { esperaMs?: number }) {
  const { esperaMs = ESPERA_MS, ...resto } = opciones;
  const corte = AbortSignal.timeout(esperaMs);

  let respuesta: Response;

  try {
    respuesta = await fetch(`${base()}${ruta}`, { ...resto, signal: corte });
  } catch (error) {
    const esTiempo = error instanceof Error && error.name === "TimeoutError";
    throw new ErrorDeCorreo(
      esTiempo ? `Correo Argentino no contesto en ${esperaMs} ms` : "No se pudo conectar"
    );
  }

  if (!respuesta.ok) {
    // El cuerpo del error suele traer el motivo, y entra en los logs.
    const detalle = await respuesta.text().catch(() => "");
    throw new ErrorDeCorreo(
      `Correo Argentino respondio ${respuesta.status}: ${detalle.slice(0, 200)}`,
      respuesta.status
    );
  }

  return respuesta.json();
}

let tokenEnMemoria: { valor: string; venceEn: number } | null = null;

/**
 * El JWT para las llamadas. Se pide con Basic y se guarda hasta que vence.
 *
 * Si la API no devuelve vencimiento se guarda por diez minutos, que es menos
 * de lo que suelen durar: es preferible pedir uno de mas que usar uno vencido.
 */
export async function obtenerToken(forzar = false) {
  const ahora = Date.now();

  if (!forzar && tokenEnMemoria && tokenEnMemoria.venceEn > ahora + MARGEN_DE_VENCIMIENTO_MS) {
    return tokenEnMemoria.valor;
  }

  const usuario = process.env.CORREO_ARGENTINO_USER_TOKEN ?? "";
  const clave = process.env.CORREO_ARGENTINO_PASSWORD_TOKEN ?? "";
  const basic = Buffer.from(`${usuario}:${clave}`).toString("base64");

  const datos = (await pedir("/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  })) as { token?: string; expire?: string; expires?: string };

  if (!datos.token) {
    throw new ErrorDeCorreo("Correo Argentino no devolvio token");
  }

  const vencimiento = datos.expire ?? datos.expires;
  const venceEn = vencimiento ? Date.parse(vencimiento) : NaN;

  tokenEnMemoria = {
    valor: datos.token,
    venceEn: Number.isFinite(venceEn) ? venceEn : ahora + 10 * 60_000,
  };

  return tokenEnMemoria.valor;
}

/** Para las pruebas y para el comando de chequeo. */
export function olvidarToken() {
  tokenEnMemoria = null;
}

/**
 * Cotiza un envio.
 *
 * Devuelve todas las tarifas que ofrece Correo Argentino para ese destino:
 * a domicilio y a sucursal, en sus distintos productos.
 */
export async function cotizar(input: {
  postalCodeOrigin: string;
  postalCodeDestination: string;
  dimensions: Bulto[];
  deliveredType?: TipoDeEntrega;
  esperaMs?: number;
}): Promise<TarifaDeCorreo[]> {
  const token = await obtenerToken();

  const cuerpo: Record<string, unknown> = {
    customerId: process.env.CORREO_ARGENTINO_CUSTOMER_ID,
    postalCodeOrigin: input.postalCodeOrigin,
    postalCodeDestination: input.postalCodeDestination,
    dimensions: input.dimensions,
  };

  // Sin deliveredType la API devuelve domicilio y sucursal.
  if (input.deliveredType) cuerpo.deliveredType = input.deliveredType;

  const datos = (await pedir("/rates", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cuerpo),
    esperaMs: input.esperaMs,
  })) as { rates?: TarifaDeCorreo[] };

  return datos.rates ?? [];
}

/**
 * Arma el bulto a partir de cuantas piezas van y de lo configurado.
 *
 * No se pesa pieza por pieza a proposito: son joyas, todas pesan parecido y
 * van en el mismo sobre. Cargar el peso de cada una seria un trabajo enorme
 * para una diferencia de pesos.
 *
 * El alto crece con la cantidad, que es lo unico que cambia de verdad cuando
 * entran mas piezas en el mismo sobre. La API no acepta mas de 150 cm.
 */
export function armarBulto(
  unidades: number,
  config: {
    gramosPorPieza: number;
    alto: number;
    ancho: number;
    largo: number;
  }
): Bulto {
  const piezas = Math.max(1, Math.round(unidades));

  return {
    // Entre 1 y 25000 gramos, que es lo que acepta la API.
    weight: Math.min(25000, Math.max(1, Math.round(config.gramosPorPieza * piezas))),
    height: Math.min(150, Math.max(1, Math.round(config.alto * Math.ceil(piezas / 10)))),
    width: Math.min(150, Math.max(1, Math.round(config.ancho))),
    length: Math.min(150, Math.max(1, Math.round(config.largo))),
  };
}

/** La mas barata de las que entregan a domicilio. */
export function masBarata(tarifas: TarifaDeCorreo[], tipo: TipoDeEntrega = "D") {
  const delTipo = tarifas.filter((t) => t.deliveredType === tipo);
  const candidatas = delTipo.length > 0 ? delTipo : tarifas;

  return candidatas.reduce<TarifaDeCorreo | null>(
    (mejor, t) => (mejor === null || t.price < mejor.price ? t : mejor),
    null
  );
}
