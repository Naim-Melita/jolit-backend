import { CODIGOS } from "./lib/errorCodes.js";
import { conYSinWww, origenesConfigurados } from "./lib/origenes.js";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { HttpError, errorHandler, notFound } from "./lib/http.js";
import { requireAdminAccess } from "./middlewares/admin.js";
import { optionalClerkMiddleware } from "./middlewares/clerk.js";
import { authRouter } from "./routes/auth.js";
import { cartRouter } from "./routes/cart.js";
import { categoriesRouter } from "./routes/categories.js";
import { materialsRouter } from "./routes/materials.js";
import { customersRouter } from "./routes/customers.js";
import { favoritesRouter } from "./routes/favorites.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";
import { ordersRouter } from "./routes/orders.js";
import { paymentsRouter } from "./routes/payments.js";
import { productsRouter } from "./routes/products.js";
import { settingsRouter } from "./routes/settings.js";
import { shippingRouter } from "./routes/shipping.js";
import { subscribersRouter } from "./routes/subscribers.js";
import { uploadsRouter } from "./routes/uploads.js";
import { webhooksRouter } from "./routes/webhooks.js";

export function createApp() {

  const app = express();

  // Necesario para que el rate limit vea la IP real detras del proxy
  // de Vercel / Render / Railway y no limite a todo el mundo junto.
  app.set("trust proxy", 1);
  const configuredOrigins = origenesConfigurados();
  // El dev server del front se permite solo fuera de produccion. Ahi vale
  // unicamente lo que diga FRONTEND_ORIGIN: no hay motivo para que la API
  // real le conteste a un navegador parado en localhost.
  const allowedOrigins = conYSinWww([
    ...configuredOrigins,
    ...(process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:5173", "http://127.0.0.1:5173"]),
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

        // Antes se rechazaba con un Error pelado y el servidor contestaba
        // 500: en el navegador parecia que la API estaba caida, cuando el
        // problema era la configuracion.
        callback(
          new HttpError(
            403,
            "Este sitio no tiene permiso para usar la API.",
            CODIGOS.SIN_PERMISOS
          )
        );
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
  /**
   * Subida de fotos.
   *
   * Veinte cada quince minutos alcanzaba para retocar un producto suelto,
   * pero no para cargar el catalogo: con cien piezas, y varias fotos cada
   * una, se trababa a los pocos minutos y habia que esperar sin saber por
   * que.
   *
   * Doscientas dan varias veces lo que una persona puede cargar a mano en
   * ese rato, porque cada producto lleva completar su formulario, y siguen
   * poniendo un techo a quien quiera abusar del endpoint. La carga masiva no
   * pasa por aca: el importador sube directo a Cloudinary.
   */
  const uploadRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
    // Sin esto contestaba el texto en ingles de la libreria.
    message: {
      error:
        "Subiste muchas fotos seguidas. Espera unos minutos y segui, o usa la carga por planilla.",
      code: CODIGOS.DEMASIADAS_PETICIONES,
    },
  });


  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRateLimit, authRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/materials", materialsRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/me", meRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/shipping", shippingRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/favorites", favoritesRouter);
  app.use("/api/subscribers", subscribersRouter);
  app.use("/api/uploads", uploadRateLimit, requireAdminAccess, uploadsRouter);

  app.use((_req, _res, next) => next(notFound("Esa direccion no existe.", CODIGOS.RUTA_NO_ENCONTRADA)));
  app.use(errorHandler);

  return app;
}
