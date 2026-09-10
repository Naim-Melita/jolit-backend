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
const app = createApp();

app.listen(port, () => {
  console.log(`Jolit backend listening on http://localhost:${port}`);
  startOrderMaintenance();
  startPaymentReconciliation();
  warnIfNotConfigured();
});
