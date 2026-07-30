"use client"

import Link from "next/link"

import { EmployeeJobsList } from "@/components/employee-jobs-list"
import { EmployeeJobDetail, OwnerJobDetail } from "@/components/job-detail"
import { JobWorkspace } from "@/components/job-workspace"
import { Button } from "@/components/ui/button"
import type {
  JobBoardEmployee,
  JobArchivePagination,
  JobCard,
  JobDetail,
  JobRosterShiftOption,
} from "@/lib/jobs/types"
import type { JobTemplate } from "@/lib/templates/types"

export function JobsScreen({
  archivePagination,
  detail,
  employees,
  filterActive,
  jobs,
  mode,
  role,
  rosterShifts,
  templates,
  timezone,
  view,
}: {
  archivePagination?: JobArchivePagination
  detail: JobDetail | null
  employees: readonly JobBoardEmployee[]
  filterActive: boolean
  jobs: readonly JobCard[]
  mode: "my-work" | "team"
  role: "employee" | "manager" | "owner"
  rosterShifts: readonly JobRosterShiftOption[]
  templates: readonly JobTemplate[]
  timezone: string
  view: "archived" | "workflow"
}) {
  if (role === "employee" || mode === "my-work") {
    return (
      <div className="grid gap-4">
        {role === "manager" ? (
          <div className="flex gap-2">
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/jobs" prefetch={false} />}
              variant="outline"
            >
              Team workflow
            </Button>
            <Button
              nativeButton={false}
              render={
                <Link href="/dashboard/jobs?mode=my-work" prefetch={false} />
              }
            >
              My work
            </Button>
          </div>
        ) : null}
        <EmployeeJobsList jobs={jobs} timezone={timezone} />
        <EmployeeJobDetail detail={detail} timezone={timezone} />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-0 w-full flex-col overflow-hidden md:h-[calc(100dvh-8rem)]">
      {role === "manager" ? (
        <div className="mb-3 flex shrink-0 gap-2">
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/jobs" prefetch={false} />}
          >
            Team workflow
          </Button>
          <Button
            nativeButton={false}
            render={
              <Link href="/dashboard/jobs?mode=my-work" prefetch={false} />
            }
            variant="outline"
          >
            My work
          </Button>
        </div>
      ) : null}
      <JobWorkspace
        archivePagination={archivePagination}
        employees={employees}
        filterActive={filterActive}
        initialJobs={[...jobs]}
        initialView={view}
        rosterShifts={rosterShifts}
        templates={templates}
        timezone={timezone}
      />
      <OwnerJobDetail
        canReview={
          role === "owner" || detail?.requiredReviewerRole === "manager"
        }
        detail={detail}
        employees={employees}
        timezone={timezone}
      />
    </div>
  )
}
