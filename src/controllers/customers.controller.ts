import { clerkClient, getAuth } from "@clerk/express";
import type { Request, Response } from "express";
import { HttpError } from "../lib/http.js";
import { getOrCreateCustomerFromClerk } from "../services/customers.service.js";

export async function getMeCustomer(req: Request, res: Response) {
  const { userId } = getAuth(req);

  if (!userId) {
    throw new HttpError(401, "Authentication required");
  }

  const user = await clerkClient.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress;

  if (!email) {
    throw new HttpError(400, "Clerk user must have a primary email address");
  }

  const customer = await getOrCreateCustomerFromClerk({
    clerkUserId: userId,
    email,
    name: user.fullName ?? user.firstName ?? email,
    phone: user.primaryPhoneNumber?.phoneNumber ?? null,
  });

  res.json(customer);
}
