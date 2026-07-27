import type { Database } from "@/lib/supabase/database.types"

export type JobPriority = Database["public"]["Enums"]["job_priority"]
export type JobStatus = Database["public"]["Enums"]["job_status"]
export type JobView = "workflow" | "archived"
export type JobWorkflowColumnKey =
  "unassigned" | "assigned" | "review" | "archived"

export type JobCard = {
  assigneeMembershipId: number | null
  description: string
  dueAt: string | null
  id: number
  location: string
  minimumCompletionPhotos: number
  priority: JobPriority
  requiresCompletionNote: boolean
  scheduledAt: string | null
  status: JobStatus
  title: string
  updatedAt: string
}

export type JobBoardEmployee = {
  active: boolean
  avatarUrl: string | null
  displayName: string
  jobTitle: string
  membershipId: number
}

export type JobBoardColumn = {
  description: string
  dropTarget: boolean
  key: JobWorkflowColumnKey
  label: string
}

export type JobActionState = {
  errors?: Record<string, string[]>
  job?: JobCard
  message?: string
  ok: boolean
  values?: Record<string, string>
}

export type EmployeeJobSummary = {
  active: JobCard[]
  archived: JobCard[]
}

export type OwnerJobAggregates = {
  awaitingReview: number
  highUrgency: number
  outstanding: number
}

export const INITIAL_JOB_ACTION_STATE: JobActionState = { ok: false }
