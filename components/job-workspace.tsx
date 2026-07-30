"use client"

import { move } from "@dnd-kit/helpers"
import { DragDropProvider, useDroppable } from "@dnd-kit/react"
import { useSortable } from "@dnd-kit/react/sortable"
import {
  ArchiveIcon,
  BriefcaseBusinessIcon,
  CameraIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckBigIcon,
  ClockIcon,
  FileTextIcon,
  MapPinIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { reassignJobAction } from "@/app/dashboard/jobs/actions"
import { EmployeeAvatar } from "@/components/employee-avatar"
import {
  updateJobEverywhere,
  useOfflineV2Actions,
} from "@/components/offline-v2-actions"
import { JobCreateDialog, JobEditDialog } from "@/components/job-create-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatShortZonedDateTime } from "@/lib/date-format"
import {
  columnsForJobView,
  jobMatchesView,
  jobWorkflowColumn,
  sortJobsByUrgency,
} from "@/lib/jobs/board"
import type {
  JobBoardColumn,
  JobBoardEmployee,
  JobArchivePagination,
  JobCard,
  JobPriority,
  JobRosterShiftOption,
  JobView,
  JobWorkflowColumnKey,
} from "@/lib/jobs/types"
import type { JobTemplateOption } from "@/lib/templates/types"
import { cn } from "@/lib/utils"

type BoardItems = Record<JobWorkflowColumnKey, JobCard[]>

const VIEW_LABELS: Record<JobView, string> = {
  archived: "Archived",
  workflow: "Workflow",
}

const PRIORITY_LABELS = {
  high: "High",
  low: "Low",
  normal: "Normal",
  urgent: "Urgent",
} as const

type PriorityFilter = JobPriority | "all"
type EmployeeFilter = `${number}` | "all" | "unassigned"

function buildBoard(jobs: readonly JobCard[], view: JobView): BoardItems {
  const board: BoardItems = {
    archived: [],
    assigned: [],
    review: [],
    unassigned: [],
  }

  for (const job of jobs) {
    if (!jobMatchesView(job, view)) continue
    board[jobWorkflowColumn(job)].push(job)
  }

  for (const key of Object.keys(board) as JobWorkflowColumnKey[]) {
    board[key] = sortJobsByUrgency(board[key])
  }

  return board
}

export function JobWorkspace({
  archivePagination,
  employees,
  filterActive = false,
  initialJobs,
  initialView = "workflow",
  rosterShifts = [],
  templates = [],
  timezone,
}: {
  archivePagination?: JobArchivePagination
  employees: readonly JobBoardEmployee[]
  filterActive?: boolean
  initialJobs: readonly JobCard[]
  initialView?: JobView
  rosterShifts?: readonly JobRosterShiftOption[]
  templates?: readonly JobTemplateOption[]
  timezone: string
}) {
  const offline = useOfflineV2Actions()
  const [view, setView] = useState<JobView>(initialView)
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all")
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>("all")
  const [jobs, setJobs] = useState(() => [...initialJobs])
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set())
  const [assignmentJob, setAssignmentJob] = useState<JobCard | null>(null)
  const pendingIdsRef = useRef(new Set<number>())
  const deferredJobsRef = useRef<readonly JobCard[] | null>(null)
  const columns = columnsForJobView(view)
  const visibleJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          (priorityFilter === "all" || job.priority === priorityFilter) &&
          (employeeFilter === "all" ||
            (employeeFilter === "unassigned"
              ? job.assigneeMembershipId === null
              : String(job.assigneeMembershipId) === employeeFilter))
      ),
    [employeeFilter, jobs, priorityFilter]
  )
  const canonicalBoard = useMemo(
    () => buildBoard(visibleJobs, view),
    [view, visibleJobs]
  )
  const archivedJobs = useMemo(
    () => visibleJobs.filter((job) => job.status === "archived"),
    [visibleJobs]
  )
  const [dragBoard, setDragBoard] = useState<BoardItems | null>(null)
  const dragBoardRef = useRef<BoardItems | null>(null)
  const viewRef = useRef<JobView>(view)
  const jobsRef = useRef(jobs)
  const board = dragBoard ?? canonicalBoard
  const assignmentTargets = useMemo(
    () => employees.filter((employee) => employee.active),
    [employees]
  )
  const employeeById = useMemo(
    () =>
      new Map(employees.map((employee) => [employee.membershipId, employee])),
    [employees]
  )

  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  useEffect(() => {
    if (pendingIdsRef.current.size) {
      deferredJobsRef.current = initialJobs
      return
    }

    const next = [...initialJobs]
    jobsRef.current = next
    setJobs(next)
  }, [initialJobs])

  useEffect(() => {
    viewRef.current = view
  }, [view])

  async function persistAssignment(
    jobId: number,
    assigneeMembershipId: number | null
  ) {
    if (pendingIdsRef.current.has(jobId)) return
    const snapshot = jobsRef.current
    const current = snapshot.find((job) => job.id === jobId)
    if (!current || current.assigneeMembershipId === assigneeMembershipId) {
      setDragBoard(null)
      return
    }

    const previousView = viewRef.current
    const optimistic = snapshot.map((job) =>
      job.id === jobId
        ? {
            ...job,
            assigneeMembershipId,
            status: "assigned" as const,
            updatedAt: new Date().toISOString(),
          }
        : job
    )
    jobsRef.current = optimistic
    setJobs(optimistic)
    viewRef.current = "workflow"
    setView("workflow")
    setDragBoard(null)
    dragBoardRef.current = null
    pendingIdsRef.current.add(jobId)
    setPendingIds((currentIds) => new Set(currentIds).add(jobId))

    try {
      const queued = await offline.queue({
        entityId: jobId,
        entityType: "job",
        expectedVersion: current.version ?? null,
        kind: "job.reassign",
        payload: { assigneeMembershipId },
        optimistic: (stored) =>
          updateJobEverywhere(stored, jobId, (job) => ({
            ...job,
            assigneeMembershipId,
            status: "assigned",
            updatedAt: new Date().toISOString(),
          })),
      })
      const result = queued
        ? {
            job: optimistic.find((job) => job.id === jobId),
            message: "Assignment saved on this device.",
            ok: true,
          }
        : await reassignJobAction(jobId, assigneeMembershipId)
      if (!result.ok || !result.job) {
        const restored = jobsRef.current.map((job) =>
          job.id === jobId ? current : job
        )
        jobsRef.current = restored
        setJobs(restored)
        viewRef.current = previousView
        setView(previousView)
        toast.error(result.message)
        return
      }

      const authoritative = optimistic.map((job) =>
        job.id === result.job!.id ? result.job! : job
      )
      jobsRef.current = authoritative
      setJobs(authoritative)
      toast.success(result.message)
    } catch {
      const restored = jobsRef.current.map((job) =>
        job.id === jobId ? current : job
      )
      jobsRef.current = restored
      setJobs(restored)
      viewRef.current = previousView
      setView(previousView)
      toast.error("Could not save the assignment. The card was moved back.")
    } finally {
      pendingIdsRef.current.delete(jobId)
      setPendingIds((currentIds) => {
        const next = new Set(currentIds)
        next.delete(jobId)
        return next
      })
      if (!pendingIdsRef.current.size && deferredJobsRef.current) {
        const next = [...deferredJobsRef.current]
        deferredJobsRef.current = null
        jobsRef.current = next
        setJobs(next)
      }
    }
  }

  function addCreatedJob(job: JobCard) {
    const next = [
      job,
      ...jobsRef.current.filter((current) => current.id !== job.id),
    ]
    jobsRef.current = next
    setJobs(next)
    viewRef.current = "workflow"
    setView("workflow")
    toast.success("Job created.")
  }

  function updateSavedJob(job: JobCard) {
    const next = jobsRef.current.map((current) =>
      current.id === job.id ? job : current
    )
    jobsRef.current = next
    setJobs(next)
    viewRef.current = job.status === "archived" ? "archived" : "workflow"
    setView(viewRef.current)
    toast.success("Job updated.")
  }

  return (
    <div className="grid h-full min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-5 overflow-hidden">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">
            Create, assign, and review work in one workflow.
          </p>
          {filterActive ? (
            <p className="mt-1 text-sm text-primary">
              Dashboard filter applied.{" "}
              <Link
                className="underline"
                href="/dashboard/jobs"
                prefetch={false}
              >
                Clear filter
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="order-1 w-full sm:order-2 sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">
              <JobCreateDialog
                employees={assignmentTargets}
                onCreated={addCreatedJob}
                rosterShifts={rosterShifts}
                templates={templates}
                timezone={timezone}
              />
            </div>
            <Tabs
              className="order-2 w-full sm:order-1 sm:w-auto"
              onValueChange={(value) => {
                const nextView = value as JobView
                viewRef.current = nextView
                setView(nextView)
                dragBoardRef.current = null
                setDragBoard(null)
              }}
              value={view}
            >
              <TabsList
                aria-label="Filter jobs"
                className="grid w-full grid-cols-2 sm:inline-flex sm:w-fit"
              >
                {(["workflow", "archived"] as const).map((value) => (
                  <TabsTrigger key={value} value={value}>
                    {VIEW_LABELS[value]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Select
              onValueChange={(value) =>
                setPriorityFilter((value ?? "all") as PriorityFilter)
              }
              value={priorityFilter}
            >
              <SelectTrigger
                aria-label="Filter by urgency"
                className="w-full sm:w-40"
              >
                <SelectValue>
                  {priorityFilter === "all"
                    ? "All urgencies"
                    : PRIORITY_LABELS[priorityFilter]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All urgencies</SelectItem>
                {(
                  Object.entries(PRIORITY_LABELS) as [JobPriority, string][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) =>
                setEmployeeFilter((value ?? "all") as EmployeeFilter)
              }
              value={employeeFilter}
            >
              <SelectTrigger
                aria-label="Filter by employee"
                className="w-full sm:w-48"
              >
                <SelectValue>
                  {employeeFilter === "all"
                    ? "All employees"
                    : employeeFilter === "unassigned"
                      ? "Unassigned"
                      : (employeeById.get(Number(employeeFilter))
                          ?.displayName ?? "Former employee")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {assignmentTargets.map((employee) => (
                  <SelectItem
                    key={employee.membershipId}
                    value={String(employee.membershipId)}
                  >
                    {employee.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {view === "archived" ? (
        <ArchivedJobsGrid
          employeeById={employeeById}
          jobs={archivedJobs}
          pagination={
            archivePagination ?? {
              page: 1,
              pageSize: 15,
              total: archivedJobs.length,
              totalPages: 1,
            }
          }
          timezone={timezone}
        />
      ) : (
        <DragDropProvider
          onDragStart={() => {
            dragBoardRef.current = canonicalBoard
            setDragBoard(canonicalBoard)
          }}
          onDragOver={(event) => {
            const { source } = event.operation
            if (source?.type !== "job") return
            const next = move(
              dragBoardRef.current ?? canonicalBoard,
              event
            ) as BoardItems
            dragBoardRef.current = next
            setDragBoard(next)
          }}
          onDragEnd={(event) => {
            const { source } = event.operation
            if (event.canceled || source?.type !== "job") {
              dragBoardRef.current = null
              setDragBoard(null)
              return
            }

            const jobId = Number(source.id)
            const job = jobsRef.current.find((current) => current.id === jobId)
            const finalBoard = dragBoardRef.current ?? canonicalBoard
            const destination = columns.find((column) =>
              finalBoard[column.key]?.some((item) => item.id === jobId)
            )

            dragBoardRef.current = null
            setDragBoard(null)
            if (!job || !destination?.dropTarget) return

            if (destination.key === "assigned" && !job.assigneeMembershipId) {
              setAssignmentJob(job)
              return
            }
            if (destination.key === "unassigned" && job.assigneeMembershipId) {
              void persistAssignment(job.id, null)
            }
          }}
        >
          <div
            className="h-full min-h-0 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth pb-2 md:snap-none"
            data-board-scroll
          >
            <div
              aria-label="Workflow jobs board"
              className="grid h-full min-h-0 w-full auto-cols-[100%] grid-flow-col gap-3 md:w-max md:auto-cols-[18rem] lg:w-full lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-3"
            >
              {columns.map((column) => (
                <JobColumn
                  assignmentTargets={assignmentTargets}
                  column={column}
                  employeeById={employeeById}
                  items={board[column.key]}
                  key={column.key}
                  onAssign={persistAssignment}
                  onUpdated={updateSavedJob}
                  pendingIds={pendingIds}
                  rosterShifts={rosterShifts}
                  timezone={timezone}
                />
              ))}
            </div>
          </div>
        </DragDropProvider>
      )}

      <AssignmentDialog
        employees={assignmentTargets}
        job={assignmentJob}
        key={assignmentJob?.id ?? "closed"}
        onAssign={(employeeMembershipId) => {
          const job = assignmentJob
          setAssignmentJob(null)
          if (job) void persistAssignment(job.id, employeeMembershipId)
        }}
        onOpenChange={(open) => {
          if (!open) setAssignmentJob(null)
        }}
      />
    </div>
  )
}

function ArchivedJobsGrid({
  employeeById,
  jobs,
  pagination,
  timezone,
}: {
  employeeById: ReadonlyMap<number, JobBoardEmployee>
  jobs: readonly JobCard[]
  pagination: JobArchivePagination
  timezone: string
}) {
  const firstItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const lastItem = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total
  )

  return (
    <section
      aria-label="Archived jobs"
      className="min-h-0 overflow-y-auto pb-1"
    >
      {jobs.length ? (
        <div
          className="grid content-start gap-4 md:grid-cols-2 xl:grid-cols-3"
          data-archive-grid
        >
          {jobs.map((job) => {
            const assignee = job.assigneeMembershipId
              ? (employeeById.get(job.assigneeMembershipId) ?? null)
              : null

            return (
              <Card aria-label={`Archived job ${job.title}`} key={job.id}>
                <CardHeader>
                  <CardTitle className="line-clamp-2">{job.title}</CardTitle>
                  <CardAction>
                    <Badge variant="secondary">Completed</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="grid flex-1 gap-3">
                  {job.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {job.description}
                    </p>
                  ) : null}
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      Completed by
                    </p>
                    <AssigneeIdentity
                      assignee={assignee}
                      assigned={Boolean(job.assigneeMembershipId)}
                      inline
                    />
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ClockIcon className="size-3.5 shrink-0" />
                    {formatDateTime(job.archivedAt ?? job.updatedAt, timezone)}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/dashboard/jobs?view=archived&page=${pagination.page}&job=${job.id}`}
                        prefetch={false}
                      />
                    }
                    size="sm"
                    variant="outline"
                  >
                    View job
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArchiveIcon />
            </EmptyMedia>
            <EmptyTitle>No completed jobs yet</EmptyTitle>
            <EmptyDescription>
              Approved jobs will appear here as a searchable history.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {pagination.totalPages > 1 ? (
        <nav
          aria-label="Archived jobs pagination"
          className="mt-4 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-xs text-muted-foreground tabular-nums">
            Showing {firstItem}–{lastItem} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            {pagination.page > 1 ? (
              <Button
                nativeButton={false}
                render={
                  <Link
                    aria-label="Previous archived jobs page"
                    href={`/dashboard/jobs?view=archived&page=${pagination.page - 1}`}
                    prefetch={false}
                  />
                }
                size="sm"
                variant="outline"
              >
                <ChevronLeftIcon />
                Previous
              </Button>
            ) : (
              <Button disabled size="sm" variant="outline">
                <ChevronLeftIcon />
                Previous
              </Button>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            {pagination.page < pagination.totalPages ? (
              <Button
                nativeButton={false}
                render={
                  <Link
                    aria-label="Next archived jobs page"
                    href={`/dashboard/jobs?view=archived&page=${pagination.page + 1}`}
                    prefetch={false}
                  />
                }
                size="sm"
                variant="outline"
              >
                Next
                <ChevronRightIcon />
              </Button>
            ) : (
              <Button disabled size="sm" variant="outline">
                Next
                <ChevronRightIcon />
              </Button>
            )}
          </div>
        </nav>
      ) : null}
    </section>
  )
}

function JobColumn({
  assignmentTargets,
  column,
  employeeById,
  items,
  onAssign,
  onUpdated,
  pendingIds,
  rosterShifts,
  timezone,
}: {
  assignmentTargets: readonly JobBoardEmployee[]
  column: JobBoardColumn
  employeeById: ReadonlyMap<number, JobBoardEmployee>
  items: readonly JobCard[]
  onAssign: (
    jobId: number,
    assigneeMembershipId: number | null
  ) => Promise<void>
  onUpdated: (job: JobCard) => void
  pendingIds: ReadonlySet<number>
  rosterShifts: readonly JobRosterShiftOption[]
  timezone: string
}) {
  const { isDropTarget, ref } = useDroppable({
    accept: column.dropTarget ? "job" : "read-only-job",
    id: column.key,
    type: "column",
  })

  return (
    <section
      aria-label={`${column.label} jobs`}
      className={cn(
        "flex h-full min-h-0 snap-start snap-always flex-col rounded-lg border bg-muted/30 md:snap-none",
        isDropTarget && column.dropTarget && "border-primary bg-primary/5"
      )}
      data-column={column.key}
      data-drop-target={isDropTarget ? "true" : undefined}
      ref={ref}
    >
      <header className="flex min-h-14 items-center gap-2 border-b px-3 py-2">
        <ColumnIcon column={column.key} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{column.label}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {column.description}
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {items.length}
        </span>
      </header>
      <div
        className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto overscroll-y-contain p-2"
        data-card-list
      >
        {items.length ? (
          items.map((job, index) => (
            <JobCardView
              assignee={
                job.assigneeMembershipId
                  ? (employeeById.get(job.assigneeMembershipId) ?? null)
                  : null
              }
              assignmentTargets={assignmentTargets}
              index={index}
              job={job}
              key={`${column.key}-${job.id}`}
              onAssign={onAssign}
              onUpdated={onUpdated}
              pending={pendingIds.has(job.id)}
              rosterShifts={rosterShifts}
              timezone={timezone}
            />
          ))
        ) : (
          <div className="rounded-md border border-dashed bg-background/60 p-3 text-sm text-muted-foreground">
            {column.dropTarget ? "Drop work here." : "No jobs here."}
          </div>
        )}
      </div>
    </section>
  )
}

function ColumnIcon({ column }: { column: JobWorkflowColumnKey }) {
  const iconClass = "size-4"
  const icon =
    column === "unassigned" ? (
      <UserRoundXIcon className={iconClass} />
    ) : column === "assigned" ? (
      <UserRoundCheckIcon className={iconClass} />
    ) : column === "review" ? (
      <CircleCheckBigIcon className={iconClass} />
    ) : (
      <ArchiveIcon className={iconClass} />
    )

  return (
    <div className="grid size-8 place-items-center rounded-full bg-background">
      {icon}
    </div>
  )
}

function JobCardView({
  assignee,
  assignmentTargets,
  index,
  job,
  onAssign,
  onUpdated,
  pending,
  rosterShifts,
  timezone,
}: {
  assignee: JobBoardEmployee | null
  assignmentTargets: readonly JobBoardEmployee[]
  index: number
  job: JobCard
  onAssign: (
    jobId: number,
    assigneeMembershipId: number | null
  ) => Promise<void>
  onUpdated: (job: JobCard) => void
  pending: boolean
  rosterShifts: readonly JobRosterShiftOption[]
  timezone: string
}) {
  const { handleRef, isDragging, ref } = useSortable({
    accept:
      job.status === "assigned" || job.status === "in_progress"
        ? "job"
        : "read-only-job",
    group: "workflow-jobs",
    id: job.id,
    index,
    transition: null,
    type:
      job.status === "assigned" || job.status === "in_progress"
        ? "job"
        : "read-only-job",
  })
  const editable = job.status === "assigned" || job.status === "in_progress"

  return (
    <article
      aria-label={`Job ${job.title}`}
      className={cn(
        "relative rounded-md border bg-background p-3 shadow-xs transition-[box-shadow,opacity] will-change-transform",
        isDragging &&
          "z-20 rotate-[0.5deg] opacity-95 shadow-xl ring-2 ring-primary/20",
        pending && "pointer-events-none opacity-60"
      )}
      data-dragging={isDragging ? "true" : undefined}
      ref={ref}
    >
      <div
        aria-label={`Drag ${job.title}`}
        className="absolute inset-0 z-0 cursor-grab rounded-md active:cursor-grabbing"
        ref={handleRef}
      />
      <div className="pointer-events-none relative z-[1] rounded-sm pr-8">
        <h4 className="min-w-0 text-sm font-medium">{job.title}</h4>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={job.priority} />
          <Badge variant="outline" className="capitalize">
            {job.status === "assigned"
              ? job.assigneeMembershipId
                ? "Assigned"
                : "Unassigned"
              : job.status.replace("_", " ")}
          </Badge>
        </div>
      </div>
      {editable ? (
        <div
          className="relative z-10 mt-3"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Select
            disabled={pending}
            onValueChange={(value) => {
              void onAssign(
                job.id,
                !value || value === "unassigned" ? null : Number(value)
              )
            }}
            value={
              job.assigneeMembershipId
                ? String(job.assigneeMembershipId)
                : "unassigned"
            }
          >
            <SelectTrigger aria-label="Assign to" className="w-full" size="sm">
              <SelectValue>
                <AssigneeIdentity
                  assignee={assignee}
                  assigned={Boolean(job.assigneeMembershipId)}
                  inline
                />
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <AssigneeIdentity assignee={null} assigned={false} inline />
              </SelectItem>
              {assignmentTargets.map((employee) => (
                <SelectItem
                  key={employee.membershipId}
                  value={String(employee.membershipId)}
                >
                  <AssigneeIdentity assignee={employee} assigned inline />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : assignee || job.assigneeMembershipId ? (
        <div className="pointer-events-none relative z-[1] mt-3 flex items-center gap-2 rounded-md bg-muted/60 p-2">
          <AssigneeIdentity assignee={assignee} assigned />
        </div>
      ) : null}
      {job.description ? (
        <p className="pointer-events-none relative z-[1] mt-2 line-clamp-3 text-xs text-muted-foreground">
          {job.description}
        </p>
      ) : null}
      <div className="pointer-events-none relative z-[1] mt-3 grid gap-1.5 text-xs text-muted-foreground">
        {job.location ? (
          <span className="flex items-center gap-1.5">
            <MapPinIcon className="size-3.5" />
            {job.location}
          </span>
        ) : null}
        {job.scheduledAt ? (
          <span className="flex items-center gap-1.5">
            <BriefcaseBusinessIcon className="size-3.5" />
            Scheduled {formatDateTime(job.scheduledAt, timezone)}
          </span>
        ) : null}
        {job.dueAt ? (
          <span className="flex items-center gap-1.5">
            <ClockIcon className="size-3.5" />
            Due {formatDateTime(job.dueAt, timezone)}
          </span>
        ) : null}
        {job.requiresCompletionNote ? (
          <span className="flex items-center gap-1.5">
            <FileTextIcon className="size-3.5" />
            Completion note required
          </span>
        ) : null}
        {job.minimumCompletionPhotos > 0 ? (
          <span className="flex items-center gap-1.5">
            <CameraIcon className="size-3.5" />
            {job.minimumCompletionPhotos} completion{" "}
            {job.minimumCompletionPhotos === 1 ? "photo" : "photos"}
          </span>
        ) : null}
      </div>
      {editable ? (
        <div onPointerDown={(event) => event.stopPropagation()}>
          <JobEditDialog
            currentAssigneeName={
              assignee?.displayName ??
              (job.assigneeMembershipId ? "Former employee" : undefined)
            }
            employees={assignmentTargets}
            job={job}
            onUpdated={onUpdated}
            rosterShifts={rosterShifts}
            timezone={timezone}
          />
        </div>
      ) : null}
      <div
        className="relative z-10 mt-3 grid"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Button
          nativeButton={false}
          render={
            <Link href={`/dashboard/jobs?job=${job.id}`} prefetch={false} />
          }
          size="sm"
          variant="outline"
        >
          Open job
        </Button>
      </div>
    </article>
  )
}

function AssigneeIdentity({
  assignee,
  assigned,
  inline = false,
}: {
  assignee: JobBoardEmployee | null
  assigned: boolean
  inline?: boolean
}) {
  if (!assigned) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-background">
          <UserRoundXIcon className="size-3.5 text-muted-foreground" />
        </span>
        {inline ? (
          <span className="min-w-0 truncate text-left text-xs">
            <span className="font-medium">Unassign</span>
          </span>
        ) : (
          <span className="min-w-0 text-left">
            <span className="block truncate text-xs font-medium">
              Unassigned
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              Choose an employee
            </span>
          </span>
        )}
      </span>
    )
  }

  const name = assignee?.displayName ?? "Former employee"
  const title = assignee
    ? assignee.active
      ? assignee.jobTitle
      : `${assignee.jobTitle} · Inactive`
    : "No longer in the directory"

  return (
    <span className="flex min-w-0 items-center gap-2">
      <EmployeeAvatar
        className="size-7 shrink-0"
        name={name}
        url={assignee?.avatarUrl ?? null}
      />
      {inline ? (
        <span className="min-w-0 truncate text-left text-xs">
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground"> - {title}</span>
        </span>
      ) : (
        <span className="min-w-0 text-left">
          <span className="block truncate text-xs font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {title}
          </span>
        </span>
      )}
    </span>
  )
}

export function AssignmentDialog({
  employees,
  job,
  onAssign,
  onOpenChange,
}: {
  employees: readonly JobBoardEmployee[]
  job: JobCard | null
  onAssign: (employeeMembershipId: number) => void
  onOpenChange: (open: boolean) => void
}) {
  const [employeeMembershipId, setEmployeeMembershipId] = useState("")
  const selectedEmployeeName = employees.find(
    (employee) => String(employee.membershipId) === employeeMembershipId
  )?.displayName

  return (
    <Dialog open={Boolean(job)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {job?.title}</DialogTitle>
          <DialogDescription>
            Choose the employee responsible for this job.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label
            className="mb-1.5 block text-sm font-medium"
            htmlFor="dropped-job-assignee"
          >
            Employee
          </label>
          <Select
            onValueChange={(value) => setEmployeeMembershipId(value ?? "")}
            value={employeeMembershipId}
          >
            <SelectTrigger
              aria-label="Employee"
              className="w-full"
              id="dropped-job-assignee"
            >
              <SelectValue placeholder="Choose an employee">
                {selectedEmployeeName}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem
                  key={employee.membershipId}
                  value={String(employee.membershipId)}
                >
                  {employee.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!employeeMembershipId}
            onClick={() => onAssign(Number(employeeMembershipId))}
            type="button"
          >
            Assign job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PriorityBadge({ priority }: { priority: JobCard["priority"] }) {
  return (
    <Badge
      className={cn(
        priority === "high" &&
          "border-amber-300 text-amber-700 dark:text-amber-300",
        priority === "normal" && "text-muted-foreground",
        priority === "low" && "text-muted-foreground"
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
