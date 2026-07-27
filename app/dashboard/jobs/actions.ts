"use server"

import { revalidatePath } from "next/cache"
import { randomUUID } from "node:crypto"
import { z } from "zod"

import {
  requireActiveMembership,
  requireEmployee,
  requireOwner,
} from "@/lib/auth/membership"
import { deliverJobSubmissionEmail } from "@/lib/email/job-submission"
import { getRequestOrigin } from "@/lib/http/origin"
import { toJobCard } from "@/lib/jobs/data"
import type { JobActionState, JobCard } from "@/lib/jobs/types"
import { jobSchema, localDateTimeToIso } from "@/lib/jobs/validation"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Tables } from "@/lib/supabase/database.types"
import { getSupabasePublicConfig } from "@/lib/supabase/public-env"
import { createClient } from "@/lib/supabase/server"
import {
  detectImageMimeType,
  extensionForImageMimeType,
  IMAGE_MIME_EXTENSIONS,
} from "@/lib/uploads/image"

type JobRow = Tables<"jobs">

function jobFormValues(formData: FormData) {
  const rawAssignee = String(formData.get("assigneeMembershipId") ?? "")

  return {
    assigneeMembershipId: rawAssignee === "unassigned" ? "" : rawAssignee,
    description: String(formData.get("description") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    location: String(formData.get("location") ?? ""),
    minimumCompletionPhotos: String(
      formData.get("minimumCompletionPhotos") ?? "0"
    ),
    priority: String(formData.get("priority") ?? "normal"),
    requiresCompletionNote: formData.has("requiresCompletionNote"),
    scheduledAt: String(formData.get("scheduledAt") ?? ""),
    title: String(formData.get("title") ?? ""),
  }
}

function preservedJobValues(values: ReturnType<typeof jobFormValues>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value)])
  )
}

export async function createJobAction(
  _state: JobActionState,
  formData: FormData
): Promise<JobActionState> {
  const owner = await requireOwner()
  const values = jobFormValues(formData)
  const parsed = jobSchema.safeParse(values)

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Check the highlighted fields.",
      ok: false,
      values: preservedJobValues(values),
    }
  }

  const supabase = await createClient()
  const assigneeMembershipId = parsed.data.assigneeMembershipId
    ? Number(parsed.data.assigneeMembershipId)
    : null
  const dueAt = localDateTimeToIso(parsed.data.dueAt, owner.timezone)
  const scheduledAt = localDateTimeToIso(
    parsed.data.scheduledAt,
    owner.timezone
  )
  const { data, error } = await supabase.rpc("create_job", {
    ...(assigneeMembershipId
      ? { p_assignee_membership_id: assigneeMembershipId }
      : {}),
    p_description: parsed.data.description,
    ...(dueAt ? { p_due_at: dueAt } : {}),
    p_location: parsed.data.location,
    p_minimum_completion_photos: parsed.data.minimumCompletionPhotos,
    p_priority: parsed.data.priority,
    p_requires_completion_note: parsed.data.requiresCompletionNote,
    ...(scheduledAt ? { p_scheduled_at: scheduledAt } : {}),
    p_title: parsed.data.title,
  })

  if (error || !data) {
    return {
      message: "Unable to create the job. Check the assignee and times.",
      ok: false,
      values: preservedJobValues(values),
    }
  }

  const job = toJobCard(data as JobRow)
  revalidatePath("/dashboard/jobs")
  if (job.assigneeMembershipId) {
    revalidatePath(`/dashboard/employees/${job.assigneeMembershipId}`)
  }
  revalidatePath("/dashboard")
  return { job, message: "Job created.", ok: true }
}

export async function updateJobAction(
  jobId: number,
  _state: JobActionState,
  formData: FormData
): Promise<JobActionState> {
  const owner = await requireOwner()
  const values = jobFormValues(formData)
  const parsed = jobSchema.safeParse(values)

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Check the highlighted fields.",
      ok: false,
      values: preservedJobValues(values),
    }
  }

  const supabase = await createClient()
  const assigneeMembershipId = parsed.data.assigneeMembershipId
    ? Number(parsed.data.assigneeMembershipId)
    : null
  const dueAt = localDateTimeToIso(parsed.data.dueAt, owner.timezone)
  const scheduledAt = localDateTimeToIso(
    parsed.data.scheduledAt,
    owner.timezone
  )
  const { data, error } = await supabase.rpc("update_job", {
    ...(assigneeMembershipId
      ? { p_assignee_membership_id: assigneeMembershipId }
      : {}),
    p_description: parsed.data.description,
    ...(dueAt ? { p_due_at: dueAt } : {}),
    p_job_id: jobId,
    p_location: parsed.data.location,
    p_minimum_completion_photos: parsed.data.minimumCompletionPhotos,
    p_priority: parsed.data.priority,
    p_requires_completion_note: parsed.data.requiresCompletionNote,
    ...(scheduledAt ? { p_scheduled_at: scheduledAt } : {}),
    p_title: parsed.data.title,
  })

  if (error || !data) {
    return {
      message: "Unable to update the job. Check the assignee and times.",
      ok: false,
      values: preservedJobValues(values),
    }
  }

  const job = toJobCard(data as JobRow)
  revalidatePath("/dashboard/jobs")
  revalidatePath("/dashboard/employees")
  revalidatePath("/dashboard")
  return { job, message: "Job updated.", ok: true }
}

export async function reassignJobAction(
  jobId: number,
  assigneeMembershipId: number | null
): Promise<{ job?: JobCard; message: string; ok: boolean }> {
  await requireOwner()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("reassign_job", {
    ...(assigneeMembershipId
      ? { p_assignee_membership_id: assigneeMembershipId }
      : {}),
    p_job_id: jobId,
  })

  if (error || !data) {
    return {
      message: "Could not save the assignment. The card was moved back.",
      ok: false,
    }
  }

  const job = toJobCard(data as JobRow)
  revalidatePath("/dashboard/jobs")
  revalidatePath("/dashboard/employees")
  revalidatePath("/dashboard")
  return { job, message: "Assignment updated.", ok: true }
}

type SimpleActionResult = { message: string; ok: boolean }

const jobTextSchema = z.object({
  body: z.string().trim().min(1).max(4_000),
  jobId: z.coerce.number().int().positive(),
})

function refreshJobViews(assigneeMembershipId?: number | null) {
  revalidatePath("/dashboard/jobs")
  revalidatePath("/dashboard")
  if (assigneeMembershipId) {
    revalidatePath(`/dashboard/employees/${assigneeMembershipId}`)
  }
}

export async function startJobAction(
  jobId: number
): Promise<SimpleActionResult> {
  await requireEmployee()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("start_job", { p_job_id: jobId })
  if (error || !data) {
    return { message: "This job cannot be started.", ok: false }
  }
  refreshJobViews(data.assignee_membership_id)
  return { message: "Job started.", ok: true }
}

export async function addJobNoteAction(
  jobId: number,
  body: string
): Promise<SimpleActionResult> {
  const parsed = jobTextSchema.safeParse({ body, jobId })
  if (!parsed.success) return { message: "Enter a note.", ok: false }
  await requireEmployee()
  const supabase = await createClient()
  const { error } = await supabase.rpc("add_job_note", {
    p_body: parsed.data.body,
    p_job_id: parsed.data.jobId,
  })
  if (error) return { message: "The note could not be added.", ok: false }
  refreshJobViews()
  return { message: "Note added.", ok: true }
}

export async function addJobCommentAction(
  jobId: number,
  body: string
): Promise<SimpleActionResult> {
  const parsed = jobTextSchema.safeParse({ body, jobId })
  if (!parsed.success) return { message: "Enter a comment.", ok: false }
  await requireActiveMembership()
  const supabase = await createClient()
  const { error } = await supabase.rpc("add_job_comment", {
    p_body: parsed.data.body,
    p_job_id: parsed.data.jobId,
  })
  if (error) return { message: "The comment could not be added.", ok: false }
  refreshJobViews()
  return { message: "Comment added.", ok: true }
}

const evidenceRequestSchema = z.object({
  jobId: z.coerce.number().int().positive(),
  mimeType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]),
  sizeBytes: z.coerce
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
})

export async function prepareJobEvidenceUploadAction(input: {
  jobId: number
  mimeType: string
  sizeBytes: number
}): Promise<
  | {
      bucketName: string
      objectName: string
      ok: true
      signature: string
      uploadUrl: string
    }
  | { message: string; ok: false }
> {
  const employee = await requireEmployee()
  const parsed = evidenceRequestSchema.safeParse(input)
  if (!parsed.success) {
    return {
      message:
        "Choose a JPEG, PNG, WebP, HEIC, or HEIF image no larger than 10 MB.",
      ok: false,
    }
  }

  const supabase = await createClient()
  const [{ data: job }, { count }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, status, assignee_membership_id")
      .eq("organisation_id", employee.organisationId)
      .eq("id", parsed.data.jobId)
      .maybeSingle(),
    supabase
      .from("job_assets")
      .select("*", { count: "exact", head: true })
      .eq("job_id", parsed.data.jobId)
      .is("archived_at", null),
  ])
  if (
    !job ||
    job.assignee_membership_id !== employee.membershipId ||
    !["assigned", "in_progress"].includes(job.status)
  ) {
    return { message: "This job is not editable.", ok: false }
  }
  if ((count ?? 0) >= 10) {
    return { message: "A job can contain at most 10 photos.", ok: false }
  }

  const objectName = `${employee.organisationId}/${job.id}/${
    employee.membershipId
  }/${randomUUID()}.${extensionForImageMimeType(parsed.data.mimeType)}`
  const { data, error } = await supabase.storage
    .from("job-evidence")
    .createSignedUploadUrl(objectName)
  if (error || !data) {
    return { message: "The upload could not be prepared.", ok: false }
  }

  return {
    bucketName: "job-evidence",
    objectName,
    ok: true,
    signature: data.token,
    uploadUrl: `${getSupabasePublicConfig().url}/storage/v1/upload/resumable`,
  }
}

export async function finalizeJobEvidenceUploadAction(input: {
  jobId: number
  objectName: string
}): Promise<SimpleActionResult> {
  const employee = await requireEmployee()
  const expectedPrefix = `${employee.organisationId}/${input.jobId}/${employee.membershipId}/`
  if (!input.objectName.startsWith(expectedPrefix)) {
    return { message: "The uploaded photo is unavailable.", ok: false }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from("job-evidence")
    .download(input.objectName)
  if (error || !data) {
    return { message: "The uploaded photo could not be verified.", ok: false }
  }

  const bytes = new Uint8Array(await data.arrayBuffer())
  const mimeType = detectImageMimeType(bytes)
  if (
    !mimeType ||
    !(mimeType in IMAGE_MIME_EXTENSIONS) ||
    bytes.byteLength > 10 * 1024 * 1024
  ) {
    await admin.storage.from("job-evidence").remove([input.objectName])
    return {
      message:
        "The upload is not a valid JPEG, PNG, WebP, HEIC, or HEIF image.",
      ok: false,
    }
  }

  const supabase = await createClient()
  const { error: finalizeError } = await supabase.rpc("finalize_job_evidence", {
    p_job_id: input.jobId,
    p_mime_type: mimeType,
    p_size_bytes: bytes.byteLength,
    p_storage_path: input.objectName,
  })
  if (finalizeError) {
    await admin.storage.from("job-evidence").remove([input.objectName])
    return { message: "The photo could not be added to this job.", ok: false }
  }
  refreshJobViews(employee.membershipId)
  return { message: "Photo added.", ok: true }
}

export async function removeJobEvidenceAction(
  jobId: number,
  assetId: number
): Promise<SimpleActionResult> {
  await requireEmployee()
  const supabase = await createClient()
  const { error } = await supabase.rpc("archive_job_evidence", {
    p_asset_id: assetId,
    p_job_id: jobId,
  })
  if (error) {
    return { message: "Submitted evidence cannot be removed.", ok: false }
  }
  refreshJobViews()
  return { message: "Photo removed.", ok: true }
}

export async function submitJobAction(
  jobId: number
): Promise<SimpleActionResult> {
  const employee = await requireEmployee()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("submit_job", { p_job_id: jobId })
  const submission = data?.[0]
  if (error || !submission) {
    return {
      message:
        error?.message ??
        "Add the required completion information before submitting.",
      ok: false,
    }
  }

  refreshJobViews(employee.membershipId)
  if (submission.notification_id) {
    try {
      await deliverJobSubmissionEmail(
        submission.notification_id,
        await getRequestOrigin()
      )
    } catch {
      // Submission is complete even when the non-transactional email fails.
    }
  }
  return { message: "Job submitted for review.", ok: true }
}

export async function reopenJobAction(input: {
  assigneeMembershipId: number
  feedback: string
  jobId: number
}): Promise<SimpleActionResult> {
  await requireOwner()
  const parsed = z
    .object({
      assigneeMembershipId: z.coerce.number().int().positive(),
      feedback: z.string().trim().min(1).max(4_000),
      jobId: z.coerce.number().int().positive(),
    })
    .safeParse(input)
  if (!parsed.success) {
    return {
      message: "Feedback and an active assignee are required.",
      ok: false,
    }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc("reopen_job", {
    p_assignee_membership_id: parsed.data.assigneeMembershipId,
    p_feedback: parsed.data.feedback,
    p_job_id: parsed.data.jobId,
  })
  if (error) return { message: "The job could not be reopened.", ok: false }
  refreshJobViews(parsed.data.assigneeMembershipId)
  return { message: "Job reopened with feedback.", ok: true }
}

export async function archiveJobAction(
  jobId: number
): Promise<SimpleActionResult> {
  await requireOwner()
  const supabase = await createClient()
  const { error } = await supabase.rpc("archive_job", { p_job_id: jobId })
  if (error) return { message: "The job could not be approved.", ok: false }
  refreshJobViews()
  return { message: "Job approved and archived.", ok: true }
}

export async function retryJobNotificationAction(
  deliveryId: number
): Promise<SimpleActionResult> {
  await requireOwner()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("retry_job_notification", {
    p_delivery_id: deliveryId,
  })
  if (error || !data) {
    return { message: "The notification could not be retried.", ok: false }
  }
  const result = await deliverJobSubmissionEmail(
    deliveryId,
    await getRequestOrigin()
  )
  refreshJobViews()
  return result === "sent"
    ? { message: "Notification email sent.", ok: true }
    : {
        message: "The email is still unavailable. Check Resend configuration.",
        ok: false,
      }
}
