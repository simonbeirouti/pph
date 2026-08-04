"use client"

import {
  CalendarClockIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  MapPinIcon,
  SendIcon,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { submitJobAction } from "@/app/dashboard/jobs/actions"
import { OpenJobLink } from "@/components/jobs/job-detail-controller"
import {
  updateJobEverywhere,
  useOfflineV2Actions,
} from "@/components/offline/offline-v2-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatShortZonedDateTime } from "@/lib/date-format"
import type { JobCard } from "@/lib/jobs/types"
import { cn } from "@/lib/utils"

const PRIORITY_LABELS = {
  high: "High",
  low: "Low",
  normal: "Normal",
  urgent: "Urgent",
} as const

export function EmployeeJobsList({
  jobs,
  timezone,
}: {
  jobs: readonly JobCard[]
  timezone: string
}) {
  const searchParams = useSearchParams()
  const mode = searchParams.get("mode")
  const activeJobs = jobs.filter(
    (job) => job.status === "assigned" || job.status === "in_progress"
  )
  const submittedJobs = jobs.filter((job) => job.status === "in_review")
  const jobHref = (jobId: number) =>
    mode === "my-work"
      ? `/dashboard/jobs?mode=my-work&job=${jobId}`
      : `/dashboard/jobs?job=${jobId}`

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">
          Your assigned work, ranked from highest to lowest urgency.
        </p>
      </div>

      <Tabs className="w-full" defaultValue="active">
        <TabsList
          aria-label="Filter jobs"
          className="grid w-full grid-cols-2 md:inline-flex md:w-fit"
        >
          <TabsTrigger className="w-full md:w-auto md:flex-none" value="active">
            Open &amp; in progress ({activeJobs.length})
          </TabsTrigger>
          <TabsTrigger
            className="w-full md:w-auto md:flex-none"
            value="submitted"
          >
            Submitted ({submittedJobs.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <EmployeeJobsPanel
            emptyDescription="New work will appear here when your owner assigns it to you."
            emptyTitle="No open jobs"
            jobHref={jobHref}
            jobs={activeJobs}
            showNextUp
            timezone={timezone}
          />
        </TabsContent>
        <TabsContent value="submitted">
          <EmployeeJobsPanel
            emptyDescription="Jobs you submit for review will appear here."
            emptyTitle="No submitted jobs"
            jobHref={jobHref}
            jobs={submittedJobs}
            timezone={timezone}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmployeeJobsPanel({
  emptyDescription,
  emptyTitle,
  jobHref,
  jobs,
  showNextUp = false,
  timezone,
}: {
  emptyDescription: string
  emptyTitle: string
  jobHref: (jobId: number) => string
  jobs: readonly JobCard[]
  showNextUp?: boolean
  timezone: string
}) {
  return jobs.length ? (
    <section aria-label="Assigned jobs" className="grid gap-3">
      {jobs.map((job, index) => (
        <Card
          aria-label={`Job ${job.title}`}
          className={cn(index === 0 && "ring-primary/30")}
          data-priority={job.priority}
          key={job.id}
          role="article"
        >
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle>{job.title}</CardTitle>
                {job.description ? (
                  <CardDescription>{job.description}</CardDescription>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {showNextUp && index === 0 ? (
                  <Badge variant="secondary">Next up</Badge>
                ) : null}
                <PriorityBadge priority={job.priority} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Badge className="capitalize" variant="outline">
                {job.status.replace("_", " ")}
              </Badge>
              {job.dueAt ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarClockIcon className="size-4" aria-hidden="true" />
                  Due {formatDateTime(job.dueAt, timezone)}
                </span>
              ) : null}
              {job.location ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPinIcon className="size-4" aria-hidden="true" />
                  {job.location}
                </span>
              ) : null}
            </div>
            {job.status === "in_review" ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2Icon className="size-4" aria-hidden="true" />
                Submitted and waiting for owner review.
              </p>
            ) : null}
            <JobCardActions href={jobHref(job.id)} job={job} />
          </CardContent>
        </Card>
      ))}
    </section>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle>{emptyTitle}</CardTitle>
        <CardDescription>{emptyDescription}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function JobCardActions({ href, job }: { href: string; job: JobCard }) {
  const router = useRouter()
  const offline = useOfflineV2Actions()
  const [pending, startTransition] = useTransition()
  const hasCounts =
    typeof job.completionNoteCount === "number" &&
    typeof job.completionPhotoCount === "number"
  const requirementsMet =
    hasCounts &&
    (!job.requiresCompletionNote || job.completionNoteCount! > 0) &&
    job.completionPhotoCount! >= job.minimumCompletionPhotos
  const canSubmit =
    requirementsMet &&
    (job.status === "assigned" || job.status === "in_progress")

  return (
    <div className={cn("grid gap-2", canSubmit && "grid-cols-2")}>
      <Button
        nativeButton={false}
        render={<OpenJobLink href={href} job={job} />}
      >
        Open job
      </Button>
      {canSubmit ? (
        <Button
          aria-label="Submit for review"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const queued = await offline.queue({
                entityId: job.id,
                entityType: "job",
                expectedVersion: job.version ?? null,
                kind: "job.submit",
                optimistic: (snapshot) =>
                  updateJobEverywhere(snapshot, job.id, (current) => ({
                    ...current,
                    status: "in_review",
                    submittedAt: new Date().toISOString(),
                  })),
              })
              const result = queued
                ? { message: "Submission saved.", ok: true }
                : await submitJobAction(job.id)
              if (result.ok) {
                toast.success(result.message)
                if (!queued) router.refresh()
              } else {
                toast.error(result.message)
              }
            })
          }}
          type="button"
          variant="outline"
        >
          {pending ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <SendIcon />
          )}
          Submit
        </Button>
      ) : null}
    </div>
  )
}

function PriorityBadge({ priority }: { priority: JobCard["priority"] }) {
  return (
    <Badge
      className={cn(
        priority === "high" &&
          "border-amber-300 text-amber-700 dark:text-amber-300",
        (priority === "normal" || priority === "low") && "text-muted-foreground"
      )}
      variant={priority === "urgent" ? "destructive" : "outline"}
    >
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}

function formatDateTime(value: string, timezone: string) {
  return formatShortZonedDateTime(value, timezone)
}
