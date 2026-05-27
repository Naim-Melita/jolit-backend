export type ShippingQuote = {
  provider: "Correo Argentino";
  service: "PAQ.AR";
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
      eta: "2 a 4 dias habiles",
    };
  }

  return {
    label: "Correo Argentino a domicilio - Interior",
    cost: rates.interiorRate,
    eta: "3 a 7 dias habiles",
  };
}

function readMoneyEnv(key: string, fallback: number) {
  const rawValue = process.env[key]?.trim();
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
