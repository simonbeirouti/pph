import { EmployeesScreen } from "@/components/employees/employees-screen"
import type { EmployeeStatusFilterValue } from "@/components/employees/employee-status-filter"
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
  searchParams: Promise<{
    create?: string
    employee?: string
    q?: string
    status?: string
  }>
}) {
  const params = await searchParams
  const actor = await requirePeopleManager()
  const employeeId = Number(params.employee)
  const openEmployeeId =
    Number.isSafeInteger(employeeId) && employeeId > 0 ? employeeId : null
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
    <EmployeesScreen
      actorRole={actor.role}
      employees={employees}
      jobSummaries={jobSummaries}
      openCreate={params.create === "1"}
      openEmployeeId={openEmployeeId}
      query={params.q}
      shiftSummaries={shiftSummaries}
      status={status}
      timezone={rosterContext.timezone}
    />
  )
}
