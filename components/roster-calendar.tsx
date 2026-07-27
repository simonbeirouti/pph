"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { employeeInitials } from "@/components/employee-avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ActiveEmployeeOption } from "@/lib/employees/data"
import { buildEmployeeRosterLanes } from "@/lib/roster/presentation"
import {
  addLocalDays,
  formatDuration,
  formatLocalTime,
  localDateForInstant,
  minutesInLocalDay,
  positionShiftOnDate,
  shiftDurationMinutes,
} from "@/lib/roster/time"
import type {
  EmployeeRosterLane,
  RosterCalendarDate,
  RosterCalendarMode,
  RosterShift,
} from "@/lib/roster/types"
import { detectBrowserTimezone } from "@/lib/timezone"

const TIME_RAIL_WIDTH = 64

function rosterHref(input: {
  date: string
  employeeMembershipId?: number
  mode: RosterCalendarMode
  timezone: string
}) {
  const params = new URLSearchParams({
    date: input.date,
    timezone: input.timezone,
    view: input.mode,
  })
  if (input.mode === "week" && input.employeeMembershipId) {
    params.set("employee", String(input.employeeMembershipId))
  }
  return `/dashboard/roster?${params}`
}

function hourLabel(hour: number) {
  if (hour === 0) return "12 am"
  if (hour < 12) return `${hour} am`
  if (hour === 12) return "12 pm"
  if (hour === 24) return "12 am"
  return `${hour - 12} pm`
}

function employeeName(
  employees: readonly ActiveEmployeeOption[],
  membershipId: number
) {
  return (
    employees.find((employee) => employee.employeeMembershipId === membershipId)
      ?.displayName ?? "Employee"
  )
}

function ShiftDetails({
  employee,
  onOpenChange,
  shift,
  timezone,
}: {
  employee: string
  onOpenChange: (open: boolean) => void
  shift: RosterShift | null
  timezone: string
}) {
  return (
    <Dialog open={Boolean(shift)} onOpenChange={onOpenChange}>
      <DialogContent>
        {shift ? (
          <>
            <DialogHeader>
              <DialogTitle>{employee}</DialogTitle>
              <DialogDescription>
                {formatLocalTime(shift.startsAt, timezone)}–
                {formatLocalTime(shift.endsAt, timezone)} ·{" "}
                {formatDuration(shiftDurationMinutes(shift))}
              </DialogDescription>
            </DialogHeader>
            <p>{shift.notes || "No shift notes."}</p>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function TimeRail({
  endHour,
  startHour,
}: {
  endHour: number
  startHour: number
}) {
  return (
    <div
      className="sticky left-0 z-20 h-full border-r bg-background"
      data-end-hour={endHour}
      data-start-hour={startHour}
      data-testid="roster-time-rail"
    >
      {Array.from({ length: endHour - startHour + 1 }, (_, index) => {
        const hour = startHour + index
        return (
          <span
            className={`absolute right-2 text-[10px] text-muted-foreground tabular-nums ${
              index === 0
                ? ""
                : index === endHour - startHour
                  ? "-translate-y-full"
                  : "-translate-y-1/2"
            }`}
            key={hour}
            style={{
              top: `${(index / (endHour - startHour)) * 100}%`,
            }}
          >
            {hourLabel(hour)}
          </span>
        )
      })}
    </div>
  )
}

function DayCanvas({
  currentTime,
  date,
  employees,
  endHour,
  lanes,
  onSelectShift,
  startHour,
  timezone,
}: {
  currentTime: Date
  date: RosterCalendarDate
  employees: readonly ActiveEmployeeOption[]
  endHour: number
  lanes: EmployeeRosterLane[]
  onSelectShift: (shift: RosterShift) => void
  startHour: number
  timezone: string
}) {
  const currentDate = localDateForInstant(currentTime, timezone)
  const currentMinutes = minutesInLocalDay(currentTime, timezone)
  const showCurrentTime =
    date.date === currentDate &&
    currentMinutes >= startHour * 60 &&
    currentMinutes <= endHour * 60
  const currentTimeTop =
    ((currentMinutes - startHour * 60) / ((endHour - startHour) * 60)) * 100

  return (
    <div
      aria-label={`Roster for ${date.label}`}
      className="relative min-w-0 bg-background"
      data-roster-date={date.date}
      role="group"
    >
      {Array.from({ length: endHour - startHour + 1 }, (_, index) => (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t"
          key={index}
          style={{ top: `${(index / (endHour - startHour)) * 100}%` }}
        />
      ))}
      {lanes.length ? (
        <div
          className="absolute inset-0 grid divide-x"
          data-testid="employee-lanes"
          style={{
            gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))`,
          }}
        >
          {lanes.map((lane) => (
            <div
              aria-label={`${lane.displayName} shift lane`}
              className="relative min-w-0"
              data-employee-lane={lane.employeeMembershipId}
              key={lane.employeeMembershipId}
            >
              {lane.shifts.map((shift) => {
                const position = positionShiftOnDate(
                  shift,
                  date.date,
                  timezone,
                  { endHour, startHour }
                )
                if (!position) return null
                const time = `${formatLocalTime(
                  shift.startsAt,
                  timezone
                )}–${formatLocalTime(shift.endsAt, timezone)}`
                return (
                  <button
                    aria-label={`${lane.displayName}, ${time}${
                      shift.notes ? `, ${shift.notes}` : ""
                    }`}
                    className="absolute inset-x-0.5 z-10 overflow-hidden rounded-md border p-1 text-left text-[10px] leading-tight shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inset-x-1 sm:p-1.5 sm:text-xs"
                    key={shift.id}
                    onClick={() => onSelectShift(shift)}
                    style={{
                      backgroundColor: `color-mix(in oklch, ${lane.colour} 24%, var(--background))`,
                      borderColor: lane.colour,
                      height: `${position.heightPercent}%`,
                      minHeight: 22,
                      top: `${position.topPercent}%`,
                    }}
                    type="button"
                  >
                    <span className="block truncate font-medium">{time}</span>
                    {shift.notes ? (
                      <span className="hidden truncate text-muted-foreground sm:block">
                        {shift.notes}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
          No rostered employees for this date.
        </div>
      )}
      {showCurrentTime ? (
        <div
          aria-label={`Current time ${formatLocalTime(
            currentTime.toISOString(),
            timezone
          )}`}
          className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
          data-testid="current-time-line"
          role="timer"
          style={{ top: `${currentTimeTop}%` }}
        >
          <span className="absolute top-0 left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
        </div>
      ) : null}
      <span className="sr-only">
        {employees.length} active employees available.
      </span>
    </div>
  )
}

function DayHeader({
  date,
  lanes,
  mode,
}: {
  date: RosterCalendarDate
  lanes: EmployeeRosterLane[]
  mode: RosterCalendarMode
}) {
  return (
    <div
      className="sticky top-0 z-30 min-w-0 snap-start snap-always border-b bg-background/95 px-2 py-2 backdrop-blur"
      data-roster-day-header
      data-roster-date={date.date}
    >
      <p className="truncate text-center text-xs font-medium sm:text-sm">
        {date.shortLabel}
      </p>
      {mode === "day" && lanes.length ? (
        <div
          className="mt-1 grid"
          style={{
            gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))`,
          }}
        >
          {lanes.map((lane) => (
            <span
              aria-label={lane.displayName}
              className="flex min-w-0 items-center justify-center gap-1 px-1 text-xs"
              key={lane.employeeMembershipId}
              title={lane.displayName}
            >
              <span
                aria-hidden="true"
                className="grid size-5 shrink-0 place-items-center rounded-full font-semibold text-white"
                style={{ backgroundColor: lane.colour }}
              >
                {employeeInitials(lane.displayName)}
              </span>
              <span className="truncate">
                {lane.displayName}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CalendarGrid({
  currentTime,
  dates,
  employees,
  mode,
  onSelectShift,
  selectedEmployeeId,
  shifts,
  timezone,
  mobile,
}: {
  currentTime: Date
  dates: RosterCalendarDate[]
  employees: ActiveEmployeeOption[]
  mode: RosterCalendarMode
  mobile: boolean
  onSelectShift: (shift: RosterShift) => void
  selectedEmployeeId: number | null
  shifts: RosterShift[]
  timezone: string
}) {
  const displayedShifts =
    mode === "week" && selectedEmployeeId
      ? shifts.filter(
          (shift) => shift.employeeMembershipId === selectedEmployeeId
        )
      : shifts
  const visible = { endHour: 24, startHour: 0 }
  const lanesByDate = dates.map((date) => {
    const dateShifts = displayedShifts.filter(
      (shift) =>
        positionShiftOnDate(shift, date.date, timezone, visible) !== null
    )
    const availableEmployees =
      mode === "week"
        ? employees.filter(
            (employee) => employee.employeeMembershipId === selectedEmployeeId
          )
        : employees
    return buildEmployeeRosterLanes(
      availableEmployees,
      dateShifts,
      mode === "day"
    )
  })
  const columns = mobile
    ? `${TIME_RAIL_WIDTH}px repeat(${dates.length}, minmax(calc(100dvw - 96px), calc(100dvw - 96px)))`
    : `${TIME_RAIL_WIDTH}px repeat(${dates.length}, minmax(120px, 1fr))`
  const style = { gridTemplateColumns: columns } satisfies CSSProperties

  return (
    <div
      className="grid h-full min-h-0 w-max min-w-full grid-rows-[auto_minmax(0,1fr)]"
      style={style}
    >
      <div className="sticky top-0 left-0 z-40 border-r border-b bg-muted" />
      {dates.map((date, index) => (
        <DayHeader
          date={date}
          key={date.date}
          lanes={lanesByDate[index]}
          mode={mode}
        />
      ))}
      <TimeRail endHour={visible.endHour} startHour={visible.startHour} />
      {dates.map((date, index) => (
        <DayCanvas
          currentTime={currentTime}
          date={date}
          employees={employees}
          endHour={visible.endHour}
          key={date.date}
          lanes={lanesByDate[index]}
          onSelectShift={onSelectShift}
          startHour={visible.startHour}
          timezone={timezone}
        />
      ))}
    </div>
  )
}

export function RosterCalendar({
  dates,
  employees,
  mode,
  now,
  selectedDate,
  selectedEmployeeId,
  shifts,
  timezone,
  timezoneExplicit,
  today,
}: {
  dates: RosterCalendarDate[]
  employees: ActiveEmployeeOption[]
  mode: RosterCalendarMode
  now: string
  selectedDate: string
  selectedEmployeeId: number | null
  shifts: RosterShift[]
  timezone: string
  timezoneExplicit: boolean
  today: string
}) {
  const router = useRouter()
  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const minuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartXRef = useRef<number | null>(null)
  const [currentTime, setCurrentTime] = useState(() => new Date(now))
  const [selectedShift, setSelectedShift] = useState<RosterShift | null>(null)
  const selectedIndex = Math.max(
    0,
    dates.findIndex((date) => date.date === selectedDate)
  )
  const selectedEmployee = employees.find(
    (employee) => employee.employeeMembershipId === selectedEmployeeId
  )
  const selectedDateModel = dates[selectedIndex] ?? dates[0]
  const desktopDates =
    mode === "day" && selectedDateModel ? [selectedDateModel] : dates
  const previousDate = addLocalDays(selectedDate, mode === "week" ? -7 : -1)
  const nextDate = addLocalDays(selectedDate, mode === "week" ? 7 : 1)

  useEffect(() => {
    const scroller = mobileScrollRef.current
    const header = scroller?.querySelector<HTMLElement>(
      `[data-roster-day-header][data-roster-date="${selectedDate}"]`
    )
    if (scroller && header)
      scroller.scrollLeft = header.offsetLeft - TIME_RAIL_WIDTH
  }, [selectedDate])

  useEffect(() => {
    const browserTimezone = detectBrowserTimezone()
    if (
      !browserTimezone ||
      (browserTimezone === timezone && timezoneExplicit)
    ) {
      return
    }
    router.replace(
      rosterHref({
        date: timezoneExplicit
          ? selectedDate
          : localDateForInstant(new Date(), browserTimezone),
        employeeMembershipId: selectedEmployeeId ?? undefined,
        mode,
        timezone: browserTimezone,
      }),
      { scroll: false }
    )
  }, [
    mode,
    router,
    selectedDate,
    selectedEmployeeId,
    timezone,
    timezoneExplicit,
  ])

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date())
    const scheduleNextMinute = () => {
      const delay = 60_000 - (Date.now() % 60_000)
      minuteTimerRef.current = setTimeout(() => {
        updateTime()
        scheduleNextMinute()
      }, delay)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") updateTime()
    }

    updateTime()
    scheduleNextMinute()
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      if (minuteTimerRef.current) clearTimeout(minuteTimerRef.current)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  useEffect(
    () => () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    },
    []
  )

  const employeeById = useMemo(
    () =>
      new Map(
        employees.map((employee) => [
          employee.employeeMembershipId,
          employee.displayName,
        ])
      ),
    [employees]
  )

  const handleMobileScroll = () => {
    const scroller = mobileScrollRef.current
    if (!scroller) return
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      const index = Math.max(
        0,
        Math.min(
          dates.length - 1,
          Math.round(
            scroller.scrollLeft / Math.max(1, scroller.clientWidth - 64)
          )
        )
      )
      const date = dates[index]
      if (!date || date.date === selectedDate) return
      router.replace(
        rosterHref({
          date: date.date,
          employeeMembershipId: selectedEmployeeId ?? undefined,
          mode,
          timezone,
        }),
        { scroll: false }
      )
    }, 120)
  }

  return (
    <div className="flex h-[calc(100svh-7rem)] max-h-[calc(100svh-7rem)] min-h-0 w-full max-w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden md:h-[calc(100svh-8rem)] md:max-h-[calc(100svh-8rem)]">
      <div className="flex min-w-0 shrink-0 flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div
            aria-label="Roster view"
            className="inline-flex rounded-lg border p-0.5"
            role="group"
          >
            <Button
              nativeButton={false}
              render={
                <Link
                  href={rosterHref({
                    date: selectedDate,
                    mode: "day",
                    timezone,
                  })}
                />
              }
              size="sm"
              variant={mode === "day" ? "secondary" : "ghost"}
            >
              Team day
            </Button>
            <Button
              nativeButton={false}
              render={
                <Link
                  href={rosterHref({
                    date: selectedDate,
                    employeeMembershipId:
                      selectedEmployeeId ?? employees[0]?.employeeMembershipId,
                    mode: "week",
                    timezone,
                  })}
                />
              }
              size="sm"
              variant={mode === "week" ? "secondary" : "ghost"}
            >
              Employee week
            </Button>
          </div>
          {mode === "week" ? (
            <Select
              onValueChange={(value) =>
                router.push(
                  rosterHref({
                    date: selectedDate,
                    employeeMembershipId: Number(value),
                    mode,
                    timezone,
                  })
                )
              }
              value={selectedEmployeeId ? String(selectedEmployeeId) : null}
            >
              <SelectTrigger
                aria-label="Choose employee"
                className="max-w-48 min-w-0"
              >
                <SelectValue>
                  {selectedEmployee?.displayName ?? "Choose employee"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem
                    key={employee.employeeMembershipId}
                    value={String(employee.employeeMembershipId)}
                  >
                    {employee.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            aria-label={mode === "day" ? "Previous day" : "Previous week"}
            nativeButton={false}
            render={
              <Link
                href={rosterHref({
                  date: previousDate,
                  employeeMembershipId: selectedEmployeeId ?? undefined,
                  mode,
                  timezone,
                })}
              />
            }
            size="icon"
            variant="outline"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            nativeButton={false}
            render={
              <Link
                href={rosterHref({
                  date: today,
                  employeeMembershipId: selectedEmployeeId ?? undefined,
                  mode,
                  timezone,
                })}
              />
            }
            variant="outline"
          >
            Today
          </Button>
          <Button
            aria-label={mode === "day" ? "Next day" : "Next week"}
            nativeButton={false}
            render={
              <Link
                href={rosterHref({
                  date: nextDate,
                  employeeMembershipId: selectedEmployeeId ?? undefined,
                  mode,
                  timezone,
                })}
              />
            }
            size="icon"
            variant="outline"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      <div
        aria-label="Roster grid"
        className="hidden min-h-0 flex-1 overflow-auto rounded-xl border md:block"
        role="region"
      >
        <CalendarGrid
          currentTime={currentTime}
          dates={desktopDates}
          employees={employees}
          mobile={false}
          mode={mode}
          onSelectShift={setSelectedShift}
          selectedEmployeeId={selectedEmployeeId}
          shifts={shifts}
          timezone={timezone}
        />
      </div>
      <div
        aria-label="Roster grid"
        className="min-h-0 flex-1 snap-x snap-mandatory [scrollbar-width:none] overflow-auto overscroll-x-contain rounded-xl border md:hidden [&::-webkit-scrollbar]:hidden"
        onScroll={handleMobileScroll}
        onTouchEnd={(event) => {
          const startX = touchStartXRef.current
          touchStartXRef.current = null
          if (startX === null) return
          const distance = (event.changedTouches[0]?.clientX ?? startX) - startX
          if (Math.abs(distance) < 48) return
          if (selectedIndex === 0 && distance > 0) {
            router.replace(
              rosterHref({
                date: addLocalDays(selectedDate, -1),
                employeeMembershipId: selectedEmployeeId ?? undefined,
                mode,
                timezone,
              }),
              { scroll: false }
            )
          } else if (selectedIndex === dates.length - 1 && distance < 0) {
            router.replace(
              rosterHref({
                date: addLocalDays(selectedDate, 1),
                employeeMembershipId: selectedEmployeeId ?? undefined,
                mode,
                timezone,
              }),
              { scroll: false }
            )
          }
        }}
        onTouchStart={(event) => {
          touchStartXRef.current = event.touches[0]?.clientX ?? null
        }}
        ref={mobileScrollRef}
        role="region"
      >
        <CalendarGrid
          currentTime={currentTime}
          dates={dates}
          employees={employees}
          mobile
          mode={mode}
          onSelectShift={setSelectedShift}
          selectedEmployeeId={selectedEmployeeId}
          shifts={shifts}
          timezone={timezone}
        />
      </div>
      <ShiftDetails
        employee={
          selectedShift
            ? (employeeById.get(selectedShift.employeeMembershipId) ??
              employeeName(employees, selectedShift.employeeMembershipId))
            : ""
        }
        onOpenChange={(open) => !open && setSelectedShift(null)}
        shift={selectedShift}
        timezone={timezone}
      />
    </div>
  )
}
