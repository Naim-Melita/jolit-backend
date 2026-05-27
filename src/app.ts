import express from "express";
import path from "node:path";
import { requireAdmin } from "./lib/adminAuth.js";
import { errorHandler, notFound } from "./lib/http.js";
import { authRouter } from "./routes/auth.js";
import { categoriesRouter } from "./routes/categories.js";
import { healthRouter } from "./routes/health.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";
import { settingsRouter } from "./routes/settings.js";
import { shippingRouter } from "./routes/shipping.js";
import { uploadsRouter } from "./routes/uploads.js";

export function createApp() {
  const app = express();
  const configuredOrigins = (process.env.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([
    ...configuredOrigins,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  app.use(express.json());
  app.use((req, res, next) => {
    const origin = req.header("origin");
    if (origin && allowedOrigins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    next();
  });

  app.options("*", (_req, res) => res.status(204).send());

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/shipping", shippingRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/uploads", requireAdmin, uploadsRouter);
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  app.use((_req, _res, next) => next(notFound("Route not found")));
  app.use(errorHandler);

  return app;
}
