import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

// Cuando arranco este proceso. Sirve para saber, desde afuera, si un cambio
// ya esta desplegado: si el servidor viene corriendo desde antes del push,
// todavia tiene el codigo viejo. Sin esto habia que adivinar.
const arrancadoEn = new Date().toISOString();

/** El commit desplegado, si la plataforma lo deja en el entorno. */
function commitDesplegado() {
  return (
    process.env.GIT_COMMIT ??
    process.env.RENDER_GIT_COMMIT ??
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    null
  );
}

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
      startedAt: arrancadoEn,
      commit: commitDesplegado(),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.json({
    status: "ok",
    service: "jolit-backend",
    database: "up",
    startedAt: arrancadoEn,
    commit: commitDesplegado(),
    timestamp: new Date().toISOString(),
  });
});
