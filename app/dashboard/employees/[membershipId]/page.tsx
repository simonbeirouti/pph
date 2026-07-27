import { notFound } from "next/navigation"

import { updateEmployeeAction } from "@/app/dashboard/employees/actions"
import { EmployeeAccessActions } from "@/components/employee-access-actions"
import { EmployeeAvatar } from "@/components/employee-avatar"
import { EmployeeForm } from "@/components/employee-form"
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
import { getEmployee } from "@/lib/employees/data"
import { getEmployeeJobSummary } from "@/lib/jobs/data"
import { getEmployeeShiftSummary } from "@/lib/roster/data"
import { requireOwner } from "@/lib/auth/membership"

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ membershipId: string }>
  searchParams: Promise<{ access?: string }>
}) {
  const { membershipId: rawMembershipId } = await params
  const { access } = await searchParams
  const membershipId = Number(rawMembershipId)
  if (!Number.isSafeInteger(membershipId)) notFound()
  const [employee, jobSummary, shiftSummary, owner] = await Promise.all([
    getEmployee(membershipId),
    getEmployeeJobSummary(membershipId),
    getEmployeeShiftSummary(membershipId),
    requireOwner(),
  ])
  if (!employee) notFound()
  const updateAction = updateEmployeeAction.bind(null, membershipId)

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
                {employee.status}
              </Badge>
              <Badge className="capitalize" variant="outline">
                Invite {employee.inviteDeliveryStatus}
              </Badge>
            </div>
            <p className="text-muted-foreground">{employee.jobTitle}</p>
            <p className="text-sm">
              {employee.email} · {employee.phone}
            </p>
          </div>
          <EmployeeAccessActions
            displayName={employee.displayName}
            membershipId={membershipId}
            status={employee.status}
          />
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
                <div className="rounded-md border p-3" key={job.id}>
                  <p className="font-medium">{job.title}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {job.priority} · {job.status.replace("_", " ")}
                  </p>
                </div>
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
              timezone={owner.timezone}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
          <CardDescription>
            Update contact information, job title, or profile photo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeForm action={updateAction} employee={employee} />
        </CardContent>
      </Card>
    </div>
  )
}
