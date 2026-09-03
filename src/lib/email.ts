const RESEND_ENDPOINT = "https://api.resend.com/emails";

let warnedMissingConfig = false;

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type EmailAttachment = {
  filename: string;
  content: Buffer;
};

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
};

/**
 * Envia un mail por Resend. Nunca lanza: si el mail falla, el pedido ya se
 * guardo y no queremos romper la compra por una notificacion.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!isEmailConfigured()) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(
        "Email deshabilitado: faltan RESEND_API_KEY o EMAIL_FROM. Los pedidos se guardan igual."
      );
    }
    return false;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.attachments?.length
          ? {
              // Resend espera el contenido del adjunto en base64.
              attachments: input.attachments.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content.toString("base64"),
              })),
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`Resend respondio ${response.status}: ${detail}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("No se pudo enviar el mail", error);
    return false;
  }
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
