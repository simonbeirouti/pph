import type { JobPriority, JobStatus } from "@/lib/jobs/types"

export const OFFLINE_CACHE_MAX_AGE = 24 * 60 * 60 * 1000
export const OFFLINE_SCHEMA_VERSION = 1

export type OfflineIdentity = {
  membershipId: number
  organisationId: number
  role: "employee" | "manager"
}

export type OfflineEvidence = {
  acknowledged: boolean
  clientOperationId?: string
  id?: number
  mimeType: string
  sizeBytes: number
}

export type OfflineTimelineItem = {
  authorMembershipId: number | null
  body: string | null
  clientOperationId?: string
  createdAt: string
  id?: number
  pending: boolean
  type: "note" | "status_change" | "system"
}

export type OfflineJob = {
  description: string
  dueAt: string | null
  evidence: OfflineEvidence[]
  id: number
  location: string
  minimumCompletionPhotos: number
  noteCount: number
  priority: JobPriority
  requiresCompletionNote: boolean
  scheduledAt: string | null
  startedAt: string | null
  status: JobStatus
  submittedAt: string | null
  timeline: OfflineTimelineItem[]
  title: string
  version: number
}

export type OfflineWorkPack = {
  identity: OfflineIdentity
  jobs: OfflineJob[]
  refreshedAt: string
  schemaVersion: typeof OFFLINE_SCHEMA_VERSION
  timezone: string
}

export type OfflineOperationKind = "note" | "photo" | "start" | "submit"
export type OfflineOperationState =
  | "failed"
  | "needs_attention"
  | "pending"
  | "syncing"

export type OfflineOperation = {
  clientOperationId: string
  createdAt: string
  dependsOn: string[]
  expectedVersion: number
  jobId: number
  kind: OfflineOperationKind
  lastError?: string
  payload: Record<string, string | number>
  state: OfflineOperationState
}

export type ReplayResult = {
  job_version: number
  operation_status: "acknowledged" | "conflict" | "needs_attention"
  result: {
    actualVersion?: number
    assetId?: number
    jobId?: number
    reason?: string
    status?: JobStatus
    submissionUpdateId?: number
    updateId?: number
    version?: number
  }
}
