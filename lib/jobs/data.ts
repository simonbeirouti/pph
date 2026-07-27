import "server-only"

import { cache } from "react"

import { requireEmployee, requireOwner } from "@/lib/auth/membership"
import { listEmployees } from "@/lib/employees/data"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import type {
  EmployeeJobSummary,
  JobBoardEmployee,
  JobCard,
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
  const [employees, jobsResult] = await Promise.all([
    listEmployees(),
    supabase
      .from("jobs")
      .select(JOB_FIELDS)
      .eq("organisation_id", owner.organisationId)
      .order("updated_at", { ascending: false }),
  ])

  if (jobsResult.error) throw new Error("Unable to load jobs")

  return {
    employees: employees.map((employee): JobBoardEmployee => ({
      active: employee.status === "active",
      avatarUrl: employee.avatarUrl,
      displayName: employee.displayName,
      jobTitle: employee.jobTitle,
      membershipId: employee.membershipId,
    })),
    jobs: (jobsResult.data ?? []).map((row) => toJobCard(row as JobRow)),
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
