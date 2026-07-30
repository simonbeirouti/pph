import { EmployeeCreateDialog } from "@/components/employee-create-dialog"
import { EmployeeDirectoryTable } from "@/components/employee-directory-table"
import {
  EmployeeStatusFilter,
  type EmployeeStatusFilterValue,
} from "@/components/employee-status-filter"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { listEmployees } from "@/lib/employees/data"
import { requirePeopleManager } from "@/lib/auth/membership"
import { listEmployeeJobSummaries } from "@/lib/jobs/data"
import {
  getOwnerRosterContext,
  listEmployeeShiftSummaries,
} from "@/lib/roster/data"

const STATUSES = new Set(["all", "invited", "active", "inactive"])

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const params = await searchParams
  const actor = await requirePeopleManager()
  const status = STATUSES.has(params.status ?? "")
    ? (params.status as EmployeeStatusFilterValue)
    : "all"
  const [employees, jobSummaries, shiftSummaries, rosterContext] =
    await Promise.all([
      listEmployees({ search: params.q, status }),
      listEmployeeJobSummaries(),
      listEmployeeShiftSummaries(),
      getOwnerRosterContext(),
    ])

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            Manage profiles, invitations, and application access.
          </p>
        </div>
        <EmployeeCreateDialog canChooseRole={actor.role === "owner"} />
      </div>
      <Card>
        <CardContent className="grid gap-4">
          <form className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
            <Input
              aria-label="Search employees"
              defaultValue={params.q}
              name="q"
              placeholder="Search name or email"
            />
            <EmployeeStatusFilter status={status} />
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
          {employees.length ? (
            <EmployeeDirectoryTable
              actorRole={actor.role}
              employees={employees}
              jobSummaries={jobSummaries}
              shiftSummaries={shiftSummaries}
              timezone={rosterContext.timezone}
            />
          ) : (
            <div className="grid justify-items-center gap-3 py-12 text-center">
              <h2 className="font-medium">No employees found</h2>
              <p className="text-sm text-muted-foreground">
                Adjust the search or add your first employee.
              </p>
              <EmployeeCreateDialog canChooseRole={actor.role === "owner"} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
