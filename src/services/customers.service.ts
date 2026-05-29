import { prisma } from "../lib/prisma.js";

type ClerkCustomerInput = {
  clerkUserId: string;
  email: string;
  name: string;
  phone?: string | null;
};

export async function upsertCustomerFromClerk(input: ClerkCustomerInput) {
  return prisma.customer.upsert({
    where: { clerkUserId: input.clerkUserId },
    create: {
      clerkUserId: input.clerkUserId,
      email: input.email,
      name: input.name,
      phone: input.phone,
    },
    update: {
      email: input.email,
      name: input.name,
      phone: input.phone,
    },
  });
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
