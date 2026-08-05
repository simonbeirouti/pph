import type { Database } from "@/lib/supabase/database.types"

export type JobScheduleRecurrence =
  Database["public"]["Enums"]["job_schedule_recurrence"]
export type JobScheduleOccurrenceStatus =
  Database["public"]["Enums"]["job_schedule_occurrence_status"]

export type JobTemplate = {
  assigneeMembershipId: number | null
  createdAt: string
  description: string
  id: number
  isActive: boolean
  location: string
  minimumCompletionPhotos: number
  priority: Database["public"]["Enums"]["job_priority"]
  requiresCompletionNote: boolean
  title: string
  updatedAt: string
}

export type JobScheduleOccurrence = {
  attemptCount: number
  generatedAt: string | null
  id: number
  jobId: number | null
  lastAttemptedAt: string | null
  lastError: string | null
  occurrenceAt: string
  scheduleId: number
  status: JobScheduleOccurrenceStatus
}

export type JobSchedule = {
  assigneeMembershipId: number | null
  createdAt: string
  deletedAt: string | null
  endsOn: string | null
  id: number
  isEnabled: boolean
  localTime: string
  nextOccurrenceAt: string | null
  occurrences: JobScheduleOccurrence[]
  recurrenceType: JobScheduleRecurrence
  startsOn: string
  templateId: number
  timezone: string
  updatedAt: string
  weekdays: number[]
}

export type TemplateEmployee = {
  displayName: string
  membershipId: number
}

export type TemplateActionState = {
  destinationId?: number
  errors?: Record<string, string[]>
  message?: string
  ok: boolean
}

export type JobTemplateOption = Pick<
  JobTemplate,
  | "assigneeMembershipId"
  | "description"
  | "id"
  | "location"
  | "minimumCompletionPhotos"
  | "priority"
  | "requiresCompletionNote"
  | "title"
>

export const INITIAL_TEMPLATE_ACTION_STATE: TemplateActionState = { ok: false }
