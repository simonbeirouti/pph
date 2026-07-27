import { notFound } from "next/navigation"

import { EmployeeJobsList } from "@/components/employee-jobs-list"
import { EmployeeJobDetail, OwnerJobDetail } from "@/components/job-detail"
import { JobWorkspace } from "@/components/job-workspace"
import { requireActiveMembership } from "@/lib/auth/membership"
import {
  getEmployeeAssignedJobs,
  getJobDetail,
  getOwnerJobBoardData,
} from "@/lib/jobs/data"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ job?: string | string[] }>
}) {
  const membership = await requireActiveMembership()
  const rawJobId = (await searchParams).job
  const selectedJobId =
    typeof rawJobId === "string" && /^[1-9]\d*$/.test(rawJobId)
      ? Number(rawJobId)
      : null
  if (rawJobId !== undefined && !selectedJobId) notFound()

  if (membership.role === "employee") {
    const [jobs, detail] = await Promise.all([
      getEmployeeAssignedJobs(),
      selectedJobId ? getJobDetail(selectedJobId) : null,
    ])
    if (selectedJobId && !detail) notFound()

    return (
      <>
        <EmployeeJobsList jobs={jobs} timezone={membership.timezone} />
        <EmployeeJobDetail detail={detail} timezone={membership.timezone} />
      </>
    )
  }

  const [data, detail] = await Promise.all([
    getOwnerJobBoardData(),
    selectedJobId ? getJobDetail(selectedJobId) : null,
  ])
  if (selectedJobId && !detail) notFound()

  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-0 w-full flex-col overflow-hidden md:h-[calc(100dvh-8rem)]">
      <JobWorkspace
        employees={data.employees}
        initialJobs={data.jobs}
        rosterShifts={data.rosterShifts}
        timezone={data.timezone}
      />
      <OwnerJobDetail
        detail={detail}
        employees={data.employees}
        timezone={data.timezone}
      />
    </div>
  )
}
