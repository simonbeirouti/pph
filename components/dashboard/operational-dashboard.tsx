"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  CheckCircle2Icon,
  Clock3Icon,
  PlayIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { startJobAction } from "@/app/dashboard/jobs/actions"
import { EmployeeShiftSummary } from "@/components/roster/employee-shift-summary"
import {
  updateJobEverywhere,
  useOfflineV2Actions,
} from "@/components/offline/offline-v2-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type {
  EmployeeDashboardData,
  OwnerDashboardData,
} from "@/lib/dashboard/data"
import { formatShortZonedDateTime, formatZonedTime } from "@/lib/date-format"
import type { JobCard } from "@/lib/jobs/types"

export function OwnerOperationalDashboard({
  data,
  name,
  timezone,
}: {
  data: OwnerDashboardData
  name: string
  timezone: string
}) {
  const stats = [
    {
      href: "/dashboard/roster",
      icon: UsersIcon,
      label: "Working now",
      value: data.workingNow,
    },
    {
      href: "/dashboard/jobs?status=outstanding",
      icon: BriefcaseBusinessIcon,
      label: "Outstanding",
      value: data.outstanding,
    },
    {
      href: "/dashboard/jobs?status=in_review",
      icon: CheckCircle2Icon,
      label: "Awaiting review",
      value: data.awaitingReview,
    },
    {
      href: "/dashboard/jobs?priority=urgent",
      icon: AlertTriangleIcon,
      label: "Urgent",
      value: data.urgentCount,
    },
  ]
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Good day, {name}
        </h1>
        <p className="text-muted-foreground">
          Here’s what needs attention across your team.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link href={stat.href} key={stat.label} prefetch={false}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-semibold">{stat.value}</p>
                </div>
                <stat.icon className="size-10 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardJobs
          title="Urgent jobs"
          description="Due soonest, then most recently updated."
          empty="No urgent jobs. Your priority queue is clear."
          jobs={data.urgent}
          timezone={timezone}
        />
        <DashboardJobs
          title="Recently submitted"
          description="The latest work waiting in or beyond review."
          empty="No jobs have been submitted yet."
          jobs={data.recentlySubmitted}
          timezone={timezone}
          submitted
        />
        <section className="xl:col-span-2">
          <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center">
            <div>
              <h2 className="text-lg font-semibold">Today’s roster</h2>
              <p className="text-sm text-muted-foreground">
                Every shift intersecting today in {timezone}.
              </p>
            </div>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/roster" prefetch={false} />}
              size="sm"
              variant="outline"
            >
              Open roster
            </Button>
          </div>
          {data.todayRoster.length ? (
            <div
              className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-3"
              data-roster-grid
            >
              {data.todayRoster.map((shift) => (
                <Link
                  className="flex h-full flex-col gap-3 rounded-lg border p-4 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  href={`/dashboard/employees?employee=${shift.employeeMembershipId}`}
                  key={shift.id}
                  prefetch={false}
                >
                  <div>
                    <p className="font-medium">{shift.employeeName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatRange(shift.startsAt, shift.endsAt, timezone)}
                    </p>
                  </div>
                  {shift.workingNow ? (
                    <Badge>Working now</Badge>
                  ) : (
                    <Badge variant="outline">Scheduled</Badge>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No one is rostered today.{" "}
              <Link
                className="underline"
                href="/dashboard/roster"
                prefetch={false}
              >
                Add a shift
              </Link>
              .
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

export function EmployeeOperationalDashboard({
  data,
  name,
  timezone,
}: {
  data: EmployeeDashboardData
  name: string
  timezone: string
}) {
  const actionableJobs = data.jobs.filter(
    (job) => job.status === "assigned" || job.status === "in_progress"
  )

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Hi, {name}</h1>
        <p className="text-muted-foreground">
          Your shift and work queue, in priority order.
        </p>
      </div>
      <section>
        <h2 className="text-lg font-semibold">Your roster</h2>
        <div className="mt-3">
          <EmployeeShiftSummary
            maximumUpcoming={1}
            summary={data.shifts}
            timezone={timezone}
          />
        </div>
      </section>
      <section>
        <div>
          <h2 className="text-lg font-semibold">Assigned work</h2>
          <p className="text-sm text-muted-foreground">
            Urgent and due work appears first.
          </p>
        </div>
        <div className="mt-3">
          {actionableJobs.length ? (
            <div className="grid gap-3">
              {actionableJobs.map((job) => (
                <EmployeeQueueRow
                  featured={job.id === data.nextActionable?.id}
                  job={job}
                  key={job.id}
                  timezone={timezone}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You have no assigned work right now.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function EmployeeQueueRow({
  featured,
  job,
  timezone,
}: {
  featured: boolean
  job: JobCard
  timezone: string
}) {
  const router = useRouter()
  const offline = useOfflineV2Actions()
  const [pending, startTransition] = useTransition()
  const start = () =>
    startTransition(async () => {
      if (
        await offline.queue({
          entityId: job.id,
          entityType: "job",
          expectedVersion: job.version ?? null,
          kind: "job.start",
          optimistic: (snapshot) =>
            updateJobEverywhere(snapshot, job.id, (current) => ({
              ...current,
              startedAt:
                typeof current.startedAt === "string"
                  ? current.startedAt
                  : new Date().toISOString(),
              status: "in_progress",
            })),
        })
      ) {
        toast.success("Job started on this device")
        offline.navigate?.(`/dashboard/jobs?job=${job.id}`)
        return
      }
      const result = await startJobAction(job.id)
      if (result.ok) {
        toast.success("Job started")
        router.push(`/dashboard/jobs?job=${job.id}`)
        router.refresh()
      } else toast.error(result.message)
    })
  return (
    <div
      className={
        featured
          ? "rounded-lg border border-primary/50 bg-primary/5 p-4"
          : "rounded-lg border p-4"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{job.title}</p>
            <Badge
              variant={job.priority === "urgent" ? "destructive" : "outline"}
              className="capitalize"
            >
              {job.priority}
            </Badge>
            {featured ? (
              <Badge variant="secondary">Next actionable</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.dueAt
              ? `Due ${formatDate(job.dueAt, timezone)}`
              : "No due time"}{" "}
            · {job.status.replace("_", " ")}
          </p>
        </div>
        {job.status === "assigned" ? (
          <Button disabled={pending} onClick={start}>
            <PlayIcon /> {pending ? "Starting…" : "Start"}
          </Button>
        ) : job.status === "in_progress" ? (
          <Button
            nativeButton={false}
            render={
              <Link href={`/dashboard/jobs?job=${job.id}`} prefetch={false} />
            }
          >
            <ArrowRightIcon /> Resume
          </Button>
        ) : (
          <Button
            nativeButton={false}
            render={
              <Link href={`/dashboard/jobs?job=${job.id}`} prefetch={false} />
            }
            variant="outline"
          >
            <Clock3Icon /> View submission
          </Button>
        )}
      </div>
    </div>
  )
}

function DashboardJobs({
  description,
  empty,
  jobs,
  submitted,
  timezone,
  title,
}: {
  description: string
  empty: string
  jobs: readonly (JobCard & { submittedAt?: string })[]
  submitted?: boolean
  timezone: string
  title: string
}) {
  return (
    <section className="flex h-[28rem] min-h-0 flex-col">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {jobs.length ? (
          <div className="grid gap-2">
            {jobs.map((job) => (
              <Link
                className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
                href={`/dashboard/jobs?job=${job.id}`}
                key={job.id}
                prefetch={false}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{job.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {submitted && job.submittedAt
                      ? `Submitted ${formatDate(job.submittedAt, timezone)}`
                      : job.dueAt
                        ? `Due ${formatDate(job.dueAt, timezone)}`
                        : "No due time"}
                  </p>
                </div>
                <Badge
                  variant={
                    job.priority === "urgent" ? "destructive" : "outline"
                  }
                  className="shrink-0 capitalize"
                >
                  {submitted ? job.status.replace("_", " ") : job.priority}
                </Badge>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </section>
  )
}

function formatDate(value: string, timezone: string) {
  return formatShortZonedDateTime(value, timezone)
}
function formatRange(start: string, end: string, timezone: string) {
  return `${formatDate(start, timezone)}–${formatZonedTime(end, timezone)}`
}
