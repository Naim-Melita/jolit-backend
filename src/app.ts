import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { errorHandler, notFound } from "./lib/http.js";
import { requireAdminAccess } from "./middlewares/admin.js";
import { optionalClerkMiddleware } from "./middlewares/clerk.js";
import { authRouter } from "./routes/auth.js";
import { cartRouter } from "./routes/cart.js";
import { categoriesRouter } from "./routes/categories.js";
import { customersRouter } from "./routes/customers.js";
import { favoritesRouter } from "./routes/favorites.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";
import { settingsRouter } from "./routes/settings.js";
import { shippingRouter } from "./routes/shipping.js";
import { uploadsRouter } from "./routes/uploads.js";
import { webhooksRouter } from "./routes/webhooks.js";

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

  app.use(helmet());
  app.use("/api/webhooks", webhooksRouter);
  app.use(express.json());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      },
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    })
  );
  app.options("*", cors());
  app.use(optionalClerkMiddleware());

  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const uploadRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRateLimit, authRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/me", meRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/shipping", shippingRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/favorites", favoritesRouter);
  app.use("/api/uploads", uploadRateLimit, requireAdminAccess, uploadsRouter);

  app.use((_req, _res, next) => next(notFound("Route not found")));
  app.use(errorHandler);

  return app;
}
