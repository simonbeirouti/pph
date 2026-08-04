import { notFound } from "next/navigation"

import { JobsScreen } from "@/components/jobs/jobs-screen"
import { requireActiveMembership } from "@/lib/auth/membership"
import {
  getEmployeeAssignedJobs,
  getJobDetail,
  getOwnerJobsPageData,
} from "@/lib/jobs/data"

const ARCHIVE_PAGE_SIZE = 15

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    employee?: string | string[]
    job?: string | string[]
    mode?: string | string[]
    page?: string | string[]
    priority?: string | string[]
    status?: string | string[]
    view?: string | string[]
  }>
}) {
  const membership = await requireActiveMembership()
  const params = await searchParams
  const rawJobId = params.job
  const rawEmployeeId = params.employee
  const selectedEmployeeId =
    typeof rawEmployeeId === "string" && /^[1-9]\d*$/.test(rawEmployeeId)
      ? Number(rawEmployeeId)
      : null
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
  const rawPage = params.page
  const parsedArchivePage =
    typeof rawPage === "string" && /^[1-9]\d*$/.test(rawPage)
      ? Number(rawPage)
      : null
  const archivePage =
    rawPage === undefined
      ? 1
      : parsedArchivePage !== null && Number.isSafeInteger(parsedArchivePage)
        ? parsedArchivePage
        : null
  const mode =
    membership.role === "manager" && params.mode === "my-work"
      ? "my-work"
      : "team"
  if (
    (rawEmployeeId !== undefined && !selectedEmployeeId) ||
    (params.status !== undefined && !status) ||
    (params.priority !== undefined && !priority) ||
    (params.mode !== undefined &&
      params.mode !== "team" &&
      params.mode !== "my-work") ||
    (params.view !== undefined &&
      params.view !== "workflow" &&
      params.view !== "archived") ||
    !archivePage ||
    (rawPage !== undefined && view !== "archived")
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
      <JobsScreen
        detail={detail}
        employees={[]}
        filterActive={false}
        jobs={jobs}
        mode="my-work"
        role={membership.role}
        rosterShifts={[]}
        templates={[]}
        timezone={membership.timezone}
        view="workflow"
      />
    )
  }

  const [data, detail] = await Promise.all([
    getOwnerJobsPageData(archivePage, ARCHIVE_PAGE_SIZE),
    selectedJobId ? getJobDetail(selectedJobId) : null,
  ])
  if (
    selectedEmployeeId &&
    !data.employees.some(
      (employee) => employee.membershipId === selectedEmployeeId
    )
  ) {
    notFound()
  }
  if (selectedJobId && !detail) notFound()
  if (archivePage > data.archivePagination.totalPages) notFound()
  const filteredJobs = data.jobs.filter(
    (job) =>
      (!status ||
        (status === "outstanding"
          ? job.status === "assigned" || job.status === "in_progress"
          : job.status === "in_review")) &&
      (!priority || job.priority === priority)
  )

  return (
    <JobsScreen
      archivePagination={data.archivePagination}
      detail={detail}
      employees={data.employees}
      filterActive={Boolean(status || priority || selectedEmployeeId)}
      initialEmployeeFilter={selectedEmployeeId}
      jobs={filteredJobs}
      mode={mode}
      role={membership.role}
      rosterShifts={data.rosterShifts}
      templates={data.templates}
      timezone={data.timezone}
      view={view}
    />
  )
}
