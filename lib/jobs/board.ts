import type {
  JobBoardColumn,
  JobCard,
  JobView,
  JobWorkflowColumnKey,
} from "@/lib/jobs/types"

export const WORKFLOW_COLUMNS: readonly JobBoardColumn[] = [
  {
    description: "Jobs waiting for an employee",
    dropTarget: true,
    key: "unassigned",
    label: "Unassigned",
  },
  {
    description: "Jobs allocated to employees",
    dropTarget: true,
    key: "assigned",
    label: "Assigned",
  },
  {
    description: "Completed work awaiting approval",
    dropTarget: false,
    key: "review",
    label: "To review",
  },
]

export const ARCHIVED_COLUMNS: readonly JobBoardColumn[] = [
  {
    description: "Approved and archived jobs",
    dropTarget: false,
    key: "archived",
    label: "Archived",
  },
]

export function columnsForJobView(view: JobView) {
  return view === "workflow" ? WORKFLOW_COLUMNS : ARCHIVED_COLUMNS
}

export function jobWorkflowColumn(job: JobCard): JobWorkflowColumnKey {
  if (job.status === "archived") return "archived"
  if (job.status === "in_review") return "review"
  return job.assigneeMembershipId ? "assigned" : "unassigned"
}

export function jobMatchesView(job: JobCard, view: JobView) {
  return view === "archived"
    ? job.status === "archived"
    : job.status !== "archived"
}

export function sortJobsByUrgency(jobs: readonly JobCard[]) {
  return jobs.toSorted(
    (a, b) =>
      priorityRank(b.priority) - priorityRank(a.priority) ||
      dueRank(a) - dueRank(b) ||
      b.updatedAt.localeCompare(a.updatedAt)
  )
}

function priorityRank(priority: JobCard["priority"]) {
  return { high: 2, low: 0, normal: 1, urgent: 3 }[priority]
}

function dueRank(job: JobCard) {
  return job.dueAt ? new Date(job.dueAt).getTime() : Number.MAX_SAFE_INTEGER
}
