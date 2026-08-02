import "server-only"

import { createResendEmailSender, type EmailSender } from "@/lib/email/sender"
import { createAdminClient } from "@/lib/supabase/admin"

type SubmissionEmailInput = {
  employeeName: string
  from: string
  idempotencyKey: string
  jobTitle: string
  minimumCompletionPhotos: number
  organisationName: string
  recipientEmail: string
  requiresCompletionNote: boolean
  reviewUrl: string
  submittedAt: string
}

export function buildSubmissionEmail(input: SubmissionEmailInput) {
  const requirementSummary =
    [
      input.requiresCompletionNote ? "Completion note required" : null,
      input.minimumCompletionPhotos > 0
        ? `${input.minimumCompletionPhotos} completion ${
            input.minimumCompletionPhotos === 1 ? "photo" : "photos"
          } required`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "No completion evidence requirements"
  const subject = `${input.jobTitle} is ready for review`
  const submittedAt = new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(input.submittedAt))
  const text = [
    `${input.employeeName} submitted “${input.jobTitle}” for ${input.organisationName}.`,
    `Submitted: ${submittedAt}`,
    `Requirements: ${requirementSummary}`,
    `Review the job: ${input.reviewUrl}`,
  ].join("\n\n")
  const logoUrl = new URL(
    "/icons/logo-transparent.png",
    input.reviewUrl
  ).toString()
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f5f5; color: #171717; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #ffffff;">
            <tr>
              <td align="center" style="padding-top: 32px;">
                <img src="${escapeHtml(logoUrl)}" width="144" alt="Pure Peninsula Honey" style="display: block; width: 144px; max-width: 100%; height: auto; border: 0;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 32px; text-align: center;">
                <p style="margin: 0 0 12px; color: #854d0e; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; line-height: 20px; text-transform: uppercase;">Ready for review</p>
                <h1 style="margin: 0 0 12px; color: #171717; font-size: 26px; line-height: 34px;">A job has been submitted</h1>
                <p style="margin: 0 0 24px; color: #525252; font-size: 16px; line-height: 26px;">${escapeHtml(input.employeeName)} has submitted <strong>${escapeHtml(input.jobTitle)}</strong> for ${escapeHtml(input.organisationName)}.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px; background-color: #fefce8;">
                  <tr>
                    <td style="padding: 18px 20px; color: #422006; font-size: 14px; line-height: 22px; text-align: left;">
                      <strong>Submitted</strong><br />${escapeHtml(submittedAt)}<br /><br />
                      <strong>Completion requirements</strong><br />${escapeHtml(requirementSummary)}
                    </td>
                  </tr>
                </table>
                <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#facc15" style="border-radius: 8px;">
                      <a href="${escapeHtml(input.reviewUrl)}" style="display: inline-block; padding: 12px 20px; color: #422006; font-size: 15px; font-weight: 700; line-height: 20px; text-decoration: none;">Review the job</a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 24px 0 0; color: #737373; font-size: 13px; line-height: 20px;">You are receiving this because you created this job.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return {
    from: input.from,
    html,
    idempotencyKey: input.idempotencyKey,
    subject,
    text,
    to: [input.recipientEmail],
  }
}

export async function deliverJobSubmissionEmail(
  deliveryId: number,
  origin: string,
  sender?: EmailSender
): Promise<"failed" | "sent" | "skipped"> {
  const admin = createAdminClient()
  const { data: delivery } = await admin
    .from("job_notification_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .maybeSingle()

  if (!delivery || delivery.status === "sent") return "skipped"
  if (!delivery.recipient_email || !delivery.recipient_membership_id) {
    await markFailed(deliveryId, "The job creator is not an active owner.")
    return "failed"
  }

  const [{ data: job }, { data: organisation }, { data: submission }] =
    await Promise.all([
      admin.from("jobs").select("*").eq("id", delivery.job_id).maybeSingle(),
      admin
        .from("organisations")
        .select("name")
        .eq("id", delivery.organisation_id)
        .maybeSingle(),
      admin
        .from("job_updates")
        .select("author_membership_id")
        .eq("id", delivery.submission_update_id)
        .maybeSingle(),
    ])

  if (!job || !organisation || !submission?.author_membership_id) {
    await markFailed(deliveryId, "The submission email could not be prepared.")
    return "failed"
  }

  const [{ data: employeeMembership }, { data: employeeProfile }] =
    await Promise.all([
      admin
        .from("memberships")
        .select("email")
        .eq("id", submission.author_membership_id)
        .maybeSingle(),
      admin
        .from("employee_profiles")
        .select("first_name, last_name")
        .eq("membership_id", submission.author_membership_id)
        .maybeSingle(),
    ])
  const employeeName =
    [employeeProfile?.first_name, employeeProfile?.last_name]
      .filter(Boolean)
      .join(" ") ||
    employeeMembership?.email?.split("@")[0] ||
    "An employee"
  const reviewUrl = new URL(`/dashboard/jobs?job=${job.id}`, origin).toString()
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_APP_FROM_EMAIL?.trim()
  const testSender =
    process.env.PPH_PLAYWRIGHT_SERVER === "1"
      ? {
          async send() {
            return { id: `playwright-${delivery.submission_update_id}` }
          },
        }
      : undefined
  const effectiveSender = sender ?? testSender
  const message = buildSubmissionEmail({
    employeeName,
    from: from ?? "jobs@playwright.invalid",
    idempotencyKey: `job-submitted/${delivery.submission_update_id}/${delivery.recipient_membership_id}`,
    jobTitle: job.title,
    minimumCompletionPhotos: job.minimum_completion_photos,
    organisationName: organisation.name,
    recipientEmail: delivery.recipient_email,
    requiresCompletionNote: job.requires_completion_note,
    reviewUrl,
    submittedAt: job.submitted_at ?? new Date().toISOString(),
  })

  await admin
    .from("job_notification_deliveries")
    .update({
      attempt_count: delivery.attempt_count + 1,
      error_message: null,
      html_body: message.html,
      last_attempted_at: new Date().toISOString(),
      review_url: reviewUrl,
      status: "sending",
      subject: message.subject,
      text_body: message.text,
    })
    .eq("id", deliveryId)

  if (!effectiveSender && (!apiKey || !from)) {
    await markFailed(
      deliveryId,
      "Resend is not configured. Add the application email environment values."
    )
    return "failed"
  }

  try {
    const result = await (
      effectiveSender ?? createResendEmailSender(apiKey!)
    ).send(message)
    await admin
      .from("job_notification_deliveries")
      .update({
        error_message: null,
        provider_message_id: result.id,
        sent_at: new Date().toISOString(),
        status: "sent",
      })
      .eq("id", deliveryId)
    return "sent"
  } catch (error) {
    await markFailed(
      deliveryId,
      error instanceof Error
        ? error.message.slice(0, 500)
        : "Resend rejected the email."
    )
    return "failed"
  }
}

async function markFailed(deliveryId: number, message: string) {
  await createAdminClient()
    .from("job_notification_deliveries")
    .update({ error_message: message, status: "failed" })
    .eq("id", deliveryId)
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '"': "&quot;",
        "&": "&amp;",
        "'": "&#039;",
        "<": "&lt;",
        ">": "&gt;",
      })[character] ?? character
  )
}
