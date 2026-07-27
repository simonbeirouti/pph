import "server-only"

import { cache } from "react"

import {
  requireActiveMembership,
  requireEmployee,
  requireOwner,
} from "@/lib/auth/membership"
import { listEmployees } from "@/lib/employees/data"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import type {
  EmployeeJobSummary,
  JobBoardEmployee,
  JobCard,
  JobDetail,
  JobRosterShiftOption,
  OwnerJobAggregates,
} from "@/lib/jobs/types"
import { sortJobsByUrgency } from "@/lib/jobs/board"

type JobRow = Tables<"jobs">

const JOB_FIELDS =
  "id, assignee_membership_id, title, description, location, priority, status, scheduled_at, due_at, requires_completion_note, minimum_completion_photos, updated_at"

export function toJobCard(row: JobRow): JobCard {
  return {
    assigneeMembershipId: row.assignee_membership_id,
    description: row.description,
    dueAt: row.due_at,
    id: row.id,
    location: row.location,
    minimumCompletionPhotos: row.minimum_completion_photos,
    priority: row.priority,
    requiresCompletionNote: row.requires_completion_note,
    scheduledAt: row.scheduled_at,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  }
}

export const getOwnerJobBoardData = cache(async () => {
  const owner = await requireOwner()
  const supabase = await createClient()
  const [employees, jobsResult, shiftsResult] = await Promise.all([
    listEmployees(),
    supabase
      .from("jobs")
      .select(JOB_FIELDS)
      .eq("organisation_id", owner.organisationId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("roster_shifts")
      .select("id, employee_membership_id, starts_at, ends_at")
      .eq("organisation_id", owner.organisationId)
      .is("archived_at", null)
      .gt("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(500),
  ])

  if (jobsResult.error || shiftsResult.error) {
    throw new Error("Unable to load jobs")
  }

  return {
    employees: employees.map((employee): JobBoardEmployee => ({
      active: employee.status === "active",
      avatarUrl: employee.avatarUrl,
      displayName: employee.displayName,
      jobTitle: employee.jobTitle,
      membershipId: employee.membershipId,
    })),
    jobs: (jobsResult.data ?? []).map((row) => toJobCard(row as JobRow)),
    rosterShifts: (shiftsResult.data ?? []).map(
      (shift): JobRosterShiftOption => ({
        employeeMembershipId: shift.employee_membership_id,
        endsAt: shift.ends_at,
        id: shift.id,
        startsAt: shift.starts_at,
      })
    ),
    timezone: owner.timezone,
  }
})

export const getEmployeeAssignedJobs = cache(async (): Promise<JobCard[]> => {
  const employee = await requireEmployee()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_FIELDS)
    .eq("organisation_id", employee.organisationId)
    .eq("assignee_membership_id", employee.membershipId)
    .neq("status", "archived")

  if (error) throw new Error("Unable to load assigned jobs")

  return sortJobsByUrgency((data ?? []).map((row) => toJobCard(row as JobRow)))
})

export const getJobDetail = cache(
  async (jobId: number): Promise<JobDetail | null> => {
    const membership = await requireActiveMembership()
    const supabase = await createClient()
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("organisation_id", membership.organisationId)
      .eq("id", jobId)
      .maybeSingle()

    if (jobError || !job) return null

    const [assetsResult, updatesResult, identitiesResult, notificationResult] =
      await Promise.all([
        supabase
          .from("job_assets")
          .select("*")
          .eq("job_id", jobId)
          .is("archived_at", null)
          .order("created_at", { ascending: true }),
        supabase
          .from("job_updates")
          .select("*")
          .eq("job_id", jobId)
          .order("created_at", { ascending: true }),
        supabase.rpc("list_job_participant_identities", { p_job_id: jobId }),
        membership.role === "owner"
          ? supabase
              .from("job_notification_deliveries")
              .select("*")
              .eq("job_id", jobId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

    if (
      assetsResult.error ||
      updatesResult.error ||
      identitiesResult.error ||
      notificationResult.error
    ) {
      throw new Error("Unable to load job details")
    }

    const assets = assetsResult.data ?? []
    const signedResult = assets.length
      ? await supabase.storage.from("job-evidence").createSignedUrls(
          assets.map((asset) => asset.storage_path),
          5 * 60
        )
      : { data: [], error: null }

    if (signedResult.error) throw new Error("Unable to load job evidence")

    const signedByPath = new Map(
      (signedResult.data ?? []).map((signed) => [signed.path, signed.signedUrl])
    )
    const timeline = (updatesResult.data ?? []).map((update) => ({
      authorMembershipId: update.author_membership_id,
      body: update.body,
      createdAt: update.created_at,
      id: update.id,
      metadata:
        update.metadata &&
        typeof update.metadata === "object" &&
        !Array.isArray(update.metadata)
          ? (update.metadata as Record<string, unknown>)
          : {},
      type: update.type,
    }))
    const notification = notificationResult.data

    return {
      ...toJobCard(job as JobRow),
      archivedAt: job.archived_at,
      createdByMembershipId: job.created_by,
      evidence: assets.flatMap((asset) => {
        const signedUrl = signedByPath.get(asset.storage_path)
        return signedUrl
          ? [
              {
                createdAt: asset.created_at,
                id: asset.id,
                mimeType: asset.mime_type,
                removable:
                  membership.role === "employee" &&
                  (job.status === "assigned" || job.status === "in_progress") &&
                  asset.uploaded_by_membership_id === membership.membershipId &&
                  asset.submission_version === job.submission_version,
                signedUrl,
                sizeBytes: asset.size_bytes,
                uploadedByMembershipId: asset.uploaded_by_membership_id,
              },
            ]
          : []
      }),
      identities: (identitiesResult.data ?? []).map((identity) => ({
        displayName: identity.display_name,
        membershipId: identity.membership_id,
        role: identity.role,
      })),
      latestReopenFeedback:
        [...timeline]
          .reverse()
          .find((item) => item.metadata.event === "reopen_feedback")?.body ??
        null,
      noteCount: timeline.filter((item) => item.type === "note").length,
      notification: notification
        ? {
            attemptCount: notification.attempt_count,
            errorMessage: notification.error_message,
            id: notification.id,
            lastAttemptedAt: notification.last_attempted_at,
            recipientEmail: notification.recipient_email,
            sentAt: notification.sent_at,
            status: notification.status,
          }
        : null,
      startedAt: job.started_at,
      submissionVersion: job.submission_version,
      submittedAt: job.submitted_at,
      timeline,
    }
  }
)

export async function getEmployeeJobSummary(
  membershipId: number
): Promise<EmployeeJobSummary> {
  const owner = await requireOwner()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_FIELDS)
    .eq("organisation_id", owner.organisationId)
    .eq("assignee_membership_id", membershipId)
    .order("updated_at", { ascending: false })

  if (error) throw new Error("Unable to load employee jobs")
  const jobs = (data ?? []).map((row) => toJobCard(row as JobRow))

  return {
    active: jobs.filter((job) => job.status !== "archived"),
    archived: jobs.filter((job) => job.status === "archived").slice(0, 5),
  }
}

export async function listEmployeeJobSummaries(): Promise<
  Record<number, EmployeeJobSummary>
> {
  const owner = await requireOwner()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_FIELDS)
    .eq("organisation_id", owner.organisationId)
    .not("assignee_membership_id", "is", null)
    .order("updated_at", { ascending: false })

  if (error) throw new Error("Unable to load employee job summaries")
  const summaries: Record<number, EmployeeJobSummary> = {}

  for (const row of data ?? []) {
    const job = toJobCard(row as JobRow)
    if (!job.assigneeMembershipId) continue
    const summary = (summaries[job.assigneeMembershipId] ??= {
      active: [],
      archived: [],
    })
    if (job.status === "archived") {
      if (summary.archived.length < 5) summary.archived.push(job)
    } else {
      summary.active.push(job)
    }
  }

  return summaries
}

export const getOwnerJobAggregates = cache(
  async (): Promise<OwnerJobAggregates> => {
    const owner = await requireOwner()
    const supabase = await createClient()
    const [outstanding, review, urgent] = await Promise.all([
      supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("organisation_id", owner.organisationId)
        .in("status", ["assigned", "in_progress"]),
      supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("organisation_id", owner.organisationId)
        .eq("status", "in_review"),
      supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("organisation_id", owner.organisationId)
        .eq("priority", "urgent")
        .neq("status", "archived"),
    ])

    if (outstanding.error || review.error || urgent.error) {
      throw new Error("Unable to load job aggregates")
    }

    return {
      awaitingReview: review.count ?? 0,
      highUrgency: urgent.count ?? 0,
      outstanding: outstanding.count ?? 0,
    }
  }
)
