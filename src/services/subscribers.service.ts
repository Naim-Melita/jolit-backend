import {
  armarPagina,
  desdeElCursor,
  resolverLimite,
  type Pagina,
} from "../lib/paginacion.js";
import { prisma } from "../lib/prisma.js";
import type { subscriberSchema } from "../schemas.js";
import type { Subscriber } from "../types.js";
import type { z } from "zod";

type SubscriberInput = z.infer<typeof subscriberSchema>;

export async function createSubscriber(
  input: SubscriberInput
): Promise<Subscriber> {
  // Reintentar con el mismo email actualiza los datos en vez de fallar:
  // la persona no tiene por que enterarse de si ya estaba anotada.
  const subscriber = await prisma.subscriber.upsert({
    where: { email: input.email },
    create: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source,
    },
    update: {
      name: input.name,
      ...(input.phone ? { phone: input.phone } : {}),
    },
  });

  return toSubscriberResponse(subscriber);
}

const SUSCRIPTORES_POR_PAGINA = 50;
const MAX_SUSCRIPTORES_POR_PAGINA = 200;

/**
 * La lista de suscriptores solo crece. Antes se devolvia entera en cada carga
 * del panel.
 */
export async function listSubscribers(options: { limit?: number; cursor?: number } = {}): Promise<Pagina<Subscriber>> {
  const limite = resolverLimite(
    options.limit,
    SUSCRIPTORES_POR_PAGINA,
    MAX_SUSCRIPTORES_POR_PAGINA
  );

  const subscribers = await prisma.subscriber.findMany({
    take: limite + 1,
    ...desdeElCursor(options.cursor),
    orderBy: { id: "desc" },
  });

  return armarPagina(subscribers, limite, toSubscriberResponse);
}

function toSubscriberResponse(subscriber: {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  source: string;
  createdAt: Date;
}): Subscriber {
  return {
    id: subscriber.id,
    name: subscriber.name,
    email: subscriber.email,
    phone: subscriber.phone ?? "",
    source: subscriber.source,
    createdAt: subscriber.createdAt.toISOString(),
  };
}
