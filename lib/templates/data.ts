import "server-only"

import { cache } from "react"

import { requireOwner } from "@/lib/auth/membership"
import { listActiveEmployeeOptions } from "@/lib/employees/data"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import type {
  JobSchedule,
  JobScheduleOccurrence,
  JobTemplate,
  TemplateEmployee,
} from "@/lib/templates/types"

type TemplateRow = Tables<"job_templates">
type OccurrenceRow = Tables<"job_schedule_occurrences">

export function toJobTemplate(row: TemplateRow): JobTemplate {
  return {
    assigneeMembershipId: row.assignee_membership_id,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    isActive: row.is_active,
    location: row.location,
    minimumCompletionPhotos: row.minimum_completion_photos,
    priority: row.priority,
    requiresCompletionNote: row.requires_completion_note,
    title: row.title,
    updatedAt: row.updated_at,
  }
}

function toOccurrence(row: OccurrenceRow): JobScheduleOccurrence {
  return {
    attemptCount: row.attempt_count,
    generatedAt: row.generated_at,
    id: row.id,
    jobId: row.job_id,
    lastAttemptedAt: row.last_attempted_at,
    lastError: row.last_error,
    occurrenceAt: row.occurrence_at,
    scheduleId: row.schedule_id,
    status: row.status,
  }
}

export const getTemplateScheduleData = cache(async () => {
  const owner = await requireOwner()
  const supabase = await createClient()
  const [employees, templatesResult, schedulesResult, occurrencesResult] =
    await Promise.all([
      listActiveEmployeeOptions(),
      supabase
        .from("job_templates")
        .select("*")
        .eq("organisation_id", owner.organisationId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("job_schedules")
        .select("*")
        .eq("organisation_id", owner.organisationId)
        .is("deleted_at", null)
        .order("next_occurrence_at", {
          ascending: true,
          nullsFirst: false,
        }),
      supabase
        .from("job_schedule_occurrences")
        .select("*")
        .eq("organisation_id", owner.organisationId)
        .order("occurrence_at", { ascending: false })
        .limit(100),
    ])

  if (
    templatesResult.error ||
    schedulesResult.error ||
    occurrencesResult.error
  ) {
    throw new Error("Unable to load templates and schedules")
  }

  const occurrencesBySchedule = new Map<number, JobScheduleOccurrence[]>()
  for (const row of occurrencesResult.data ?? []) {
    const occurrence = toOccurrence(row as OccurrenceRow)
    const group = occurrencesBySchedule.get(occurrence.scheduleId) ?? []
    if (group.length < 10) group.push(occurrence)
    occurrencesBySchedule.set(occurrence.scheduleId, group)
  }

  return {
    employees: employees.map((employee): TemplateEmployee => ({
      displayName: employee.displayName,
      membershipId: employee.employeeMembershipId,
    })),
    schedules: (schedulesResult.data ?? []).map((row): JobSchedule => ({
      assigneeMembershipId: row.assignee_membership_id,
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
      endsOn: row.ends_on,
      id: row.id,
      isEnabled: row.is_enabled,
      localTime: row.local_time.slice(0, 5),
      nextOccurrenceAt: row.next_occurrence_at,
      occurrences: occurrencesBySchedule.get(row.id) ?? [],
      recurrenceType: row.recurrence_type,
      startsOn: row.starts_on,
      templateId: row.template_id,
      timezone: row.timezone,
      updatedAt: row.updated_at,
      weekdays: row.weekdays,
    })),
    templates: (templatesResult.data ?? []).map((row) =>
      toJobTemplate(row as TemplateRow)
    ),
    timezone: owner.organisationTimezone,
  }
})

export const getActiveJobTemplates = cache(async (): Promise<JobTemplate[]> => {
  const owner = await requireOwner()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("job_templates")
    .select("*")
    .eq("organisation_id", owner.organisationId)
    .eq("is_active", true)
    .order("title")

  if (error) throw new Error("Unable to load job templates")
  return (data ?? []).map((row) => toJobTemplate(row as TemplateRow))
})
