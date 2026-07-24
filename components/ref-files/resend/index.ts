import "server-only";

import { Resend } from "resend";

export type EmailMessage = {
  readonly from: string;
  readonly html?: string;
  readonly replyTo?: string;
  readonly subject: string;
  readonly text: string;
  readonly to: readonly string[];
};

export type EmailSendResult = {
  readonly id: string | null;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export function createResendEmailSender(input: {
  readonly apiKey: string;
}): EmailSender {
  const resend = new Resend(input.apiKey);

  return {
    async send(message) {
      const { data, error } = await resend.emails.send({
        from: message.from,
        html: message.html,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        to: [...message.to],
      });

      if (error) {
        throw new Error(error.message);
      }

      return { id: data?.id ?? null };
    },
  };
}
