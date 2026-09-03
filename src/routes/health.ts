import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  // Un health check que responde "ok" con la base caida no sirve para
  // monitorear: si no podemos consultar, la tienda no puede vender.
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("Health check: la base no responde", error);

    res.status(503).json({
      status: "error",
      service: "jolit-backend",
      database: "down",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.json({
    status: "ok",
    service: "jolit-backend",
    database: "up",
    timestamp: new Date().toISOString(),
  });
});
