import "server-only";

import { createResendEmailSender } from "@eva/email";

type SendEmailInput = {
  readonly html?: string | null;
  readonly subject: string;
  readonly text: string;
  readonly to: readonly string[];
};

export async function sendProjectEmail(input: SendEmailInput) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Resend API key is not configured.");
  }

  const from = process.env.RESEND_APP_FROM_EMAIL;

  if (!from) {
    throw new Error("RESEND_APP_FROM_EMAIL is not configured.");
  }

  const sender = createResendEmailSender({ apiKey: process.env.RESEND_API_KEY });

  return sender.send({
    from,
    html: input.html ?? undefined,
    subject: input.subject,
    text: input.text,
    to: [...input.to],
  });
}
