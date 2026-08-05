"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardHomeScreen } from "@/components/dashboard/dashboard-home-screen"
import { EmployeesScreen } from "@/components/employees/employees-screen"
import type { EmployeeStatusFilterValue } from "@/components/employees/employee-status-filter"
import { JobsScreen } from "@/components/jobs/jobs-screen"
import { useOfflineV2 } from "@/components/offline/offline-v2-provider"
import { ProfileScreen } from "@/components/profile/profile-screen"
import { RosterCalendar } from "@/components/roster/roster-calendar"
import { TemplateScheduleWorkspace } from "@/components/templates/template-schedule-workspace"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { isOfflineLeaseValid } from "@/lib/offline-v2/types"
import {
  localDateForInstant,
  localDateRange,
} from "@/lib/roster/time"

const EMPLOYEE_STATUSES = new Set<EmployeeStatusFilterValue>([
  "active",
  "all",
  "inactive",
  "invited",
])

export function OfflineDashboardBoundary({
  children,
}: {
  children: React.ReactNode
}) {
  const offline = useOfflineV2()
  const router = useRouter()
  const previousSource = useRef(offline.viewSource)
  useEffect(() => {
    if (previousSource.current === "cache" && offline.viewSource === "server") {
      router.refresh()
    }
    previousSource.current = offline.viewSource
  }, [offline.viewSource, router])
  return (
    <>
      {offline.repositoryState === "preparing" ? (
        <p className="sr-only" role="status">
          Preparing workspace…
        </p>
      ) : null}
      <div>
        {offline.viewSource === "server" ? children : <CachedDashboardRoutes />}
      </div>
    </>
  )
}

export function CachedDashboardRoutes() {
  const {
    currentPath,
    navigate,
    recoverWorkspace,
    snapshot,
    status,
    workspaceRecoveryRequired,
  } = useOfflineV2()
  const [recoveryPending, setRecoveryPending] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  if (!snapshot && workspaceRecoveryRequired) {
    return (
      <OfflineUnavailable
        title="Workspace storage needs attention"
        description="This device could not open its saved workspace. Clearing local workspace data will remove any changes that have not synced, then reload the app."
        action={
          <div className="space-y-3">
            <Button
              disabled={recoveryPending}
              onClick={() => {
                setRecoveryPending(true)
                setRecoveryError(null)
                void recoverWorkspace().catch((error: unknown) => {
                  setRecoveryPending(false)
                  setRecoveryError(
                    error instanceof Error
                      ? error.message
                      : "Local workspace data could not be cleared."
                  )
                })
              }}
              type="button"
              variant="destructive"
            >
              {recoveryPending
                ? "Clearing local data…"
                : "Clear local data and retry"}
            </Button>
            {recoveryError ? (
              <p className="text-sm text-destructive" role="alert">
                {recoveryError}
              </p>
            ) : null}
          </div>
        }
      />
    )
  }
  if (!snapshot && status === "preparing") {
    return (
      <p className="sr-only" role="status">
        Opening workspace…
      </p>
    )
  }
  if (!snapshot) {
    return (
      <OfflineUnavailable
        title="Connect once to prepare this device"
        description="Sign in while connected before using the dashboard without a connection."
      />
    )
  }
  if (
    status === "lease_expired" ||
    !isOfflineLeaseValid(snapshot.leaseExpiresAt)
  ) {
    return (
      <OfflineUnavailable
        title="Reconnect to verify access"
        description="Your saved work is still on this device, but organisational data is locked until your access can be checked."
      />
    )
  }

  const url = new URL(currentPath, "https://offline.invalid")
  const route = url.pathname.replace(/\/+$/, "") || "/dashboard"
  const membership = snapshot.membership

  if (route === "/dashboard") {
    return (
      <DashboardHomeScreen
        displayName={membership.displayName}
        employeeData={snapshot.dashboard.employee}
        operationsData={snapshot.dashboard.operations}
        role={membership.role}
        timezone={membership.timezone}
      />
    )
  }

  if (route === "/dashboard/jobs") {
    const selectedJobId = positiveInteger(url.searchParams.get("job"))
    const detail = selectedJobId
      ? (snapshot.jobDetails[selectedJobId] ?? null)
      : null
    const mode =
      membership.role === "manager" &&
      url.searchParams.get("mode") === "my-work"
        ? "my-work"
        : "team"
    if (membership.role === "employee" || mode === "my-work") {
      return (
        <JobsScreen
          detail={detail}
          employees={[]}
          filterActive={false}
          jobs={snapshot.employeeJobs}
          mode="my-work"
          role={membership.role}
          rosterShifts={[]}
          templates={[]}
          timezone={membership.timezone}
          view="workflow"
        />
      )
    }
    if (!snapshot.jobs) {
      return (
        <OfflineUnavailable
          title="Jobs unavailable"
          description="The prepared data does not include the team workflow."
        />
      )
    }
    const statusFilter = url.searchParams.get("status")
    const priority = url.searchParams.get("priority")
    const employeeFilter = positiveInteger(url.searchParams.get("employee"))
    const jobs = snapshot.jobs.jobs.filter(
      (job) =>
        (!statusFilter ||
          (statusFilter === "outstanding"
            ? job.status === "assigned" || job.status === "in_progress"
            : statusFilter === "in_review" && job.status === "in_review")) &&
        (!priority || job.priority === priority)
    )
    return (
      <JobsScreen
        archivePagination={snapshot.jobs.archivePagination}
        detail={detail}
        employees={snapshot.jobs.employees}
        filterActive={Boolean(statusFilter || priority || employeeFilter)}
        initialEmployeeFilter={employeeFilter}
        jobs={jobs}
        mode={mode}
        role={membership.role}
        rosterShifts={snapshot.jobs.rosterShifts}
        templates={snapshot.jobs.templates}
        timezone={snapshot.jobs.timezone}
        view={
          url.searchParams.get("view") === "archived" ? "archived" : "workflow"
        }
      />
    )
  }

  if (route === "/dashboard/roster") {
    const now = new Date()
    const timezone = membership.timezone
    const today = localDateForInstant(now, timezone)
    const selectedDate = validLocalDate(url.searchParams.get("date")) ?? today
    const range = localDateRange(selectedDate, 7, timezone)
    const shifts = snapshot.roster.shifts.filter(
      (shift) =>
        shift.archivedAt === null &&
        shift.startsAt < range.endUtc &&
        shift.endsAt > range.startUtc
    )
    return (
      <RosterCalendar
        dates={range.dates}
        employees={
          membership.role === "employee"
            ? snapshot.roster.employees.filter(
                (employee) =>
                  employee.employeeMembershipId === membership.membershipId
              )
            : snapshot.roster.employees
        }
        jobs={snapshot.roster.jobs}
        mode={membership.role === "employee" ? "week" : "team"}
        now={now.toISOString()}
        readOnly={membership.role === "employee"}
        selectedDate={selectedDate}
        selectedEmployeeId={
          membership.role === "employee"
            ? membership.membershipId
            : positiveInteger(url.searchParams.get("employee"))
        }
        shifts={shifts}
        timezone={timezone}
        today={today}
      />
    )
  }

  if (route === "/dashboard/templates") {
    return snapshot.templates ? (
      <TemplateScheduleWorkspace
        {...snapshot.templates}
        initialView={
          url.searchParams.get("view") === "schedules"
            ? "schedules"
            : "templates"
        }
      />
    ) : (
      <OfflineUnavailable
        title="Templates unavailable"
        description="Your role does not have access to templates or schedules."
      />
    )
  }

  if (
    route === "/dashboard/employees" ||
    route === "/dashboard/employees/new"
  ) {
    if (
      !snapshot.people ||
      (membership.role !== "owner" && membership.role !== "manager")
    ) {
      return (
        <OfflineUnavailable
          title="Employees unavailable"
          description="Your role does not have access to the employee directory."
        />
      )
    }
    const query = (url.searchParams.get("q") ?? "").trim().toLocaleLowerCase()
    const rawStatus = url.searchParams.get("status")
    const employeeStatus =
      rawStatus && EMPLOYEE_STATUSES.has(rawStatus as EmployeeStatusFilterValue)
        ? (rawStatus as EmployeeStatusFilterValue)
        : "all"
    const rawEmployeeId = url.searchParams.get("employee")
    const employeeId = Number(rawEmployeeId)
    const openEmployeeId =
      rawEmployeeId && Number.isSafeInteger(employeeId) && employeeId > 0
        ? employeeId
        : null
    const employees = snapshot.people.employees.filter(
      (employee) =>
        (employeeStatus === "all" || employee.status === employeeStatus) &&
        (!query ||
          `${employee.displayName} ${employee.email}`
            .toLocaleLowerCase()
            .includes(query))
    )
    return (
      <EmployeesScreen
        actorRole={membership.role}
        employees={employees}
        jobSummaries={snapshot.people.jobSummaries}
        openCreate={
          route === "/dashboard/employees/new" ||
          url.searchParams.get("create") === "1"
        }
        openEmployeeId={openEmployeeId}
        query={url.searchParams.get("q") ?? undefined}
        shiftSummaries={snapshot.people.shiftSummaries}
        status={employeeStatus}
        timezone={membership.timezone}
      />
    )
  }

  if (route === "/dashboard/profile") {
    return <ProfileScreen profile={snapshot.profile} />
  }

  return (
    <OfflineUnavailable
      title="Page unavailable"
      description="This route is not part of the prepared dashboard."
      action={
        <Button onClick={() => navigate("/dashboard")}>Open dashboard</Button>
      }
    />
  )
}

function OfflineUnavailable({
  action,
  description,
  title,
}: {
  action?: React.ReactNode
  description: string
  title: string
}) {
  return (
    <div className="grid min-h-[50svh] place-items-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {action ? <CardContent>{action}</CardContent> : null}
      </Card>
    </div>
  )
}

function positiveInteger(value: string | null) {
  return value && /^[1-9]\d*$/.test(value) ? Number(value) : null
}

function validLocalDate(value: string | null) {
  if (!value?.match(/^\d{4}-\d{2}-\d{2}$/u)) return null
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : null
}
