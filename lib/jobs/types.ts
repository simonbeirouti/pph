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

export type JobRosterShiftOption = {
  employeeMembershipId: number
  endsAt: string
  id: number
  startsAt: string
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

export type JobParticipantIdentity = {
  displayName: string
  membershipId: number
  role: "employee" | "owner"
}

export type JobEvidence = {
  createdAt: string
  id: number
  mimeType: string
  removable: boolean
  signedUrl: string
  sizeBytes: number
  uploadedByMembershipId: number
}

export type JobTimelineItem = {
  authorMembershipId: number | null
  body: string | null
  createdAt: string
  id: number
  metadata: Record<string, unknown>
  type: Database["public"]["Enums"]["job_update_type"]
}

export type JobNotificationDelivery = {
  attemptCount: number
  errorMessage: string | null
  id: number
  lastAttemptedAt: string | null
  recipientEmail: string | null
  sentAt: string | null
  status: Database["public"]["Enums"]["job_notification_status"]
}

export type JobDetail = JobCard & {
  archivedAt: string | null
  createdByMembershipId: number
  evidence: JobEvidence[]
  identities: JobParticipantIdentity[]
  latestReopenFeedback: string | null
  noteCount: number
  notification: JobNotificationDelivery | null
  startedAt: string | null
  submissionVersion: number
  submittedAt: string | null
  timeline: JobTimelineItem[]
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
