"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/auth/membership"
import { createClient } from "@/lib/supabase/server"
import type { TemplateActionState } from "@/lib/templates/types"
import { scheduleSchema, templateSchema } from "@/lib/templates/validation"

function templateValues(formData: FormData) {
  return {
    assigneeMembershipId:
      String(formData.get("assigneeMembershipId") ?? "") === "none"
        ? ""
        : String(formData.get("assigneeMembershipId") ?? ""),
    description: String(formData.get("description") ?? ""),
    location: String(formData.get("location") ?? ""),
    minimumCompletionPhotos: String(
      formData.get("minimumCompletionPhotos") ?? "0"
    ),
    priority: String(formData.get("priority") ?? "normal"),
    requiresCompletionNote: formData.has("requiresCompletionNote"),
    title: String(formData.get("title") ?? ""),
  }
}

export async function saveTemplateAction(
  templateId: number | null,
  _state: TemplateActionState,
  formData: FormData
): Promise<TemplateActionState> {
  await requireOwner()
  const parsed = templateSchema.safeParse(templateValues(formData))
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Check the highlighted template fields.",
      ok: false,
    }
  }

  const supabase = await createClient()
  const args = {
    ...(parsed.data.assigneeMembershipId
      ? {
          p_assignee_membership_id: Number(parsed.data.assigneeMembershipId),
        }
      : {}),
    p_description: parsed.data.description,
    p_location: parsed.data.location,
    p_minimum_completion_photos: parsed.data.minimumCompletionPhotos,
    p_priority: parsed.data.priority,
    p_requires_completion_note: parsed.data.requiresCompletionNote,
    p_title: parsed.data.title,
  }
  const { error } = templateId
    ? await supabase.rpc("upsert_job_template", {
        ...args,
        p_template_id: templateId,
      })
    : await supabase.rpc("create_job_template", args)

  if (error) return { message: "Unable to save the template.", ok: false }
  revalidatePath("/dashboard/templates")
  revalidatePath("/dashboard/jobs")
  return { message: "Template saved.", ok: true }
}

export async function setTemplateActiveAction(
  templateId: number,
  isActive: boolean
) {
  await requireOwner()
  const supabase = await createClient()
  const { error } = await supabase.rpc("set_job_template_active", {
    p_is_active: isActive,
    p_template_id: templateId,
  })
  if (error) throw new Error("Unable to update the template")
  revalidatePath("/dashboard/templates")
  revalidatePath("/dashboard/jobs")
}

function scheduleValues(formData: FormData) {
  return {
    assigneeMembershipId: String(formData.get("assigneeMembershipId") ?? ""),
    endsOn: String(formData.get("endsOn") ?? ""),
    isEnabled: formData.has("isEnabled"),
    localTime: String(formData.get("localTime") ?? ""),
    recurrenceType: String(formData.get("recurrenceType") ?? "daily"),
    startsOn: String(formData.get("startsOn") ?? ""),
    templateId: String(formData.get("templateId") ?? ""),
    weekdays: formData.getAll("weekdays").map(String),
  }
}

export async function saveScheduleAction(
  scheduleId: number | null,
  _state: TemplateActionState,
  formData: FormData
): Promise<TemplateActionState> {
  await requireOwner()
  const parsed = scheduleSchema.safeParse(scheduleValues(formData))
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Check the highlighted schedule fields.",
      ok: false,
    }
  }

  const supabase = await createClient()
  const args = {
    p_assignee_membership_id: Number(parsed.data.assigneeMembershipId),
    ...(parsed.data.endsOn ? { p_ends_on: parsed.data.endsOn } : {}),
    p_is_enabled: parsed.data.isEnabled,
    p_local_time: parsed.data.localTime,
    p_recurrence_type: parsed.data.recurrenceType,
    p_starts_on: parsed.data.startsOn,
    p_template_id: Number(parsed.data.templateId),
    p_weekdays:
      parsed.data.recurrenceType === "weekly"
        ? [...new Set(parsed.data.weekdays)].toSorted((a, b) => a - b)
        : [],
  }
  const { error } = scheduleId
    ? await supabase.rpc("upsert_job_schedule", {
        ...args,
        p_schedule_id: scheduleId,
      })
    : await supabase.rpc("create_job_schedule", args)

  if (error) {
    return {
      message: error.message.includes("future occurrence")
        ? "This schedule has no future occurrence in its date range."
        : "Unable to save the schedule.",
      ok: false,
    }
  }
  revalidatePath("/dashboard/templates")
  return { message: "Schedule saved.", ok: true }
}

export async function setScheduleEnabledAction(
  scheduleId: number,
  isEnabled: boolean
) {
  await requireOwner()
  const supabase = await createClient()
  const { error } = await supabase.rpc("set_job_schedule_enabled", {
    p_is_enabled: isEnabled,
    p_schedule_id: scheduleId,
  })
  if (error) throw new Error("Unable to update the schedule")
  revalidatePath("/dashboard/templates")
}

export async function deleteScheduleAction(scheduleId: number) {
  await requireOwner()
  const supabase = await createClient()
  const { error } = await supabase.rpc("delete_job_schedule", {
    p_schedule_id: scheduleId,
  })
  if (error) throw new Error("Unable to delete the schedule")
  revalidatePath("/dashboard/templates")
}

export async function retryScheduleAction(scheduleId: number) {
  await requireOwner()
  const supabase = await createClient()
  const { error } = await supabase.rpc("retry_job_schedule", {
    p_schedule_id: scheduleId,
  })
  if (error) throw new Error("Unable to retry the schedule")
  revalidatePath("/dashboard/templates")
  revalidatePath("/dashboard/jobs")
  revalidatePath("/dashboard")
}
