import "dotenv/config";
import { createApp } from "./app.js";
import { assertAdminAuthConfig } from "./lib/adminAuth.js";
import { warnIfNotConfigured } from "./lib/mercadopago.js";
import {
  startOrderMaintenance,
  startPaymentReconciliation,
} from "./services/orderMaintenance.service.js";

assertAdminAuthConfig();

const port = Number(process.env.PORT ?? 4000);

/**
 * Por defecto escuchamos solo en loopback: en un VPS con nginx adelante, si
 * bindeamos a 0.0.0.0 el puerto queda accesible por IP directa, salteando el
 * proxy y el SSL. Nginx le pega por 127.0.0.1, asi que no pierde nada.
 *
 * En plataformas tipo Render o Railway hay que exponerlo igual: ahi se pone
 * HOST=0.0.0.0.
 */
const host = process.env.HOST ?? "127.0.0.1";
const app = createApp();

app.listen(port, host, () => {
  console.log(`Jolit backend listening on http://${host}:${port}`);
  startOrderMaintenance();
  startPaymentReconciliation();
  warnIfNotConfigured();
});
