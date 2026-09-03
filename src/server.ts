import "dotenv/config";
import { createApp } from "./app.js";
import { startOrderMaintenance } from "./services/orderMaintenance.service.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`Jolit backend listening on http://localhost:${port}`);
  startOrderMaintenance();
});
