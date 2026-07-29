"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  LockIcon,
  LockOpenIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { archiveEmployeeRosterShiftAction } from "@/app/dashboard/employees/roster-actions"
import {
  setCalendarRosterShiftLockAction,
  updateCalendarRosterShiftAction,
} from "@/app/dashboard/roster/actions"
import { RosterShiftCreateDialog } from "@/components/roster-shift-create-dialog"
import { RosterShiftEditDialog } from "@/components/roster-shift-edit-dialog"
import { useOfflineV2Actions } from "@/components/offline-v2-actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import type { ActiveEmployeeOption } from "@/lib/employees/data"
import { buildEmployeeRosterLanes } from "@/lib/roster/presentation"
import {
  addLocalDays,
  calendarMinutesForOffset,
  clockTimeForDayMinutes,
  formatDuration,
  formatLocalTime,
  localDateForInstant,
  localTimeInputForInstant,
  minutesInLocalDay,
  positionShiftOnDate,
  shiftDurationMinutes,
  zonedLocalDateTimeToUtc,
} from "@/lib/roster/time"
import type {
  EmployeeRosterLane,
  RosterAssignableJob,
  RosterCalendarDate,
  RosterCalendarMode,
  RosterShift,
  RosterShiftDraft,
  RosterShiftPosition,
} from "@/lib/roster/types"

const TIME_RAIL_WIDTH = 64

function rosterHref(input: {
  date: string
  employeeMembershipId?: number
  mode: RosterCalendarMode
}) {
  const params = new URLSearchParams({
    date: input.date,
    view: input.mode,
  })
  if (input.employeeMembershipId) {
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

function jobsForShift(
  jobs: readonly RosterAssignableJob[],
  shift: RosterShift
) {
  const shiftStart = new Date(shift.startsAt).getTime()
  const shiftEnd = new Date(shift.endsAt).getTime()
  return jobs.filter((job) => {
    if (
      job.assigneeMembershipId !== shift.employeeMembershipId ||
      !job.scheduledAt
    ) {
      return false
    }
    const jobStart = new Date(job.scheduledAt).getTime()
    const jobEnd = new Date(job.dueAt ?? job.scheduledAt).getTime()
    return jobStart < shiftEnd && jobEnd >= shiftStart
  })
}

function ShiftDetails({
  employee,
  jobs,
  onOpenChange,
  shift,
  timezone,
}: {
  employee: string
  jobs: RosterAssignableJob[]
  onOpenChange: (open: boolean) => void
  shift: RosterShift | null
  timezone: string
}) {
  const mobile = useIsMobile()
  const details = shift ? (
    <>
      <p>{shift.notes || "No shift notes."}</p>
      <div className="grid gap-2">
        <h3 className="text-sm font-medium">Allocated jobs</h3>
        {jobs.length ? (
          <ul className="grid gap-2">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  className="block rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
                  href={`/dashboard/jobs?job=${job.id}`}
                >
                  {job.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No currently assigned jobs overlap this shift.
          </p>
        )}
      </div>
    </>
  ) : null
  const description = shift
    ? `${formatLocalTime(shift.startsAt, timezone)}–${formatLocalTime(
        shift.endsAt,
        timezone
      )} · ${formatDuration(shiftDurationMinutes(shift))}${
        shift.lockedAt ? " · Locked" : ""
      }`
    : ""

  if (mobile) {
    return (
      <Drawer open={Boolean(shift)} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent className="[--drawer-content-max-height:calc(100dvh-1rem)]">
          {shift ? (
            <>
              <DrawerHeader>
                <DrawerTitle>{employee}</DrawerTitle>
                <DrawerDescription>{description}</DrawerDescription>
              </DrawerHeader>
              <div className="grid gap-4 p-4 pt-3">{details}</div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={Boolean(shift)} onOpenChange={onOpenChange}>
      <DialogContent>
        {shift ? (
          <>
            <DialogHeader>
              <DialogTitle>{employee}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {details}
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

function stackedTeamShifts(
  lanes: EmployeeRosterLane[],
  date: string,
  timezone: string,
  visible: { endHour: number; startHour: number }
) {
  const positioned = lanes
    .flatMap((lane) =>
      lane.shifts.flatMap((shift) => {
        const position = positionShiftOnDate(shift, date, timezone, visible)
        return position
          ? [
              {
                duration: shiftDurationMinutes(shift),
                lane,
                position,
                shift,
              },
            ]
          : []
      })
    )
    .sort(
      (left, right) =>
        right.duration - left.duration ||
        left.position.topPercent - right.position.topPercent ||
        left.shift.id - right.shift.id
    )

  return positioned.map((entry, index) => {
    const entryEnd = entry.position.topPercent + entry.position.heightPercent
    const layer = positioned.slice(0, index).filter((placed) => {
      const placedEnd =
        placed.position.topPercent + placed.position.heightPercent
      return (
        entry.position.topPercent < placedEnd &&
        placed.position.topPercent < entryEnd
      )
    }).length
    return { ...entry, layer }
  })
}

type ShiftEditKind = "move" | "resize-end" | "resize-start"

type ShiftMenuActions = {
  deleteShift: (shift: RosterShift) => void
  duplicateShift: (shift: RosterShift) => void
  editShift: (shift: RosterShift) => void
  toggleLock: (shift: RosterShift) => void
}

function shiftedInstant(
  instant: string,
  timezone: string,
  dayDelta: number,
  minuteDelta: number
) {
  const originalMinutes = Math.round(minutesInLocalDay(instant, timezone))
  const totalMinutes = originalMinutes + minuteDelta
  const dayCarry = Math.floor(totalMinutes / (24 * 60))
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const date = addLocalDays(
    localDateForInstant(instant, timezone),
    dayDelta + dayCarry
  )
  return zonedLocalDateTimeToUtc(
    `${date}T${clockTimeForDayMinutes(normalizedMinutes)}`,
    timezone
  )
}

function ShiftBlock({
  date,
  dates,
  editing,
  jobs,
  lane,
  layer = null,
  menuActions,
  onEditShift,
  onSelectShift,
  position,
  readOnly,
  shift,
  timezone,
}: {
  date: string
  dates: RosterCalendarDate[]
  editing: boolean
  jobs: RosterAssignableJob[]
  lane: EmployeeRosterLane
  layer?: number | null
  menuActions: ShiftMenuActions | null
  onEditShift: (shift: RosterShift, startsAt: string, endsAt: string) => void
  onSelectShift: (shift: RosterShift) => void
  position: RosterShiftPosition
  readOnly: boolean
  shift: RosterShift
  timezone: string
}) {
  const gestureRef = useRef<{
    canvasHeight: number
    kind: ShiftEditKind
    sourceLeft: number
    startY: number
  } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const gestureValueRef = useRef<{
    dayDelta: number
    deltaMinutes: number
    deltaPixels: number
    deltaX: number
    kind: ShiftEditKind
  } | null>(null)
  const movedRef = useRef(false)
  const [gesture, setGesture] = useState<{
    dayDelta: number
    deltaMinutes: number
    deltaPixels: number
    deltaX: number
    kind: ShiftEditKind
  } | null>(null)
  const [menuPosition, setMenuPosition] = useState<{
    left: number
    top: number
  } | null>(null)
  const time = `${formatLocalTime(
    shift.startsAt,
    timezone
  )}–${formatLocalTime(shift.endsAt, timezone)}`
  const allocatedJobs = jobsForShift(jobs, shift)
  const stacked = layer !== null
  const inset = stacked ? 4 + Math.min(layer, 6) * 8 : 0
  const duration = shiftDurationMinutes(shift)
  const beginGesture = (
    event: ReactPointerEvent<HTMLElement>,
    kind: ShiftEditKind
  ) => {
    if (
      readOnly ||
      shift.lockedAt !== null ||
      editing ||
      event.altKey ||
      event.pointerType === "touch" ||
      event.button !== 0
    ) {
      return
    }
    const canvas =
      event.currentTarget.closest<HTMLElement>("[data-roster-date]")
    if (!canvas) return
    const canvasRect = canvas.getBoundingClientRect()
    if (canvasRect.height <= 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gestureRef.current = {
      canvasHeight: canvasRect.height,
      kind,
      sourceLeft: canvasRect.left,
      startY: event.clientY,
    }
    movedRef.current = false
  }
  const updateGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gestureRef.current
    if (!active) return
    event.preventDefault()
    event.stopPropagation()
    const rawMinutes =
      ((event.clientY - active.startY) / active.canvasHeight) * 24 * 60
    let deltaMinutes = Math.round(rawMinutes / 15) * 15
    if (active.kind === "resize-start") {
      deltaMinutes = Math.min(deltaMinutes, duration - 15)
    } else if (active.kind === "resize-end") {
      deltaMinutes = Math.max(deltaMinutes, -(duration - 15))
    }
    const targetDateElement =
      active.kind === "move"
        ? ([
            ...document.querySelectorAll<HTMLElement>(
              "[data-roster-day-canvas]"
            ),
          ].find((element) => {
            const rect = element.getBoundingClientRect()
            return event.clientX >= rect.left && event.clientX < rect.right
          }) ?? null)
        : null
    const targetDate = targetDateElement?.dataset.rosterDate ?? date
    const sourceIndex = dates.findIndex((item) => item.date === date)
    const targetIndex = dates.findIndex((item) => item.date === targetDate)
    const dayDelta =
      active.kind === "move" && sourceIndex >= 0 && targetIndex >= 0
        ? targetIndex - sourceIndex
        : 0
    const deltaX =
      active.kind === "move" && targetDateElement
        ? targetDateElement.getBoundingClientRect().left - active.sourceLeft
        : 0
    const deltaPixels = (deltaMinutes / (24 * 60)) * active.canvasHeight
    movedRef.current = movedRef.current || dayDelta !== 0 || deltaMinutes !== 0
    const nextGesture = {
      dayDelta,
      deltaMinutes,
      deltaPixels,
      deltaX,
      kind: active.kind,
    }
    gestureValueRef.current = nextGesture
    setGesture(nextGesture)
  }
  const finishGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gestureRef.current
    if (!active) return
    event.preventDefault()
    event.stopPropagation()
    gestureRef.current = null
    const completed = gestureValueRef.current
    gestureValueRef.current = null
    setGesture(null)
    if (
      !completed ||
      (completed.dayDelta === 0 && completed.deltaMinutes === 0)
    ) {
      return
    }
    let startsAt = shift.startsAt
    let endsAt = shift.endsAt
    if (completed.kind === "move") {
      startsAt = shiftedInstant(
        shift.startsAt,
        timezone,
        completed.dayDelta,
        completed.deltaMinutes
      )
      endsAt = shiftedInstant(
        shift.endsAt,
        timezone,
        completed.dayDelta,
        completed.deltaMinutes
      )
    } else if (completed.kind === "resize-start") {
      startsAt = shiftedInstant(
        shift.startsAt,
        timezone,
        0,
        completed.deltaMinutes
      )
    } else {
      endsAt = shiftedInstant(shift.endsAt, timezone, 0, completed.deltaMinutes)
    }
    onEditShift(shift, startsAt, endsAt)
  }
  const gestureStyle = gesture
    ? gesture.kind === "move"
      ? {
          transform: `translate(${gesture.deltaX}px, ${gesture.deltaPixels}px)`,
        }
      : gesture.kind === "resize-start"
        ? {
            height: `calc(${position.heightPercent}% - ${gesture.deltaPixels}px)`,
            top: `calc(${position.topPercent}% + ${gesture.deltaPixels}px)`,
          }
        : {
            height: `calc(${position.heightPercent}% + ${gesture.deltaPixels}px)`,
          }
    : null

  useEffect(() => {
    if (!menuPosition) return
    const closeOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuPosition(null)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuPosition(null)
    }
    document.addEventListener("click", closeOutside)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("click", closeOutside)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [menuPosition])

  const shiftCard = (
    <div
      className={`absolute rounded-md border text-[10px] leading-tight shadow-sm ${
        stacked ? "" : "inset-x-0.5 sm:inset-x-1"
      }`}
      data-stack-layer={stacked ? layer : undefined}
      data-shift-block={shift.id}
      data-shift-duration={shiftDurationMinutes(shift)}
      onContextMenu={(event) => {
        if (!menuActions || readOnly || editing) return
        event.preventDefault()
        event.stopPropagation()
        setMenuPosition({
          left: Math.max(8, Math.min(event.clientX, window.innerWidth - 176)),
          top: Math.max(8, Math.min(event.clientY, window.innerHeight - 170)),
        })
      }}
      style={{
        backgroundColor: stacked
          ? `color-mix(in oklch, ${lane.colour} 34%, transparent)`
          : `color-mix(in oklch, ${lane.colour} 24%, var(--background))`,
        borderColor: lane.colour,
        height: `${position.heightPercent}%`,
        left: stacked ? inset : undefined,
        minHeight: 22,
        right: stacked ? 4 : undefined,
        top: `${position.topPercent}%`,
        ...gestureStyle,
        transition: gesture
          ? "transform 80ms ease-out, top 80ms ease-out, height 80ms ease-out"
          : undefined,
        willChange: gesture ? "transform, top, height" : undefined,
        zIndex: stacked ? 10 + (layer ?? 0) : 10,
      }}
    >
      <button
        aria-label={`${lane.displayName}, ${time}${
          shift.notes ? `, ${shift.notes}` : ""
        }`}
        className={`h-full w-full overflow-hidden rounded-[inherit] p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-1.5 sm:text-xs ${
          readOnly || shift.lockedAt ? "cursor-pointer" : "cursor-move"
        }`}
        disabled={editing}
        onClick={(event) => {
          event.stopPropagation()
          if (event.altKey || movedRef.current) {
            movedRef.current = false
            return
          }
          onSelectShift(shift)
        }}
        onPointerCancel={(event) => finishGesture(event)}
        onPointerDown={(event) => {
          if (event.altKey) return
          event.stopPropagation()
          beginGesture(event, "move")
        }}
        onPointerMove={updateGesture}
        onPointerUp={finishGesture}
        title={
          shift.lockedAt
            ? "Locked shift"
            : stacked && !readOnly
              ? "Drag to move. Hold Alt/Option and drag to create over this shift."
              : undefined
        }
        type="button"
      >
        {stacked ? (
          <span className="flex h-full min-h-0 flex-col justify-center text-foreground [text-shadow:0_1px_2px_var(--background)]">
            <span className="block truncate font-semibold">
              {lane.displayName}
              {shift.lockedAt ? (
                <LockIcon aria-label="Locked" className="ml-1 inline size-3" />
              ) : null}
            </span>
            <span className="block truncate font-medium">{time}</span>
            {shift.notes ? (
              <span className="hidden truncate text-muted-foreground sm:block">
                {shift.notes}
              </span>
            ) : null}
            {allocatedJobs.length ? (
              <span className="block truncate text-muted-foreground">
                {allocatedJobs.length === 1
                  ? allocatedJobs[0].title
                  : `${allocatedJobs.length} jobs`}
              </span>
            ) : null}
          </span>
        ) : (
          <>
            <span className="block truncate font-medium">{time}</span>
            {shift.notes ? (
              <span className="hidden truncate text-muted-foreground sm:block">
                {shift.notes}
              </span>
            ) : null}
            {allocatedJobs.length ? (
              <span className="block truncate text-muted-foreground">
                {allocatedJobs.length === 1
                  ? allocatedJobs[0].title
                  : `${allocatedJobs.length} jobs`}
              </span>
            ) : null}
          </>
        )}
      </button>
      {!readOnly && !shift.lockedAt && !position.continuesFromPreviousDay ? (
        <button
          aria-label={`Resize ${lane.displayName} shift start`}
          className="absolute inset-x-2 top-0 hidden h-2 -translate-y-1/2 cursor-ns-resize rounded-full bg-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-ring md:block"
          disabled={editing}
          onPointerCancel={finishGesture}
          onPointerDown={(event) => beginGesture(event, "resize-start")}
          onPointerMove={updateGesture}
          onPointerUp={finishGesture}
          type="button"
        />
      ) : null}
      {!readOnly && !shift.lockedAt && !position.continuesIntoNextDay ? (
        <button
          aria-label={`Resize ${lane.displayName} shift end`}
          className="absolute inset-x-2 bottom-0 hidden h-2 translate-y-1/2 cursor-ns-resize rounded-full bg-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-ring md:block"
          disabled={editing}
          onPointerCancel={finishGesture}
          onPointerDown={(event) => beginGesture(event, "resize-end")}
          onPointerMove={updateGesture}
          onPointerUp={finishGesture}
          type="button"
        />
      ) : null}
    </div>
  )

  if (!menuActions || readOnly) return shiftCard

  return (
    <>
      {shiftCard}
      {menuPosition ? (
        <div
          className="fixed z-50 grid min-w-40 gap-0.5 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          ref={menuRef}
          role="menu"
          style={menuPosition}
        >
          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              setMenuPosition(null)
              menuActions.toggleLock(shift)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              setMenuPosition(null)
              menuActions.toggleLock(shift)
            }}
            onMouseDown={(event) => {
              if (event.button !== 0) return
              setMenuPosition(null)
              menuActions.toggleLock(shift)
            }}
            role="menuitem"
            type="button"
          >
            {shift.lockedAt ? <LockOpenIcon /> : <LockIcon />}
            {shift.lockedAt ? "Unlock shift" : "Lock shift"}
          </button>
          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              setMenuPosition(null)
              menuActions.duplicateShift(shift)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              setMenuPosition(null)
              menuActions.duplicateShift(shift)
            }}
            onMouseDown={(event) => {
              if (event.button !== 0) return
              setMenuPosition(null)
              menuActions.duplicateShift(shift)
            }}
            role="menuitem"
            type="button"
          >
            <CopyIcon />
            Duplicate
          </button>
          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            disabled={Boolean(shift.lockedAt)}
            onClick={() => {
              setMenuPosition(null)
              menuActions.editShift(shift)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              setMenuPosition(null)
              menuActions.editShift(shift)
            }}
            onMouseDown={(event) => {
              if (event.button !== 0) return
              setMenuPosition(null)
              menuActions.editShift(shift)
            }}
            role="menuitem"
            type="button"
          >
            <PencilIcon />
            Edit
          </button>
          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
            disabled={Boolean(shift.lockedAt)}
            onClick={() => {
              setMenuPosition(null)
              menuActions.deleteShift(shift)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              setMenuPosition(null)
              menuActions.deleteShift(shift)
            }}
            onMouseDown={(event) => {
              if (event.button !== 0) return
              setMenuPosition(null)
              menuActions.deleteShift(shift)
            }}
            role="menuitem"
            type="button"
          >
            <Trash2Icon />
            Delete
          </button>
        </div>
      ) : null}
    </>
  )
}

function DayCanvas({
  calendarDates,
  creationEmployeeMembershipId,
  currentTime,
  date,
  employees,
  endHour,
  jobs,
  lanes,
  menuActions,
  mobile,
  onCreateShift,
  onEditShift,
  onSelectShift,
  readOnly,
  stacked,
  startHour,
  timezone,
  updatingShiftId,
}: {
  calendarDates: RosterCalendarDate[]
  creationEmployeeMembershipId: number | null
  currentTime: Date
  date: RosterCalendarDate
  employees: readonly ActiveEmployeeOption[]
  endHour: number
  jobs: RosterAssignableJob[]
  lanes: EmployeeRosterLane[]
  menuActions: ShiftMenuActions | null
  mobile: boolean
  onCreateShift: (draft: RosterShiftDraft) => void
  onEditShift: (shift: RosterShift, startsAt: string, endsAt: string) => void
  onSelectShift: (shift: RosterShift) => void
  readOnly: boolean
  stacked: boolean
  startHour: number
  timezone: string
  updatingShiftId: number | null
}) {
  const selectionRef = useRef<{
    currentMinutes: number
    employeeMembershipId: number | null
    startMinutes: number
  } | null>(null)
  const [selection, setSelection] = useState<{
    currentMinutes: number
    employeeMembershipId: number | null
    startMinutes: number
  } | null>(null)
  const currentDate = localDateForInstant(currentTime, timezone)
  const currentMinutes = minutesInLocalDay(currentTime, timezone)
  const showCurrentTime =
    date.date === currentDate &&
    currentMinutes >= startHour * 60 &&
    currentMinutes <= endHour * 60
  const currentTimeTop =
    ((currentMinutes - startHour * 60) / ((endHour - startHour) * 60)) * 100
  const minutesForEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return calendarMinutesForOffset(event.clientY - rect.top, rect.height)
  }
  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    employeeMembershipId: number | null
  ) => {
    if (
      readOnly ||
      (!event.altKey && event.target !== event.currentTarget) ||
      event.button !== 0 ||
      !event.isPrimary
    ) {
      return
    }
    if (mobile) return
    const minutes = minutesForEvent(event)
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const next = {
      currentMinutes: minutes,
      employeeMembershipId,
      startMinutes: minutes,
    }
    selectionRef.current = next
    setSelection(next)
  }
  const handlePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
    employeeMembershipId: number | null
  ) => {
    const current = selectionRef.current
    if (
      mobile ||
      !current ||
      current.employeeMembershipId !== employeeMembershipId
    ) {
      return
    }
    const next = { ...current, currentMinutes: minutesForEvent(event) }
    selectionRef.current = next
    setSelection(next)
  }
  const handlePointerUp = (
    event: ReactPointerEvent<HTMLDivElement>,
    employeeMembershipId: number | null
  ) => {
    if (mobile) return
    const current = selectionRef.current
    if (!current || current.employeeMembershipId !== employeeMembershipId) {
      return
    }
    const releasedMinutes = minutesForEvent(event)
    const rawStart = Math.min(current.startMinutes, releasedMinutes)
    const rawEnd = Math.max(current.startMinutes, releasedMinutes)
    const startMinutes = Math.min(23 * 60 + 45, rawStart)
    const endMinutes = Math.min(24 * 60, Math.max(startMinutes + 15, rawEnd))
    selectionRef.current = null
    setSelection(null)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
    onCreateShift({
      date: date.date,
      employeeMembershipId,
      endTime: clockTimeForDayMinutes(endMinutes),
      startTime: clockTimeForDayMinutes(startMinutes),
    })
  }
  const cancelSelection = () => {
    selectionRef.current = null
    setSelection(null)
  }
  const handleMobileClick = (
    event: ReactMouseEvent<HTMLDivElement>,
    employeeMembershipId: number | null
  ) => {
    if (
      !mobile ||
      readOnly ||
      event.altKey ||
      event.target !== event.currentTarget
    ) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const minutes = Math.min(
      23 * 60 + 45,
      calendarMinutesForOffset(event.clientY - rect.top, rect.height)
    )
    onCreateShift({
      date: date.date,
      employeeMembershipId,
      endTime: clockTimeForDayMinutes(minutes + 60),
      startTime: clockTimeForDayMinutes(minutes),
    })
  }
  const visible = { endHour, startHour }
  const teamShifts = stacked
    ? stackedTeamShifts(lanes, date.date, timezone, visible)
    : []

  return (
    <div
      aria-label={`Roster for ${date.label}`}
      className="relative min-w-0 border-r bg-background last:border-r-0"
      data-roster-date={date.date}
      data-roster-day-canvas
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
      {lanes.length && stacked ? (
        <div
          aria-label={`${date.label} team shift canvas`}
          className={`absolute inset-0 touch-pan-x select-none ${
            readOnly ? "cursor-default" : "cursor-crosshair"
          }`}
          data-roster-create-lane
          data-team-shift-canvas
          onClick={(event) =>
            handleMobileClick(event, creationEmployeeMembershipId)
          }
          onPointerCancel={cancelSelection}
          onPointerDown={(event) =>
            handlePointerDown(event, creationEmployeeMembershipId)
          }
          onPointerMove={(event) =>
            handlePointerMove(event, creationEmployeeMembershipId)
          }
          onPointerUp={(event) =>
            handlePointerUp(event, creationEmployeeMembershipId)
          }
        >
          {selection ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-1 z-50 rounded-md border border-primary bg-primary/20"
              data-testid="roster-range-selection"
              style={{
                height: `${
                  (Math.max(
                    15,
                    Math.abs(selection.currentMinutes - selection.startMinutes)
                  ) /
                    (24 * 60)) *
                  100
                }%`,
                top: `${
                  (Math.min(selection.startMinutes, selection.currentMinutes) /
                    (24 * 60)) *
                  100
                }%`,
              }}
            />
          ) : null}
          {teamShifts.map(({ lane, layer, position, shift }) => (
            <ShiftBlock
              date={date.date}
              dates={calendarDates}
              editing={updatingShiftId === shift.id}
              jobs={jobs}
              key={shift.id}
              lane={lane}
              layer={layer}
              menuActions={menuActions}
              onEditShift={onEditShift}
              onSelectShift={onSelectShift}
              position={position}
              readOnly={readOnly}
              shift={shift}
              timezone={timezone}
            />
          ))}
        </div>
      ) : lanes.length ? (
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
              className={`relative min-w-0 touch-pan-x select-none ${
                readOnly ? "cursor-default" : "cursor-crosshair"
              }`}
              data-employee-lane={lane.employeeMembershipId}
              data-roster-create-lane
              key={lane.employeeMembershipId}
              onClick={(event) =>
                handleMobileClick(event, lane.employeeMembershipId)
              }
              onPointerCancel={cancelSelection}
              onPointerDown={(event) =>
                handlePointerDown(event, lane.employeeMembershipId)
              }
              onPointerMove={(event) =>
                handlePointerMove(event, lane.employeeMembershipId)
              }
              onPointerUp={(event) =>
                handlePointerUp(event, lane.employeeMembershipId)
              }
            >
              {selection?.employeeMembershipId === lane.employeeMembershipId ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-1 z-10 rounded-md border border-primary bg-primary/20"
                  data-testid="roster-range-selection"
                  style={{
                    height: `${
                      (Math.max(
                        15,
                        Math.abs(
                          selection.currentMinutes - selection.startMinutes
                        )
                      ) /
                        (24 * 60)) *
                      100
                    }%`,
                    top: `${
                      (Math.min(
                        selection.startMinutes,
                        selection.currentMinutes
                      ) /
                        (24 * 60)) *
                      100
                    }%`,
                  }}
                />
              ) : null}
              {lane.shifts.map((shift) => {
                const position = positionShiftOnDate(
                  shift,
                  date.date,
                  timezone,
                  { endHour, startHour }
                )
                if (!position) return null
                return (
                  <ShiftBlock
                    date={date.date}
                    dates={calendarDates}
                    editing={updatingShiftId === shift.id}
                    jobs={jobs}
                    key={shift.id}
                    lane={lane}
                    menuActions={menuActions}
                    onEditShift={onEditShift}
                    onSelectShift={onSelectShift}
                    position={position}
                    readOnly={readOnly}
                    shift={shift}
                    timezone={timezone}
                  />
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

function DayHeader({ date }: { date: RosterCalendarDate }) {
  return (
    <div
      className="sticky top-0 z-30 min-w-0 snap-start snap-always scroll-ml-16 border-r border-b bg-background/95 px-2 py-2 backdrop-blur last:border-r-0"
      data-roster-day-header
      data-roster-date={date.date}
    >
      <p className="truncate text-center text-xs font-medium sm:text-sm">
        {date.shortLabel}
      </p>
    </div>
  )
}

function CalendarGrid({
  currentTime,
  dates,
  employees,
  mode,
  jobs,
  menuActions,
  onEditShift,
  onSelectShift,
  onCreateShift,
  readOnly,
  selectedEmployeeId,
  shifts,
  timezone,
  updatingShiftId,
  mobile,
}: {
  currentTime: Date
  dates: RosterCalendarDate[]
  employees: ActiveEmployeeOption[]
  jobs: RosterAssignableJob[]
  menuActions: ShiftMenuActions | null
  mode: RosterCalendarMode
  mobile: boolean
  onSelectShift: (shift: RosterShift) => void
  onEditShift: (shift: RosterShift, startsAt: string, endsAt: string) => void
  onCreateShift: (draft: RosterShiftDraft) => void
  readOnly: boolean
  selectedEmployeeId: number | null
  shifts: RosterShift[]
  timezone: string
  updatingShiftId: number | null
}) {
  const displayedShifts = selectedEmployeeId
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
    const availableEmployees = selectedEmployeeId
      ? employees.filter(
          (employee) => employee.employeeMembershipId === selectedEmployeeId
        )
      : employees
    return buildEmployeeRosterLanes(availableEmployees, dateShifts, true)
  })
  const columns = mobile
    ? `${TIME_RAIL_WIDTH}px repeat(${dates.length}, calc(100dvw - 96px))`
    : `${TIME_RAIL_WIDTH}px repeat(${dates.length}, minmax(120px, 1fr))`
  const style = { gridTemplateColumns: columns } satisfies CSSProperties

  return (
    <div
      className="grid h-full min-h-0 w-max min-w-full grid-rows-[auto_minmax(0,1fr)]"
      style={style}
    >
      <div className="sticky top-0 left-0 z-40 border-r border-b bg-muted" />
      {dates.map((date) => (
        <DayHeader date={date} key={date.date} />
      ))}
      <TimeRail endHour={visible.endHour} startHour={visible.startHour} />
      {dates.map((date, index) => (
        <DayCanvas
          calendarDates={dates}
          creationEmployeeMembershipId={selectedEmployeeId}
          currentTime={currentTime}
          date={date}
          employees={employees}
          endHour={visible.endHour}
          jobs={jobs}
          key={date.date}
          lanes={lanesByDate[index]}
          menuActions={menuActions}
          mobile={mobile}
          onCreateShift={onCreateShift}
          onEditShift={onEditShift}
          onSelectShift={onSelectShift}
          readOnly={readOnly}
          stacked={mode === "team"}
          startHour={visible.startHour}
          timezone={timezone}
          updatingShiftId={updatingShiftId}
        />
      ))}
    </div>
  )
}

export function RosterCalendar({
  dates,
  employees,
  jobs = [],
  mode,
  now,
  readOnly = false,
  selectedDate,
  selectedEmployeeId,
  shifts,
  timezone,
  today,
}: {
  dates: RosterCalendarDate[]
  employees: ActiveEmployeeOption[]
  jobs?: RosterAssignableJob[]
  mode: RosterCalendarMode
  now: string
  readOnly?: boolean
  selectedDate: string
  selectedEmployeeId: number | null
  shifts: RosterShift[]
  timezone: string
  today: string
}) {
  const offline = useOfflineV2Actions()
  const router = useRouter()
  const navigateRosterRoute = (
    href: string,
    options?: { replace?: boolean }
  ) => {
    if (offline.isOffline) {
      offline.navigate?.(href, options)
    } else if (options?.replace) {
      router.replace(href, { scroll: false })
    } else {
      router.push(href)
    }
  }
  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const minuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartXRef = useRef<number | null>(null)
  const [shiftUpdatePending, startShiftUpdate] = useTransition()
  const [currentTime, setCurrentTime] = useState(() => new Date(now))
  const [contextActionShiftId, setContextActionShiftId] = useState<
    number | null
  >(null)
  const [createDraft, setCreateDraft] = useState<RosterShiftDraft | null>(null)
  const [deletingShift, setDeletingShift] = useState<RosterShift | null>(null)
  const [editingShift, setEditingShift] = useState<RosterShift | null>(null)
  const [optimisticShift, setOptimisticShift] = useState<RosterShift | null>(
    null
  )
  const [selectedShift, setSelectedShift] = useState<RosterShift | null>(null)
  const [updatingShiftId, setUpdatingShiftId] = useState<number | null>(null)
  const activeUpdatingShiftId =
    contextActionShiftId ?? (shiftUpdatePending ? updatingShiftId : null)
  const selectedIndex = Math.max(
    0,
    dates.findIndex((date) => date.date === selectedDate)
  )
  const selectedEmployee = employees.find(
    (employee) => employee.employeeMembershipId === selectedEmployeeId
  )
  const desktopDates = dates
  const previousDate = addLocalDays(selectedDate, -7)
  const nextDate = addLocalDays(selectedDate, 7)
  const navigationEmployeeId = readOnly
    ? undefined
    : (selectedEmployeeId ?? undefined)
  const optimisticShiftPending =
    optimisticShift &&
    !shifts.some(
      (shift) =>
        shift.id === optimisticShift.id &&
        shift.employeeMembershipId === optimisticShift.employeeMembershipId &&
        shift.notes === optimisticShift.notes &&
        shift.startsAt === optimisticShift.startsAt &&
        shift.endsAt === optimisticShift.endsAt &&
        shift.updatedAt === optimisticShift.updatedAt
    )
      ? optimisticShift
      : null
  const calendarShifts = optimisticShiftPending
    ? shifts.map((shift) =>
        shift.id === optimisticShiftPending.id ? optimisticShiftPending : shift
      )
    : shifts

  useEffect(() => {
    const scroller = mobileScrollRef.current
    const header = scroller?.querySelector<HTMLElement>(
      `[data-roster-day-header][data-roster-date="${selectedDate}"]`
    )
    if (scroller && header)
      scroller.scrollLeft = header.offsetLeft - TIME_RAIL_WIDTH
  }, [selectedDate])

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
      navigateRosterRoute(
        rosterHref({
          date: date.date,
          employeeMembershipId: navigationEmployeeId,
          mode,
        }),
        { replace: true }
      )
    }, 120)
  }
  const openCreateDraft = (draft: RosterShiftDraft) => {
    if (readOnly) return
    setSelectedShift(null)
    setCreateDraft(draft)
  }
  const openDefaultDraft = () => {
    if (!employees.length) return
    openCreateDraft({
      date: selectedDate,
      employeeMembershipId: selectedEmployeeId,
      endTime: "10:00",
      startTime: "09:00",
    })
  }
  const updateShift = (
    shift: RosterShift,
    startsAt: string,
    endsAt: string
  ) => {
    if (readOnly || shift.lockedAt || activeUpdatingShiftId !== null) return
    setOptimisticShift({ ...shift, endsAt, startsAt })
    setUpdatingShiftId(shift.id)
    setSelectedShift(null)
    startShiftUpdate(async () => {
      const input = {
        employeeMembershipId: shift.employeeMembershipId,
        endsAt,
        shiftId: shift.id,
        startsAt,
        updatedAt: shift.updatedAt,
      }
      const queued = await offline.queue({
        entityId: shift.id,
        entityType: "roster_shift",
        kind: "roster.update",
        payload: input,
        optimistic: (snapshot) => ({
          ...snapshot,
          roster: {
            ...snapshot.roster,
            shifts: snapshot.roster.shifts.map((item) =>
              item.id === shift.id ? { ...item, endsAt, startsAt } : item
            ),
          },
        }),
      })
      const result = queued
        ? {
            message: "Shift saved on this device.",
            ok: true,
            updatedAt: shift.updatedAt,
          }
        : await updateCalendarRosterShiftAction(input)
      if (result.ok) {
        if (result.updatedAt) {
          setOptimisticShift({
            ...shift,
            endsAt,
            startsAt,
            updatedAt: result.updatedAt,
          })
        }
        toast.success(result.message)
        if (!queued) router.refresh()
      } else {
        toast.error(result.message)
        setOptimisticShift(null)
        router.refresh()
      }
    })
  }
  const toggleShiftLock = async (shift: RosterShift) => {
    if (activeUpdatingShiftId !== null) return
    setContextActionShiftId(shift.id)
    try {
      const input = {
        employeeMembershipId: shift.employeeMembershipId,
        locked: !shift.lockedAt,
        shiftId: shift.id,
        updatedAt: shift.updatedAt,
      }
      const queued = await offline.queue({
        entityId: shift.id,
        entityType: "roster_shift",
        kind: "roster.lock",
        payload: input,
        optimistic: (snapshot) => ({
          ...snapshot,
          roster: {
            ...snapshot.roster,
            shifts: snapshot.roster.shifts.map((item) =>
              item.id === shift.id
                ? {
                    ...item,
                    lockedAt: input.locked
                      ? new Date().toISOString()
                      : null,
                  }
                : item
            ),
          },
        }),
      })
      const result = queued
        ? {
            message: input.locked
              ? "Shift lock saved on this device."
              : "Shift unlock saved on this device.",
            ok: true,
          }
        : await setCalendarRosterShiftLockAction(input)
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    } catch {
      toast.error("Unable to change the shift lock.")
    } finally {
      setContextActionShiftId(null)
      if (!offline.isOffline) router.refresh()
    }
  }
  const menuActions: ShiftMenuActions | null = readOnly
    ? null
    : {
        deleteShift: setDeletingShift,
        duplicateShift: (shift) => {
          setCreateDraft({
            date: localDateForInstant(shift.startsAt, timezone),
            employeeMembershipId: shift.employeeMembershipId,
            endTime: localTimeInputForInstant(shift.endsAt, timezone),
            notes: shift.notes,
            startTime: localTimeInputForInstant(shift.startsAt, timezone),
          })
        },
        editShift: setEditingShift,
        toggleLock: (shift) => void toggleShiftLock(shift),
      }
  const deleteShift = async () => {
    const shift = deletingShift
    if (!shift || activeUpdatingShiftId !== null) return
    setContextActionShiftId(shift.id)
    try {
      const queued = await offline.queue({
        entityId: shift.id,
        entityType: "roster_shift",
        kind: "roster.archive",
        payload: {
          employeeMembershipId: shift.employeeMembershipId,
          updatedAt: shift.updatedAt,
        },
        optimistic: (snapshot) => ({
          ...snapshot,
          roster: {
            ...snapshot.roster,
            shifts: snapshot.roster.shifts.filter(
              (item) => item.id !== shift.id
            ),
          },
        }),
      })
      const result = queued
        ? { message: "Shift deletion saved on this device.", ok: true }
        : await archiveEmployeeRosterShiftAction(
            shift.employeeMembershipId,
            shift.id,
            shift.updatedAt
          )
      if (result.ok) {
        toast.success(result.message)
        setDeletingShift(null)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Unable to delete the shift.")
    } finally {
      setContextActionShiftId(null)
      if (!offline.isOffline) router.refresh()
    }
  }

  return (
    <div className="flex h-[calc(100svh-7rem)] max-h-[calc(100svh-7rem)] min-h-0 w-full max-w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden md:h-[calc(100svh-8rem)] md:max-h-[calc(100svh-8rem)]">
      <div className="grid min-w-0 shrink-0 gap-3">
        <div
          className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-center"
          data-roster-primary-actions
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
            <p className="text-muted-foreground">
              {readOnly
                ? "Your read-only weekly roster and allocated jobs."
                : "Plan shifts and keep your team organised."}
            </p>
          </div>
          {!readOnly ? (
            <Button
              className="w-full sm:w-auto"
              disabled={!employees.length}
              onClick={openDefaultDraft}
              type="button"
            >
              Add shift
            </Button>
          ) : null}
        </div>
        <div
          className="flex min-w-0 flex-col items-center justify-end gap-2 sm:flex-row"
          data-roster-secondary-actions
        >
          <div className="w-full min-w-0 sm:w-auto">
            {!readOnly ? (
              <Select
                onValueChange={(value) => {
                  const employeeMembershipId =
                    value === "all" ? undefined : Number(value)
                  navigateRosterRoute(
                    rosterHref({
                      date: selectedDate,
                      employeeMembershipId,
                      mode,
                    })
                  )
                }}
                value={selectedEmployeeId ? String(selectedEmployeeId) : "all"}
              >
                <SelectTrigger
                  aria-label="Filter employee"
                  className="w-full max-w-56 min-w-0"
                >
                  <SelectValue>
                    {selectedEmployee?.displayName ?? "All team"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All team</SelectItem>
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
          </div>
          <div className="grid w-full grid-cols-4 items-center gap-2 sm:flex sm:w-auto sm:shrink-0">
            <Button
              aria-label="Previous week"
              className="w-full sm:w-8"
              nativeButton={false}
              render={
                <Link
                  href={rosterHref({
                    date: previousDate,
                    employeeMembershipId: navigationEmployeeId,
                    mode,
                  })}
                />
              }
              size="icon"
              variant="outline"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              className="col-span-2 w-full sm:col-span-1 sm:w-auto"
              nativeButton={false}
              render={
                <Link
                  href={rosterHref({
                    date: today,
                    employeeMembershipId: navigationEmployeeId,
                    mode,
                  })}
                />
              }
              variant="outline"
            >
              Today
            </Button>
            <Button
              aria-label="Next week"
              className="w-full sm:w-8"
              nativeButton={false}
              render={
                <Link
                  href={rosterHref({
                    date: nextDate,
                    employeeMembershipId: navigationEmployeeId,
                    mode,
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
          jobs={jobs}
          menuActions={menuActions}
          mobile={false}
          mode={mode}
          onCreateShift={openCreateDraft}
          onEditShift={updateShift}
          onSelectShift={setSelectedShift}
          readOnly={readOnly}
          selectedEmployeeId={selectedEmployeeId}
          shifts={calendarShifts}
          timezone={timezone}
          updatingShiftId={activeUpdatingShiftId}
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
            navigateRosterRoute(
              rosterHref({
                date: addLocalDays(selectedDate, -1),
                employeeMembershipId: navigationEmployeeId,
                mode,
              }),
              { replace: true }
            )
          } else if (selectedIndex === dates.length - 1 && distance < 0) {
            navigateRosterRoute(
              rosterHref({
                date: addLocalDays(selectedDate, 1),
                employeeMembershipId: navigationEmployeeId,
                mode,
              }),
              { replace: true }
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
          jobs={jobs}
          menuActions={menuActions}
          mobile
          mode={mode}
          onCreateShift={openCreateDraft}
          onEditShift={updateShift}
          onSelectShift={setSelectedShift}
          readOnly={readOnly}
          selectedEmployeeId={selectedEmployeeId}
          shifts={calendarShifts}
          timezone={timezone}
          updatingShiftId={activeUpdatingShiftId}
        />
      </div>
      <ShiftDetails
        employee={
          selectedShift
            ? (employeeById.get(selectedShift.employeeMembershipId) ??
              employeeName(employees, selectedShift.employeeMembershipId))
            : ""
        }
        jobs={selectedShift ? jobsForShift(jobs, selectedShift) : []}
        onOpenChange={(open) => !open && setSelectedShift(null)}
        shift={selectedShift}
        timezone={timezone}
      />
      {!readOnly ? (
        <>
          <RosterShiftCreateDialog
            draft={createDraft}
            employees={employees}
            jobs={jobs}
            onOpenChange={(open) => !open && setCreateDraft(null)}
            timezone={timezone}
          />
          <RosterShiftEditDialog
            employees={employees}
            onOpenChange={(open) => !open && setEditingShift(null)}
            onSaved={(updatedShift) => {
              setOptimisticShift(updatedShift)
              setEditingShift(null)
              if (!offline.isOffline) router.refresh()
            }}
            shift={editingShift}
            timezone={timezone}
          />
          <AlertDialog
            onOpenChange={(open) => !open && setDeletingShift(null)}
            open={Boolean(deletingShift)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete roster shift?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the shift from the calendar but retains its
                  archived history. Allocated jobs are not deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={activeUpdatingShiftId !== null}
                  onClick={deleteShift}
                  variant="destructive"
                >
                  Delete shift
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  )
}
