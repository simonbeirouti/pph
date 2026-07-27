import type { EmployeeRosterLane, RosterShift } from "@/lib/roster/types"
import type { ActiveEmployeeOption } from "@/lib/employees/data"

const COLOURS = [
  "oklch(0.72 0.14 250)",
  "oklch(0.74 0.15 155)",
  "oklch(0.76 0.14 75)",
  "oklch(0.7 0.16 25)",
  "oklch(0.71 0.14 310)",
  "oklch(0.72 0.12 195)",
] as const

export function colourForEmployee(membershipId: number) {
  return COLOURS[Math.abs(membershipId) % COLOURS.length]
}

export function buildEmployeeRosterLanes(
  employees: readonly ActiveEmployeeOption[],
  shifts: readonly RosterShift[],
  includeEmployeesWithoutShifts = false
): EmployeeRosterLane[] {
  const shiftsByEmployee = new Map<number, RosterShift[]>()
  for (const shift of shifts) {
    const rows = shiftsByEmployee.get(shift.employeeMembershipId) ?? []
    rows.push(shift)
    shiftsByEmployee.set(shift.employeeMembershipId, rows)
  }

  const lanes = employees
    .map((employee) => {
      const employeeShifts = (
        shiftsByEmployee.get(employee.employeeMembershipId) ?? []
      ).toSorted((left, right) => left.startsAt.localeCompare(right.startsAt))
      return {
        ...employee,
        colour: colourForEmployee(employee.employeeMembershipId),
        shifts: employeeShifts,
      }
    })
    .filter(
      (employee) => includeEmployeesWithoutShifts || employee.shifts.length > 0
    )

  return lanes
    .toSorted((left, right) => {
      const leftStartsAt = left.shifts[0]?.startsAt
      const rightStartsAt = right.shifts[0]?.startsAt
      if (!leftStartsAt && rightStartsAt) return 1
      if (leftStartsAt && !rightStartsAt) return -1
      const shiftOrder =
        leftStartsAt && rightStartsAt
          ? leftStartsAt.localeCompare(rightStartsAt)
          : 0
      return shiftOrder || left.displayName.localeCompare(right.displayName)
    })
}
