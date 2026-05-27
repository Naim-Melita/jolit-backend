import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "../types.js";

const DEFAULT_SETTINGS: Database["settings"] = {
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_DB_PATH = path.resolve(process.cwd(), "src/data/db.json");
const DIST_DB_PATH = path.resolve(__dirname, "../data/db.json");
const DB_PATH = fs.existsSync(SOURCE_DB_PATH) ? SOURCE_DB_PATH : DIST_DB_PATH;

export function readDb(): Database {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  const db = JSON.parse(raw) as Database;
  db.settings = {
    ...DEFAULT_SETTINGS,
    ...db.settings,
    promoBanner: {
      ...DEFAULT_SETTINGS.promoBanner,
      ...db.settings?.promoBanner,
    },
    shipping: {
      ...DEFAULT_SETTINGS.shipping,
      ...db.settings?.shipping,
    },
  };
  return db;
}

export function writeDb(db: Database) {
  fs.writeFileSync(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf-8");
}

export function nextId(items: Array<{ id: number }>) {
  return items.length === 0 ? 1 : Math.max(...items.map((item) => item.id)) + 1;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toMoney(value: number) {
  return value.toFixed(2);
}
