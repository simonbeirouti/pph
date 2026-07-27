import type { ActiveEmployeeOption } from "@/lib/employees/data"

export type RosterCalendarMode = "day" | "week"

export type RosterShift = {
  archivedAt: string | null
  createdAt: string
  createdByMembershipId: number
  employeeMembershipId: number
  endsAt: string
  id: number
  notes: string
  organisationId: number
  startsAt: string
  updatedAt: string
}

export type RosterCalendarDate = {
  date: string
  label: string
  shortLabel: string
}

export type RosterCalendarRange = {
  dates: RosterCalendarDate[]
  endUtc: string
  startUtc: string
}

export type RosterShiftPosition = {
  clippedEndAt: string
  clippedStartAt: string
  continuesFromPreviousDay: boolean
  continuesIntoNextDay: boolean
  heightPercent: number
  topPercent: number
}

export type EmployeeRosterLane = ActiveEmployeeOption & {
  colour: string
  shifts: RosterShift[]
}

export type EmployeeShiftSummary = {
  current: RosterShift | null
  upcoming: RosterShift[]
}

export type WorkingNowAggregate = {
  employeeMembershipId: number
  endsAt: string
  shiftId: number
  startsAt: string
}

export type TodayRosterAggregate = {
  employeeMembershipId: number
  firstStartsAt: string
  shiftCount: number
  totalMinutes: number
}

export type VisibleHourRange = {
  endHour: number
  startHour: number
}
