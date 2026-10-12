export type ShippingQuote = {
  provider: "Correo Argentino";
  /** El producto de Correo Argentino. Con la API real viene su nombre. */
  service: string;
  label: string;
  cost: number;
  eta: string;
  isEstimated: boolean;
  configured: boolean;
};

export type CorreoArgentinoConfig = {
  freeShippingMinimum: number;
  cabaRate: number;
  gbaRate: number;
  interiorRate: number;
  patagoniaRate: number;
};

export function quoteCorreoArgentino(input: {
  postalCode?: string;
  address?: string;
  city?: string;
  province?: string;
  subtotal: number;
}, config?: CorreoArgentinoConfig): ShippingQuote {
  const destination = resolveDestination(input);
  const rates = {
    freeShippingMinimum: readMoneyEnv(
      "CORREO_ARGENTINO_FREE_SHIPPING_MINIMUM",
      config?.freeShippingMinimum ?? 100000
    ),
    cabaRate: readMoneyEnv("CORREO_ARGENTINO_CABA_RATE", config?.cabaRate ?? 2500),
    gbaRate: readMoneyEnv("CORREO_ARGENTINO_GBA_RATE", config?.gbaRate ?? 3500),
    interiorRate: readMoneyEnv(
      "CORREO_ARGENTINO_INTERIOR_RATE",
      config?.interiorRate ?? 5500
    ),
    patagoniaRate: readMoneyEnv(
      "CORREO_ARGENTINO_PATAGONIA_RATE",
      config?.patagoniaRate ?? 8500
    ),
  };
  const configured = Boolean(
    process.env.CORREO_ARGENTINO_API_KEY &&
      process.env.CORREO_ARGENTINO_AGREEMENT
  );
  const baseQuote = getEstimatedQuote(destination, rates);

  return {
    provider: "Correo Argentino",
    service: "PAQ.AR",
    ...baseQuote,
    cost: input.subtotal >= rates.freeShippingMinimum ? 0 : baseQuote.cost,
    isEstimated: true,
    configured,
  };
}

function resolveDestination(input: {
  postalCode?: string;
  address?: string;
  city?: string;
  province?: string;
}) {
  const numericPostalCode = Number(input.postalCode?.replace(/\D/g, "") ?? "");

  if (Number.isFinite(numericPostalCode) && numericPostalCode > 0) {
    return {
      kind: "postalCode" as const,
      postalCode: numericPostalCode,
      text: input.postalCode ?? "",
    };
  }

  const text = [input.address, input.city, input.province]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return {
    kind: "address" as const,
    postalCode: null,
    text,
  };
}

function getEstimatedQuote(
  destination: ReturnType<typeof resolveDestination>,
  rates: CorreoArgentinoConfig
) {
  if (
    (destination.kind === "postalCode" &&
      destination.postalCode >= 1000 &&
      destination.postalCode <= 1499) ||
    destination.text.includes("caba") ||
    destination.text.includes("capital federal") ||
    destination.text.includes("ciudad autonoma")
  ) {
    return {
      label: "Correo Argentino a domicilio - CABA",
      cost: rates.cabaRate,
      eta: "24 a 48 hs habiles",
    };
  }

  if (
    (destination.kind === "postalCode" &&
      destination.postalCode >= 1500 &&
      destination.postalCode <= 1999) ||
    destination.text.includes("gba") ||
    destination.text.includes("gran buenos aires") ||
    destination.text.includes("buenos aires")
  ) {
    return {
      label: "Correo Argentino a domicilio - GBA",
      cost: rates.gbaRate,
      eta: "2 a 4 días habiles",
    };
  }

  // La Patagonia va aparte porque Correo Argentino cobra bastante mas que al
  // resto del interior. Con una sola tarifa para todo, cada envio a Ushuaia
  // lo terminaba pagando la tienda.
  //
  // 8300-8500 es Rio Negro y Neuquen; 9000 en adelante, Chubut, Santa Cruz y
  // Tierra del Fuego. Bahia Blanca (8000) queda afuera: es Buenos Aires.
  if (
    (destination.kind === "postalCode" &&
      ((destination.postalCode >= 8300 && destination.postalCode <= 8500) ||
        destination.postalCode >= 9000)) ||
    destination.text.includes("patagonia") ||
    destination.text.includes("tierra del fuego") ||
    destination.text.includes("ushuaia") ||
    destination.text.includes("santa cruz") ||
    destination.text.includes("chubut") ||
    destination.text.includes("neuquen") ||
    destination.text.includes("rio negro")
  ) {
    return {
      label: "Correo Argentino a domicilio - Patagonia",
      cost: rates.patagoniaRate,
      eta: "5 a 10 días habiles",
    };
  }

  return {
    label: "Correo Argentino a domicilio - Interior",
    cost: rates.interiorRate,
    eta: "3 a 7 días habiles",
  };
}

function readMoneyEnv(key: string, fallback: number) {
  const rawValue = process.env[key]?.trim();
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
