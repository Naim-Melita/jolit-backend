import { prisma } from "../lib/prisma.js";

type ClerkCustomerInput = {
  clerkUserId: string;
  email: string;
  name: string;
  phone?: string | null;
};

type PrismaTransaction = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

/**
 * Vincula una cuenta de Clerk con su ficha de clienta.
 *
 * `clerkUserId` y `email` son unicos por separado, asi que un upsert por
 * clerkUserId solo no alcanza: si el email ya es de otra ficha (una compra
 * como invitada, o datos migrados) el INSERT choca contra
 * `customers_email_key` y Prisma tira P2002. El orden es: buscar por Clerk,
 * si no adoptar la ficha que ya tiene ese email, y recien ahi crear una.
 *
 * Es la unica puerta de entrada para escribir una ficha desde Clerk: el
 * checkout, `/api/customers/me` y el webhook pasan todos por aca.
 */
export async function linkClerkCustomer(
  db: typeof prisma | PrismaTransaction,
  input: ClerkCustomerInput
) {
  const porClerk = await db.customer.findUnique({
    where: { clerkUserId: input.clerkUserId },
  });

  if (porClerk) {
    // No le podemos robar el email a otra ficha. Si esta tomado dejamos el
    // que ya tenia: el mail de contacto de cada pedido viaja aparte, en
    // `orders.customerEmail`.
    const emailLibre =
      porClerk.email === input.email ||
      !(await db.customer.findUnique({
        where: { email: input.email },
        select: { id: true },
      }));

    return db.customer.update({
      where: { id: porClerk.id },
      data: {
        ...(emailLibre ? { email: input.email } : {}),
        name: input.name,
        phone: input.phone,
      },
    });
  }

  const porEmail = await db.customer.findUnique({
    where: { email: input.email },
  });

  if (porEmail) {
    return db.customer.update({
      where: { id: porEmail.id },
      data: {
        clerkUserId: input.clerkUserId,
        name: input.name,
        phone: input.phone,
      },
    });
  }

  return db.customer.create({
    data: {
      clerkUserId: input.clerkUserId,
      email: input.email,
      name: input.name,
      phone: input.phone,
    },
  });
}

export async function upsertCustomerFromClerk(input: ClerkCustomerInput) {
  return linkClerkCustomer(prisma, input);
}

export async function getCustomerByClerkUserId(clerkUserId: string) {
  return prisma.customer.findUnique({
    where: { clerkUserId },
  });
}

export async function getOrCreateCustomerFromClerk(input: ClerkCustomerInput) {
  return upsertCustomerFromClerk(input);
}

export async function deleteCustomerClerkLink(clerkUserId: string) {
  return prisma.customer.updateMany({
    where: { clerkUserId },
    data: { clerkUserId: null },
  });
}
