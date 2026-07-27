"use client"

import { useState } from "react"

import { updateEmployeeAction } from "@/app/dashboard/employees/actions"
import { EmployeeAccessActions } from "@/components/employee-access-actions"
import { EmployeeAvatar } from "@/components/employee-avatar"
import { EmployeeInvitationAction } from "@/components/employee-invitation-action"
import { EmployeeSheetProfile } from "@/components/employee-sheet-profile"
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

export function EmployeeDirectoryTable({
  employees,
  jobSummaries,
}: {
  employees: EmployeeSummary[]
  jobSummaries: Record<number, EmployeeJobSummary>
}) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null
  )
  const [open, setOpen] = useState(false)
  const selectedEmployee =
    employees.find(
      (employee) => employee.membershipId === selectedEmployeeId
    ) ?? null
  const openEmployee = (membershipId: number) => {
    setSelectedEmployeeId(membershipId)
    setOpen(true)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Job title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Invitation</TableHead>
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
              <TableCell>{employee.jobTitle}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {employee.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {employee.inviteDeliveryStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                Roster available in S06
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <SheetContent className="w-full gap-0 overflow-hidden sm:max-w-2xl">
        {selectedEmployee ? (
          <>
            <EmployeeSheetProfile
              action={updateEmployeeAction.bind(
                null,
                selectedEmployee.membershipId
              )}
              employee={selectedEmployee}
              jobSummary={
                jobSummaries[selectedEmployee.membershipId] ?? {
                  active: [],
                  archived: [],
                }
              }
              key={`profile-${selectedEmployee.membershipId}`}
            />
            <div className="grid shrink-0 gap-2 border-t p-4">
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
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
