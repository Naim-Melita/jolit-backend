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

export async function listSubscribers(): Promise<Subscriber[]> {
  const subscribers = await prisma.subscriber.findMany({
    orderBy: { createdAt: "desc" },
  });

  return subscribers.map(toSubscriberResponse);
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
