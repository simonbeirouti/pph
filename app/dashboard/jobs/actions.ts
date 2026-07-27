"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/auth/membership"
import { toJobCard } from "@/lib/jobs/data"
import type { JobActionState, JobCard } from "@/lib/jobs/types"
import { jobSchema, localDateTimeToIso } from "@/lib/jobs/validation"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

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
