import { prisma } from "../lib/prisma.js";
import type { settingsSchema } from "../schemas.js";
import type { StoreSettings } from "../types.js";
import type { z } from "zod";

type SettingsInput = z.infer<typeof settingsSchema>;

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Jolit",
  whatsappNumber: "5491131134189",
  shipping: {
    provider: "Correo Argentino",
    service: "PAQ.AR",
    freeShippingMinimum: 100000,
    cabaRate: 2500,
    gbaRate: 3500,
    interiorRate: 5500,
  },
  promoBanner: {
    enabled: false,
    title: "Hot Sale Jolit",
    message: "Promociones especiales por tiempo limitado.",
    ctaLabel: "Ver ofertas",
    ctaUrl: "/catalog",
    startsAt: "",
    endsAt: "",
  },
};

export async function getStoreSettings(): Promise<StoreSettings> {
  const settings = await prisma.storeSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      storeName: DEFAULT_SETTINGS.storeName,
      whatsappNumber: DEFAULT_SETTINGS.whatsappNumber,
      shipping: DEFAULT_SETTINGS.shipping,
      promoBanner: DEFAULT_SETTINGS.promoBanner,
    },
    update: {},
  });

  return normalizeSettings(settings);
}

export async function updateStoreSettings(
  input: SettingsInput
): Promise<StoreSettings> {
  const current = await getStoreSettings();

  const settings = await prisma.storeSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      storeName: input.storeName,
      whatsappNumber: input.whatsappNumber,
      shipping: {
        ...DEFAULT_SETTINGS.shipping,
        ...input.shipping,
      },
      promoBanner: {
        ...DEFAULT_SETTINGS.promoBanner,
        ...input.promoBanner,
      },
    },
    update: {
      storeName: input.storeName,
      whatsappNumber: input.whatsappNumber,
      shipping: {
        ...current.shipping,
        ...input.shipping,
      },
      promoBanner: {
        ...current.promoBanner,
        ...input.promoBanner,
      },
    },
  });

  return normalizeSettings(settings);
}

function normalizeSettings(settings: {
  storeName: string;
  whatsappNumber: string;
  shipping: unknown;
  promoBanner: unknown;
}): StoreSettings {
  return {
    storeName: settings.storeName,
    whatsappNumber: settings.whatsappNumber,
    shipping: {
      ...DEFAULT_SETTINGS.shipping,
      ...(isObject(settings.shipping) ? settings.shipping : {}),
    },
    promoBanner: {
      ...DEFAULT_SETTINGS.promoBanner,
      ...(isObject(settings.promoBanner) ? settings.promoBanner : {}),
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
