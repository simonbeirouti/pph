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
import { EmployeeShiftSummary } from "@/components/employee-shift-summary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  EmployeeDashboardData,
  OwnerDashboardData,
} from "@/lib/dashboard/data"
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
          <Link href={stat.href} key={stat.label}>
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
        <Card className="xl:col-span-2">
          <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center">
            <div>
              <CardTitle>Today’s roster</CardTitle>
              <CardDescription>
                Every shift intersecting today in {timezone}.
              </CardDescription>
            </div>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/roster" />}
              size="sm"
              variant="outline"
            >
              Open roster
            </Button>
          </CardHeader>
          <CardContent>
            {data.todayRoster.length ? (
              <div className="grid gap-2">
                {data.todayRoster.map((shift) => (
                  <Link
                    className="flex flex-col gap-2 rounded-lg border p-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                    href={`/dashboard/employees/${shift.employeeMembershipId}`}
                    key={shift.id}
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
                <Link className="underline" href="/dashboard/roster">
                  Add a shift
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>
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
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Hi, {name}</h1>
        <p className="text-muted-foreground">
          Your shift and work queue, in priority order.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your roster</CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeShiftSummary summary={data.shifts} timezone={timezone} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Assigned work</CardTitle>
          <CardDescription>Urgent and due work appears first.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.jobs.length ? (
            <div className="grid gap-3">
              {data.jobs.map((job) => (
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
        </CardContent>
      </Card>
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
  const [pending, startTransition] = useTransition()
  const start = () =>
    startTransition(async () => {
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
            render={<Link href={`/dashboard/jobs?job=${job.id}`} />}
          >
            <ArrowRightIcon /> Resume
          </Button>
        ) : (
          <Button
            nativeButton={false}
            render={<Link href={`/dashboard/jobs?job=${job.id}`} />}
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
    <Card className="flex h-[28rem] min-h-0 flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        {jobs.length ? (
          <div className="grid gap-2">
            {jobs.map((job) => (
              <Link
                className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
                href={`/dashboard/jobs?job=${job.id}`}
                key={job.id}
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
      </CardContent>
    </Card>
  )
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value))
}
function formatRange(start: string, end: string, timezone: string) {
  return `${formatDate(start, timezone)}–${new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(end))}`
}
