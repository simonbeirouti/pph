"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { useOptionalRealtimeInvalidations } from "@/components/dashboard/dashboard-realtime-provider"
import { EmployeeJobsList } from "@/components/jobs/employee-jobs-list"
import { JobDetailController } from "@/components/jobs/job-detail-controller"
import { JobWorkspace } from "@/components/jobs/job-workspace"
import { useOptionalOfflineV2 } from "@/components/offline/offline-v2-provider"
import { Button } from "@/components/ui/button"
import type {
  JobBoardEmployee,
  JobArchivePagination,
  JobCard,
  JobDetail,
  JobRosterShiftOption,
} from "@/lib/jobs/types"
import type { JobTemplate } from "@/lib/templates/types"

const JOB_REALTIME_DOMAINS = [
  "job",
  "job_update",
  "evidence",
  "review",
] as const
const LIVE_JOB_BATCH_MS = 50

export function JobsScreen({
  archivePagination,
  detail,
  employees,
  filterActive,
  initialEmployeeFilter,
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
  initialEmployeeFilter?: number | null
  jobs: readonly JobCard[]
  mode: "my-work" | "team"
  role: "employee" | "manager" | "owner"
  rosterShifts: readonly JobRosterShiftOption[]
  templates: readonly JobTemplate[]
  timezone: string
  view: "archived" | "workflow"
}) {
  const searchParams = useSearchParams()
  const offline = useOptionalOfflineV2()
  const [liveJobs, setLiveJobs] = useState(() => [...jobs])
  const fastPathIdsRef = useRef(new Set<number>())
  const pendingIdsRef = useRef(new Set<number>())
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLiveJobs((current) => {
      const currentById = new Map(current.map((job) => [job.id, job]))
      const next = jobs.map((job) => {
        const existing = currentById.get(job.id)
        if (!existing || !isNewerJob(existing, job)) {
          fastPathIdsRef.current.delete(job.id)
          return job
        }
        return existing
      })
      for (const currentJob of current) {
        if (
          fastPathIdsRef.current.has(currentJob.id) &&
          !next.some((job) => job.id === currentJob.id)
        ) {
          next.push(currentJob)
        }
      }
      return next
    })
  }, [jobs])

  useEffect(
    () => () => {
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
    },
    []
  )

  async function refreshLiveJobs() {
    batchTimerRef.current = null
    const ids = [...pendingIdsRef.current].slice(0, 50)
    for (const id of ids) pendingIdsRef.current.delete(id)
    if (!ids.length || !navigator.onLine) return

    try {
      const query = new URLSearchParams({
        ids: ids.join(","),
        scope: mode,
      })
      const response = await fetch(`/api/jobs/live?${query}`, {
        cache: "no-store",
        credentials: "same-origin",
      })
      if (!response.ok) return
      const payload = (await response.json()) as {
        jobs: JobCard[]
        removedIds: number[]
      }
      const protectedIds = new Set(
        offline?.operations.flatMap((operation) =>
          operation.entityType === "job" && operation.entity.source === "server"
            ? [operation.entity.id]
            : []
        ) ?? []
      )
      const removedIds = new Set(payload.removedIds)
      setLiveJobs((current) => {
        const next = new Map(current.map((job) => [job.id, job]))
        for (const jobId of removedIds) {
          if (!protectedIds.has(jobId)) {
            next.delete(jobId)
            fastPathIdsRef.current.delete(jobId)
          }
        }
        for (const job of payload.jobs) {
          if (protectedIds.has(job.id)) continue
          if (!matchesCurrentFilter(job, searchParams)) {
            next.delete(job.id)
            fastPathIdsRef.current.delete(job.id)
            continue
          }
          const existing = next.get(job.id)
          if (!existing || isNewerJob(job, existing)) {
            next.set(job.id, job)
            fastPathIdsRef.current.add(job.id)
          }
        }
        return [...next.values()]
      })
    } catch {
      // The revision-based repository refresh remains the fallback.
    } finally {
      if (pendingIdsRef.current.size && !batchTimerRef.current) {
        batchTimerRef.current = setTimeout(
          () => void refreshLiveJobs(),
          LIVE_JOB_BATCH_MS
        )
      }
    }
  }

  function onRealtimeInvalidation(event: { entityId: number }) {
    pendingIdsRef.current.add(event.entityId)
    if (batchTimerRef.current) return
    batchTimerRef.current = setTimeout(
      () => void refreshLiveJobs(),
      LIVE_JOB_BATCH_MS
    )
  }
  useOptionalRealtimeInvalidations(JOB_REALTIME_DOMAINS, onRealtimeInvalidation)

  if (role === "employee" || mode === "my-work") {
    return (
      <JobDetailController
        employees={[]}
        initialDetail={detail}
        isOwner={false}
        jobs={liveJobs}
        role="employee"
        timezone={timezone}
      >
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
          <EmployeeJobsList jobs={liveJobs} timezone={timezone} />
        </div>
      </JobDetailController>
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
      <JobDetailController
        employees={employees}
        initialDetail={detail}
        isOwner={role === "owner"}
        jobs={liveJobs}
        role="owner"
        timezone={timezone}
      >
        <JobWorkspace
          archivePagination={archivePagination}
          employees={employees}
          filterActive={filterActive}
          initialEmployeeFilter={initialEmployeeFilter}
          initialJobs={liveJobs}
          initialView={view}
          key={`jobs-${initialEmployeeFilter ?? "all"}`}
          rosterShifts={rosterShifts}
          templates={templates}
          timezone={timezone}
        />
      </JobDetailController>
    </div>
  )
}

function isNewerJob(candidate: JobCard, current: JobCard) {
  if (candidate.version !== undefined && current.version !== undefined) {
    return candidate.version > current.version
  }
  return candidate.updatedAt > current.updatedAt
}

function matchesCurrentFilter(
  job: JobCard,
  searchParams: { get(name: string): string | null }
) {
  const employee = searchParams.get("employee")
  if (employee && String(job.assigneeMembershipId) !== employee) return false
  const status = searchParams.get("status")
  if (
    status === "outstanding" &&
    job.status !== "assigned" &&
    job.status !== "in_progress"
  ) {
    return false
  }
  if (status === "in_review" && job.status !== "in_review") return false
  return searchParams.get("priority") !== "urgent" || job.priority === "urgent"
}
