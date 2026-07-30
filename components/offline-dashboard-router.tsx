"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"

import { EmployeeCreateDialog } from "@/components/employee-create-dialog"
import { EmployeeDirectoryTable } from "@/components/employee-directory-table"
import { EmployeeJobDetail, OwnerJobDetail } from "@/components/job-detail"
import { JobWorkspace } from "@/components/job-workspace"
import {
  EmployeeOperationalDashboard,
  OwnerOperationalDashboard,
} from "@/components/operational-dashboard"
import { EmployeeJobsList } from "@/components/employee-jobs-list"
import { EmployeeAvatar } from "@/components/employee-avatar"
import { RosterCalendar } from "@/components/roster-calendar"
import { TemplateScheduleWorkspace } from "@/components/template-schedule-workspace"
import { useOfflineV2 } from "@/components/offline-v2-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { JobCard } from "@/lib/jobs/types"
import { isOfflineLeaseValid } from "@/lib/offline-v2/types"
import {
  localDateForInstant,
  localDateRange,
  mondayForLocalDate,
} from "@/lib/roster/time"

export function OfflineDashboardBoundary({
  children,
}: {
  children: React.ReactNode
}) {
  const offline = useOfflineV2()
  if (offline.repositoryState === "preparing") {
    return (
      <fieldset
        aria-busy="true"
        aria-describedby="repository-preparing-description"
        className="contents"
        disabled
      >
        {children}
        <span className="sr-only" id="repository-preparing-description">
          Preparing workspace. Editing controls will be available shortly.
        </span>
      </fieldset>
    )
  }
  if (!offline.usesLocalRepository) return children
  return <OfflineDashboardRouter />
}

export function OfflineDashboardRouter() {
  const { currentPath, navigate, snapshot, status } = useOfflineV2()
  if (!snapshot) {
    return (
      <OfflineUnavailable
        title="Connect once to prepare this device"
        description="Sign in while connected and wait for Offline ready before using this device without a connection."
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
  const path = url.pathname
  const route = path.replace(/\/+$/, "") || "/dashboard"
  if (route === "/dashboard") return <OfflineDashboardHome />
  if (route === "/dashboard/jobs") {
    return <OfflineJobsPage searchParams={url.searchParams} />
  }
  if (route === "/dashboard/roster") {
    return <OfflineRosterPage searchParams={url.searchParams} />
  }
  if (route === "/dashboard/templates") {
    return <OfflineTemplatesPage searchParams={url.searchParams} />
  }
  if (route === "/dashboard/employees") {
    return <OfflineEmployeesPage searchParams={url.searchParams} />
  }
  const employeeMatch = route.match(/^\/dashboard\/employees\/(\d+)$/)
  if (employeeMatch) {
    return <OfflineEmployeePage membershipId={Number(employeeMatch[1])} />
  }
  if (route === "/dashboard/profile") return <OfflineProfilePage />

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

function OfflineDashboardHome() {
  const { snapshot } = useOfflineV2()
  if (!snapshot) return null
  const membership = snapshot.membership
  if (membership.role === "employee") {
    return snapshot.dashboard.employee ? (
      <EmployeeOperationalDashboard
        data={snapshot.dashboard.employee}
        name={membership.displayName}
        timezone={membership.timezone}
      />
    ) : null
  }
  return snapshot.dashboard.operations ? (
    <div className="grid gap-4">
      {membership.role === "manager" ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Your assigned work</p>
              <p className="text-sm text-muted-foreground">
                Your assigned work, ranked from highest to lowest urgency.
              </p>
            </div>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/jobs?mode=my-work" prefetch={false} />}
            >
              View my work
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <OwnerOperationalDashboard
        data={snapshot.dashboard.operations}
        name={membership.displayName}
        timezone={membership.timezone}
      />
    </div>
  ) : null
}

function OfflineJobsPage({
  searchParams,
}: {
  searchParams: URLSearchParams
}) {
  const { snapshot } = useOfflineV2()
  if (!snapshot) return null
  const membership = snapshot.membership
  const selectedJobId = positiveInteger(searchParams.get("job"))
  const selectedDetail = selectedJobId
    ? snapshot.jobDetails[selectedJobId] ?? null
    : null
  const myWork =
    membership.role === "employee" ||
    (membership.role === "manager" && searchParams.get("mode") === "my-work")

  if (myWork) {
    return (
      <div className="grid gap-4">
        {membership.role === "manager" ? (
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
              render={<Link href="/dashboard/jobs?mode=my-work" prefetch={false} />}
            >
              My work
            </Button>
          </div>
        ) : null}
        <EmployeeJobsList
          jobs={snapshot.employeeJobs}
          timezone={membership.timezone}
        />
        {selectedDetail ? (
          <EmployeeJobDetail
            detail={selectedDetail}
            timezone={membership.timezone}
          />
        ) : null}
      </div>
    )
  }

  if (!snapshot.jobs) return null
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")
  const jobs = snapshot.jobs.jobs.filter(
    (job) =>
      (!status ||
        (status === "outstanding"
          ? job.status === "assigned" || job.status === "in_progress"
          : status === "in_review" && job.status === "in_review")) &&
      (!priority || job.priority === priority)
  )
  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-0 flex-col">
      <JobWorkspace
        employees={snapshot.jobs.employees}
        filterActive={Boolean(status || priority)}
        initialJobs={jobs}
        initialView={
          searchParams.get("view") === "archived" ? "archived" : "workflow"
        }
        rosterShifts={snapshot.jobs.rosterShifts}
        templates={snapshot.jobs.templates}
        timezone={snapshot.jobs.timezone}
      />
      {selectedDetail ? (
        <OwnerJobDetail
          canReview={
            membership.role === "owner" ||
            selectedDetail.requiredReviewerRole === "manager"
          }
          detail={selectedDetail}
          employees={snapshot.jobs.employees}
          timezone={snapshot.jobs.timezone}
        />
      ) : null}
    </div>
  )
}

function OfflineRosterPage({
  searchParams,
}: {
  searchParams: URLSearchParams
}) {
  const { snapshot } = useOfflineV2()
  if (!snapshot) return null
  const now = new Date()
  const timezone = snapshot.membership.timezone
  const today = localDateForInstant(now, timezone)
  const selectedDate = validLocalDate(searchParams.get("date")) ?? today
  const range = localDateRange(
    mondayForLocalDate(selectedDate),
    7,
    timezone
  )
  const shifts = snapshot.roster.shifts.filter(
    (shift) =>
      shift.archivedAt === null &&
      shift.startsAt < range.endUtc &&
      shift.endsAt > range.startUtc
  )
  const employee =
    snapshot.membership.role === "employee"
      ? snapshot.membership.membershipId
      : positiveInteger(searchParams.get("employee"))
  return (
    <RosterCalendar
      dates={range.dates}
      employees={
        snapshot.membership.role === "employee"
          ? snapshot.roster.employees.filter(
              (item) =>
                item.employeeMembershipId === snapshot.membership.membershipId
            )
          : snapshot.roster.employees
      }
      jobs={snapshot.roster.jobs}
      mode={snapshot.membership.role === "employee" ? "week" : "team"}
      now={now.toISOString()}
      readOnly={snapshot.membership.role === "employee"}
      selectedDate={selectedDate}
      selectedEmployeeId={employee}
      shifts={shifts}
      timezone={timezone}
      today={today}
    />
  )
}

function OfflineTemplatesPage({
  searchParams,
}: {
  searchParams: URLSearchParams
}) {
  const { snapshot } = useOfflineV2()
  if (!snapshot?.templates) {
    return (
      <OfflineUnavailable
        title="Templates unavailable"
        description="Your role does not have access to templates or schedules."
      />
    )
  }
  return (
    <TemplateScheduleWorkspace
      {...snapshot.templates}
      initialView={
        searchParams.get("view") === "schedules"
          ? "schedules"
          : "templates"
      }
    />
  )
}

function OfflineEmployeesPage({
  searchParams,
}: {
  searchParams: URLSearchParams
}) {
  const { snapshot } = useOfflineV2()
  if (!snapshot?.people) {
    return (
      <OfflineUnavailable
        title="Employees unavailable"
        description="Your role does not have access to the employee directory."
      />
    )
  }
  if (
    snapshot.membership.role !== "owner" &&
    snapshot.membership.role !== "manager"
  ) {
    return null
  }
  const query = (searchParams.get("q") ?? "").trim().toLocaleLowerCase()
  const status = searchParams.get("status")
  const employees = snapshot.people.employees.filter(
    (employee) =>
      (!status || status === "all" || employee.status === status) &&
      (!query ||
        `${employee.displayName} ${employee.email}`
          .toLocaleLowerCase()
          .includes(query))
  )
  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-muted-foreground">
            Manage profiles, invitations, and application access.
          </p>
        </div>
        <EmployeeCreateDialog
          canChooseRole={snapshot.membership.role === "owner"}
        />
      </div>
      <EmployeeDirectoryTable
        actorRole={snapshot.membership.role}
        employees={employees}
        jobSummaries={snapshot.people.jobSummaries}
        shiftSummaries={snapshot.people.shiftSummaries}
        timezone={snapshot.membership.timezone}
      />
    </div>
  )
}

function OfflineEmployeePage({ membershipId }: { membershipId: number }) {
  const { snapshot } = useOfflineV2()
  const employee = snapshot?.people?.employees.find(
    (item) => item.membershipId === membershipId
  )
  if (!snapshot || !employee) {
    return (
      <OfflineUnavailable
        title="Employee unavailable"
        description="This employee is not in the prepared role-scoped data."
      />
    )
  }
  const jobs = snapshot.people?.jobSummaries[membershipId]
  const shifts = snapshot.people?.shiftSummaries[membershipId]
  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="flex items-center gap-4">
          <EmployeeAvatar
            className="size-20"
            name={employee.displayName}
            url={employee.avatarUrl}
          />
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{employee.displayName}</h1>
              <Badge variant="secondary">{employee.status}</Badge>
              <Badge variant="outline">{employee.role}</Badge>
            </div>
            <p className="text-muted-foreground">{employee.jobTitle}</p>
            <p className="text-sm">
              {employee.email} · {employee.phone}
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>
              {jobs?.active.length ?? 0} active ·{" "}
              {jobs?.archived.length ?? 0} recently archived
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(jobs?.active ?? []).map((job) => (
              <Link
                className="rounded-md border p-3"
                href={`/dashboard/jobs?job=${job.id}`}
                key={job.id}
                prefetch={false}
              >
                <p className="font-medium">{job.title}</p>
                <p className="text-sm capitalize text-muted-foreground">
                  {job.priority} · {job.status.replace("_", " ")}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming shifts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {shifts?.current
                ? "Currently rostered"
                : `${shifts?.upcoming.length ?? 0} upcoming shifts`}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function OfflineProfilePage() {
  const { isOnline, queueOperation, snapshot } = useOfflineV2()
  const profile = snapshot?.profile
  const [saved, setSaved] = useState(false)
  if (!snapshot || !profile) return null

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      firstName: String(form.get("firstName") ?? ""),
      jobTitle: String(form.get("jobTitle") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      phone: String(form.get("phone") ?? ""),
    }
    const clientOperationId = crypto.randomUUID()
    const avatar = form.get("avatar")
    const queued = await queueOperation(
      {
        clientOperationId,
        createdAt: new Date().toISOString(),
        dependsOn: [],
        entity: { id: profile.membershipId, source: "server" },
        entityType: "profile",
        expectedVersion: profile.profileVersion ?? null,
        kind: "profile.update",
        payload: values,
        state: "pending",
      },
      {
        ...(avatar instanceof File && avatar.size ? { blob: avatar } : {}),
        optimistic: (current) => ({
          ...current,
          membership: {
            ...current.membership,
            displayName: `${values.firstName} ${values.lastName}`.trim(),
          },
          profile: {
            ...current.profile,
            ...values,
            displayName: `${values.firstName} ${values.lastName}`.trim(),
          },
        }),
      }
    )
    if (!queued) return
    setSaved(true)
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <EmployeeAvatar
          className="size-16"
          name={profile.displayName}
          url={profile.avatarUrl}
        />
        <div>
          <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
        </div>
      </div>
      {saved ? (
        <Alert>
          <AlertTitle>Changes saved</AlertTitle>
          <AlertDescription>
            {isOnline
              ? "Your profile update is synchronising in the background."
              : "Your profile update will synchronise when the connection returns."}
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Profile information</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-2 sm:grid-cols-2">
              <ProfileField
                defaultValue={profile.firstName}
                label="First name"
                name="firstName"
              />
              <ProfileField
                defaultValue={profile.lastName}
                label="Last name"
                name="lastName"
              />
              <ProfileField
                defaultValue={profile.phone}
                label="Phone"
                name="phone"
              />
              <ProfileField
                defaultValue={profile.jobTitle}
                label="Job title"
                name="jobTitle"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="offline-profile-avatar">
                Replace profile photo
              </Label>
              <Input
                accept="image/jpeg,image/png,image/webp"
                id="offline-profile-avatar"
                name="avatar"
                type="file"
              />
              <p className="text-sm text-muted-foreground">
                The photo stays on this device until it can be uploaded.
              </p>
            </div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileField({
  defaultValue,
  label,
  name,
}: {
  defaultValue: string
  label: string
  name: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`offline-${name}`}>{label}</Label>
      <Input
        defaultValue={defaultValue}
        id={`offline-${name}`}
        name={name}
        required={name === "firstName" || name === "lastName"}
      />
    </div>
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
    <div className="grid min-h-[60dvh] place-items-center p-4">
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

export function offlineJobVersion(job: JobCard) {
  return "version" in job && typeof job.version === "number"
    ? job.version
    : null
}
