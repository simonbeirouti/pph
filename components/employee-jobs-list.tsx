import { CalendarClockIcon, CheckCircle2Icon, MapPinIcon } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">
          Your assigned work, ranked from highest to lowest urgency.
        </p>
      </div>

      {jobs.length ? (
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
                    {index === 0 ? (
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
                      <CalendarClockIcon
                        className="size-4"
                        aria-hidden="true"
                      />
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
                <Button
                  nativeButton={false}
                  render={<Link href={`/dashboard/jobs?job=${job.id}`} />}
                >
                  Open job
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No jobs assigned</CardTitle>
            <CardDescription>
              New work will appear here when your owner assigns it to you.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
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
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: timezone,
  }).format(new Date(value))
}
