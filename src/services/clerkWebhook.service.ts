import { Webhook } from "svix";
import { HttpError } from "../lib/http.js";
import {
  deleteCustomerClerkLink,
  upsertCustomerFromClerk,
} from "./customers.service.js";

type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{
      id: string;
      email_address: string;
    }>;
    primary_email_address_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone_numbers?: Array<{
      id: string;
      phone_number: string;
    }>;
    primary_phone_number_id?: string | null;
  };
};

export async function handleClerkWebhook(
  payload: string,
  headers: {
    svixId?: string;
    svixTimestamp?: string;
    svixSignature?: string;
  }
) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;

  if (!secret) {
    throw new HttpError(503, "Clerk webhook secret is not configured");
  }

  if (!headers.svixId || !headers.svixTimestamp || !headers.svixSignature) {
    throw new HttpError(400, "Missing Clerk webhook signature headers");
  }

  const webhook = new Webhook(secret);
  const event = webhook.verify(payload, {
    "svix-id": headers.svixId,
    "svix-timestamp": headers.svixTimestamp,
    "svix-signature": headers.svixSignature,
  }) as ClerkWebhookEvent;

  if (event.type === "user.created" || event.type === "user.updated") {
    await syncClerkUser(event);
  }

  if (event.type === "user.deleted") {
    await deleteCustomerClerkLink(event.data.id);
  }

  return { received: true };
}

async function syncClerkUser(event: ClerkWebhookEvent) {
  const primaryEmail =
    event.data.email_addresses?.find(
      (email) => email.id === event.data.primary_email_address_id
    ) ?? event.data.email_addresses?.[0];

  if (!primaryEmail) {
    throw new HttpError(400, "Clerk user must have an email address");
  }

  const primaryPhone =
    event.data.phone_numbers?.find(
      (phone) => phone.id === event.data.primary_phone_number_id
    ) ?? event.data.phone_numbers?.[0];

  const name = [event.data.first_name, event.data.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  await upsertCustomerFromClerk({
    clerkUserId: event.data.id,
    email: primaryEmail.email_address,
    name: name || primaryEmail.email_address,
    phone: primaryPhone?.phone_number ?? null,
  });
}
