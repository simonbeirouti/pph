"use client"

import Link from "next/link"

import { EmployeeAccessActions } from "@/components/employee-access-actions"
import { EmployeeAvatar } from "@/components/employee-avatar"
import { EmployeeForm } from "@/components/employee-form"
import { useEmployeeProfileFormAction } from "@/components/profile-form-action"
import { EmployeeShiftSummary } from "@/components/employee-shift-summary"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { EmployeeSummary } from "@/lib/employees/data"
import type { EmployeeJobSummary } from "@/lib/jobs/types"
import type { EmployeeShiftSummary as EmployeeShiftSummaryModel } from "@/lib/roster/types"

export function EmployeeProfileScreen({
  access,
  actorRole,
  employee,
  jobSummary,
  shiftSummary,
  timezone,
}: {
  access?: string
  actorRole: "manager" | "owner"
  employee: EmployeeSummary
  jobSummary: EmployeeJobSummary
  shiftSummary: EmployeeShiftSummaryModel
  timezone: string
}) {
  const action = useEmployeeProfileFormAction(employee)
  const canManage = actorRole === "owner" || employee.role === "employee"

  return (
    <div className="grid w-full gap-6">
      {access ? (
        <Alert variant={access === "error" ? "destructive" : "default"}>
          <AlertDescription>
            {access === "active"
              ? "Employee access reactivated."
              : access === "inactive"
                ? "Employee access deactivated."
                : "Unable to change employee access."}
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center">
          <EmployeeAvatar
            className="size-20"
            name={employee.displayName}
            url={employee.avatarUrl}
          />
          <div className="grid flex-1 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{employee.displayName}</h1>
              <Badge className="capitalize" variant="secondary">
                {employee.status === "invited"
                  ? "Invite pending"
                  : employee.status}
              </Badge>
              <Badge className="capitalize" variant="outline">
                {employee.role}
              </Badge>
            </div>
            <p className="text-sm">
              {employee.email} · {employee.phone}
            </p>
          </div>
          {canManage ? (
            <EmployeeAccessActions
              displayName={employee.displayName}
              membershipId={employee.membershipId}
              status={employee.status}
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active and archived jobs</CardTitle>
            <CardDescription>
              {jobSummary.active.length} active · {jobSummary.archived.length}{" "}
              recently archived
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {jobSummary.active.length ? (
              jobSummary.active.map((job) => (
                <Link
                  className="rounded-md border p-3"
                  href={`/dashboard/jobs?job=${job.id}`}
                  key={job.id}
                  prefetch={false}
                >
                  <p className="font-medium">{job.title}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {job.priority} · {job.status.replace("_", " ")}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No active jobs assigned.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming shifts</CardTitle>
            <CardDescription>
              Current and next scheduled roster entries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeeShiftSummary
              summary={shiftSummary}
              timezone={timezone}
            />
          </CardContent>
        </Card>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
            <CardDescription>
              Update contact information or the profile photo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeeForm
              action={action}
              employee={employee}
              includeJobTitle={false}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
