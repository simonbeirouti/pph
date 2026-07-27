import "server-only"

import { Resend } from "resend"

export type EmailMessage = {
  from: string
  html: string
  idempotencyKey: string
  subject: string
  text: string
  to: string[]
}

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id: string | null }>
}

export function createResendEmailSender(apiKey: string): EmailSender {
  const resend = new Resend(apiKey)

  return {
    async send(message) {
      const { data, error } = await resend.emails.send(
        {
          from: message.from,
          html: message.html,
          subject: message.subject,
          text: message.text,
          to: message.to,
        },
        { idempotencyKey: message.idempotencyKey }
      )

      if (error) throw new Error(error.message)
      return { id: data?.id ?? null }
    },
  }
}
