import { notFound } from "next/navigation"
import Link from "next/link"

import { EmployeeJobsList } from "@/components/employee-jobs-list"
import { EmployeeJobDetail, OwnerJobDetail } from "@/components/job-detail"
import { JobWorkspace } from "@/components/job-workspace"
import { Button } from "@/components/ui/button"
import { requireActiveMembership } from "@/lib/auth/membership"
import {
  getEmployeeAssignedJobs,
  getJobDetail,
  getOwnerJobBoardData,
} from "@/lib/jobs/data"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    job?: string | string[]
    mode?: string | string[]
    priority?: string | string[]
    status?: string | string[]
    view?: string | string[]
  }>
}) {
  const membership = await requireActiveMembership()
  const params = await searchParams
  const rawJobId = params.job
  const selectedJobId =
    typeof rawJobId === "string" && /^[1-9]\d*$/.test(rawJobId)
      ? Number(rawJobId)
      : null
  if (rawJobId !== undefined && !selectedJobId) notFound()
  const status =
    params.status === "outstanding" || params.status === "in_review"
      ? params.status
      : null
  const priority = params.priority === "urgent" ? "urgent" : null
  const view =
    params.view === "archived" || params.view === "workflow"
      ? params.view
      : "workflow"
  const mode =
    membership.role === "manager" && params.mode === "my-work"
      ? "my-work"
      : "team"
  if (
    (params.status !== undefined && !status) ||
    (params.priority !== undefined && !priority) ||
    (params.mode !== undefined &&
      params.mode !== "team" &&
      params.mode !== "my-work") ||
    (params.view !== undefined &&
      params.view !== "workflow" &&
      params.view !== "archived")
  ) {
    notFound()
  }

  if (membership.role === "employee" || mode === "my-work") {
    const [jobs, detail] = await Promise.all([
      getEmployeeAssignedJobs(),
      selectedJobId ? getJobDetail(selectedJobId) : null,
    ])
    if (selectedJobId && !detail) notFound()

    return (
      <div className="grid gap-4">
        {membership.role === "manager" ? (
          <div className="flex gap-2">
            <Button nativeButton={false} variant="outline" render={<Link href="/dashboard/jobs" />}>
              Team workflow
            </Button>
            <Button nativeButton={false} render={<Link href="/dashboard/jobs?mode=my-work" />}>
              My work
            </Button>
          </div>
        ) : null}
        <EmployeeJobsList jobs={jobs} timezone={membership.timezone} />
        <EmployeeJobDetail detail={detail} timezone={membership.timezone} />
      </div>
    )
  }

  const [data, detail] = await Promise.all([
    getOwnerJobBoardData(),
    selectedJobId ? getJobDetail(selectedJobId) : null,
  ])
  if (selectedJobId && !detail) notFound()
  const filteredJobs = data.jobs.filter(
    (job) =>
      (!status ||
        (status === "outstanding"
          ? job.status === "assigned" || job.status === "in_progress"
          : job.status === "in_review")) &&
      (!priority || job.priority === priority)
  )

  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-0 w-full flex-col overflow-hidden md:h-[calc(100dvh-8rem)]">
      {membership.role === "manager" ? (
        <div className="mb-3 flex shrink-0 gap-2">
          <Button nativeButton={false} render={<Link href="/dashboard/jobs" />}>
            Team workflow
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href="/dashboard/jobs?mode=my-work" />}>
            My work
          </Button>
        </div>
      ) : null}
      <JobWorkspace
        employees={data.employees}
        filterActive={Boolean(status || priority)}
        initialJobs={filteredJobs}
        initialView={view}
        rosterShifts={data.rosterShifts}
        templates={data.templates}
        timezone={data.timezone}
      />
      <OwnerJobDetail
        canReview={
          membership.role === "owner" ||
          detail?.requiredReviewerRole === "manager"
        }
        detail={detail}
        employees={data.employees}
        timezone={data.timezone}
      />
    </div>
  )
}
