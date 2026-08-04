"use client"

import { useState } from "react"

import { updateEmployeeAction } from "@/app/dashboard/employees/actions"
import { EmployeeAccessActions } from "@/components/employees/employee-access-actions"
import { EmployeeAvatar } from "@/components/employees/employee-avatar"
import { EmployeeInvitationAction } from "@/components/employees/employee-invitation-action"
import { useOfflineV2Actions } from "@/components/offline/offline-v2-actions"
import {
  EmployeeEditor,
  EmployeeSaveAction,
  MembershipRoleSelector,
} from "@/components/employees/membership-role-actions"
import { EmployeeSheetProfile } from "@/components/employees/employee-sheet-profile"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EmployeeSummary } from "@/lib/employees/data"
import type { EmployeeJobSummary } from "@/lib/jobs/types"
import type { EmployeeShiftSummary } from "@/lib/roster/types"
import { formatLocalTime } from "@/lib/roster/time"

export function EmployeeDirectoryTable({
  actorRole,
  employees,
  jobSummaries,
  openEmployeeId,
  shiftSummaries,
  timezone,
}: {
  actorRole: "owner" | "manager"
  employees: EmployeeSummary[]
  jobSummaries: Record<number, EmployeeJobSummary>
  openEmployeeId?: number | null
  shiftSummaries: Record<number, EmployeeShiftSummary>
  timezone: string
}) {
  const offline = useOfflineV2Actions()
  const initialEmployeeId = employees.some(
    (employee) => employee.membershipId === openEmployeeId
  )
    ? (openEmployeeId ?? null)
    : null
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    initialEmployeeId
  )
  const [open, setOpen] = useState(initialEmployeeId !== null)
  const selectedEmployee =
    employees.find(
      (employee) => employee.membershipId === selectedEmployeeId
    ) ?? null
  const openEmployee = (membershipId: number) => {
    setSelectedEmployeeId(membershipId)
    setOpen(true)
  }
  const updateSelectedEmployee = async (
    state: Parameters<typeof updateEmployeeAction>[1],
    formData: FormData
  ) => {
    if (!selectedEmployee || !offline.usesLocalRepository) {
      return selectedEmployee
        ? updateEmployeeAction(selectedEmployee.membershipId, state, formData)
        : { message: "Employee not found.", ok: false }
    }
    const avatar = formData.get("avatar")
    const values = {
      firstName: String(formData.get("firstName") ?? ""),
      jobTitle: String(formData.get("jobTitle") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    }
    await offline.queue({
      ...(avatar instanceof File && avatar.size ? { blob: avatar } : {}),
      entityId: selectedEmployee.membershipId,
      entityType: "employee_profile",
      kind: "membership.update",
      payload: values,
      optimistic: (snapshot) => ({
        ...snapshot,
        people: snapshot.people
          ? {
              ...snapshot.people,
              employees: snapshot.people.employees.map((employee) =>
                employee.membershipId === selectedEmployee.membershipId
                  ? {
                      ...employee,
                      ...values,
                      displayName:
                        `${values.firstName} ${values.lastName}`.trim(),
                    }
                  : employee
              ),
            }
          : null,
      }),
    })
    return { message: "Employee saved on this device.", ok: true }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Today</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow
              aria-expanded={
                open && selectedEmployeeId === employee.membershipId
              }
              aria-haspopup="dialog"
              aria-label={`Open ${employee.displayName} details`}
              className="cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
              key={employee.membershipId}
              onClick={() => openEmployee(employee.membershipId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  openEmployee(employee.membershipId)
                }
              }}
              tabIndex={0}
            >
              <TableCell>
                <div className="flex min-w-56 items-center gap-3 font-medium">
                  <EmployeeAvatar
                    className="size-9"
                    name={employee.displayName}
                    url={employee.avatarUrl}
                  />
                  <span className="grid">
                    <span>{employee.displayName}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {employee.email}
                    </span>
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {employee.role}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {employee.status === "invited"
                    ? "Invite pending"
                    : employee.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {shiftSummaries[employee.membershipId]?.current
                  ? `Working until ${formatLocalTime(
                      shiftSummaries[employee.membershipId].current!.endsAt,
                      timezone
                    )}`
                  : shiftSummaries[employee.membershipId]?.upcoming[0]
                    ? `Next ${formatLocalTime(
                        shiftSummaries[employee.membershipId].upcoming[0]
                          .startsAt,
                        timezone
                      )}`
                    : "Not rostered"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <SheetContent className="gap-0 overflow-hidden data-[side=right]:w-full data-[side=right]:sm:w-[min(46rem,calc(100vw-2rem))] data-[side=right]:sm:max-w-[min(84rem,calc(100vw-2rem))]">
        {selectedEmployee ? (
          <EmployeeEditor
            currentRole={selectedEmployee.role}
            displayName={selectedEmployee.displayName}
            membershipId={selectedEmployee.membershipId}
          >
            <EmployeeSheetProfile
              action={updateSelectedEmployee}
              employee={selectedEmployee}
              canEdit={
                actorRole === "owner" || selectedEmployee.role === "employee"
              }
              jobSummary={
                jobSummaries[selectedEmployee.membershipId] ?? {
                  active: [],
                  archived: [],
                }
              }
              roleActions={
                actorRole === "owner" ? <MembershipRoleSelector /> : null
              }
              shiftSummary={
                shiftSummaries[selectedEmployee.membershipId] ?? {
                  current: null,
                  upcoming: [],
                }
              }
              timezone={timezone}
              key={`profile-${selectedEmployee.membershipId}`}
            />
            <div className="shrink-0 border-t p-4">
              <div className="mx-auto grid w-full max-w-3xl gap-2">
                {actorRole === "owner" ? (
                  <EmployeeSaveAction />
                ) : selectedEmployee.role === "employee" ? (
                  <EmployeeSaveAction />
                ) : null}
                {actorRole === "owner" ||
                selectedEmployee.role === "employee" ? (
                  <>
                    <EmployeeInvitationAction
                      deliveryStatus={selectedEmployee.inviteDeliveryStatus}
                      key={`invitation-${selectedEmployee.membershipId}`}
                      membershipId={selectedEmployee.membershipId}
                      status={selectedEmployee.status}
                    />
                    <EmployeeAccessActions
                      displayName={selectedEmployee.displayName}
                      key={`access-${selectedEmployee.membershipId}`}
                      membershipId={selectedEmployee.membershipId}
                      onDeleted={() => setOpen(false)}
                      status={selectedEmployee.status}
                    />
                  </>
                ) : null}
              </div>
            </div>
          </EmployeeEditor>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
