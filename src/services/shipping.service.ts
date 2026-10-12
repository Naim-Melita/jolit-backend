import {
  quoteCorreoArgentino,
  type CorreoArgentinoConfig,
  type ShippingQuote,
} from "../lib/correoArgentino.js";
import {
  armarBulto,
  cotizar,
  masBarata,
  micorreoConfigurado,
} from "../lib/micorreo.js";

/**
 * El costo del envio.
 *
 * Primero le pregunta a Correo Argentino. Si no esta configurado, o si no
 * contesta, usa la tabla de zonas de siempre.
 *
 * Ese respaldo no es opcional ni temporal: esto corre mientras la clienta
 * mira la pantalla de la caja. Si Correo Argentino se cae, la venta tiene que
 * poder cerrarse igual. Es preferible cobrar un envio estimado que perder la
 * compra.
 *
 * El minimo para envio gratis se aplica despues, sobre lo que haya salido:
 * es una decision de la tienda, no del correo.
 */

export type ConfigDeEnvio = CorreoArgentinoConfig & {
  /** Desde donde se despacha. Sin esto no se puede cotizar de verdad. */
  originPostalCode: string;
  /** Cuanto pesa una pieza, en gramos. */
  gramsPerItem: number;
  /** El sobre o la caja, en centimetros. */
  packageHeight: number;
  packageWidth: number;
  packageLength: number;
};

export type ResultadoDeEnvio = ShippingQuote & {
  /** De donde salio el numero, para poder mirarlo en el panel y en los logs. */
  source: "correo-argentino" | "tabla";
};

export async function cotizarEnvio(
  input: {
    postalCode?: string;
    address?: string;
    city?: string;
    province?: string;
    subtotal: number;
    /** Cuantas piezas van en el paquete. */
    units?: number;
  },
  config: ConfigDeEnvio
): Promise<ResultadoDeEnvio> {
  const respaldo = quoteCorreoArgentino(input, config);

  const destino = (input.postalCode ?? "").replace(/\D/g, "");
  const origen = (config.originPostalCode ?? "").replace(/\D/g, "");

  // Sin codigo postal de las dos puntas no hay nada que preguntar.
  if (!micorreoConfigurado() || !destino || !origen) {
    return { ...respaldo, source: "tabla" };
  }

  try {
    const tarifas = await cotizar({
      postalCodeOrigin: origen,
      postalCodeDestination: destino,
      deliveredType: "D",
      dimensions: [
        armarBulto(input.units ?? 1, {
          gramosPorPieza: config.gramsPerItem,
          alto: config.packageHeight,
          ancho: config.packageWidth,
          largo: config.packageLength,
        }),
      ],
    });

    const elegida = masBarata(tarifas, "D");

    if (!elegida || !Number.isFinite(elegida.price) || elegida.price <= 0) {
      return { ...respaldo, source: "tabla" };
    }

    const gratis = input.subtotal >= config.freeShippingMinimum;

    return {
      provider: "Correo Argentino",
      service: elegida.productName || respaldo.service,
      label: `Correo Argentino a domicilio - ${elegida.productName}`.trim(),
      cost: gratis ? 0 : elegida.price,
      eta: demora(elegida.deliveryTimeMin, elegida.deliveryTimeMax) || respaldo.eta,
      isEstimated: false,
      configured: true,
      source: "correo-argentino",
    };
  } catch (error) {
    // No se corta la venta por esto. Queda en los logs para poder mirarlo.
    console.error(
      "Correo Argentino no pudo cotizar, se usa la tabla:",
      error instanceof Error ? error.message : error
    );

    return { ...respaldo, source: "tabla" };
  }
}

function demora(min?: number, max?: number) {
  if (!min && !max) return "";
  if (min && max && min !== max) return `${min} a ${max} días hábiles`;

  const dias = max ?? min;
  return `${dias} ${dias === 1 ? "día hábil" : "días hábiles"}`;
}
