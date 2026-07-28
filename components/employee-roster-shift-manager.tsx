"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, PlusIcon } from "lucide-react"

import { saveEmployeeRosterShiftAction } from "@/app/dashboard/employees/roster-actions"
import { FieldErrors } from "@/components/employee-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  INITIAL_ACTION_STATE,
  type ActionState,
} from "@/lib/forms/action-state"
import {
  addMinutesToClockTime,
  clockTimeDurationMinutes,
  formatDuration,
  formatLocalTime,
  localDateForInstant,
  localTimeInputForInstant,
  shiftDurationMinutes,
} from "@/lib/roster/time"
import type { EmployeeShiftSummary, RosterShift } from "@/lib/roster/types"

function ShiftForm({
  employeeMembershipId,
  onSaved,
  shift,
  timezone,
}: {
  employeeMembershipId: number
  onSaved: () => void
  shift: RosterShift | null
  timezone: string
}) {
  const action = saveEmployeeRosterShiftAction.bind(
    null,
    employeeMembershipId,
    shift?.id ?? null
  )
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    INITIAL_ACTION_STATE
  )
  const date =
    state.values?.date ??
    (shift
      ? localDateForInstant(shift.startsAt, timezone)
      : localDateForInstant(new Date(), timezone))
  const startTime =
    state.values?.startTime ??
    (shift ? localTimeInputForInstant(shift.startsAt, timezone) : "09:00")
  const endTime =
    state.values?.endTime ??
    (shift ? localTimeInputForInstant(shift.endsAt, timezone) : "17:00")
  const [selectedStartTime, setSelectedStartTime] = useState(startTime)
  const [selectedEndTime, setSelectedEndTime] = useState(endTime)

  useEffect(() => {
    if (state.ok) onSaved()
  }, [onSaved, state.ok])

  return (
    <form action={formAction} className="grid gap-4">
      {state.message ? (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {shift ? (
        <input name="updatedAt" type="hidden" value={shift.updatedAt} />
      ) : null}
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="shift-date">
          Date
        </label>
        <Input
          aria-invalid={Boolean(state.errors?.date)}
          defaultValue={date}
          id="shift-date"
          key={`date-${date}`}
          name="date"
          required
          type="date"
        />
        <FieldErrors errors={state.errors?.date} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="shift-start-time">
            Start
          </label>
          <Input
            aria-invalid={Boolean(state.errors?.startTime)}
            id="shift-start-time"
            name="startTime"
            onChange={(event) => {
              const nextStart = event.target.value
              const duration = clockTimeDurationMinutes(
                selectedStartTime,
                selectedEndTime
              )
              setSelectedStartTime(nextStart)
              if (duration !== null) {
                setSelectedEndTime(
                  addMinutesToClockTime(nextStart, duration)
                )
              }
            }}
            required
            step={60}
            type="time"
            value={selectedStartTime}
          />
          <FieldErrors errors={state.errors?.startTime} />
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="shift-end-time">
            End
          </label>
          <Input
            aria-invalid={Boolean(state.errors?.endTime)}
            id="shift-end-time"
            name="endTime"
            onChange={(event) => setSelectedEndTime(event.target.value)}
            required
            step={60}
            type="time"
            value={selectedEndTime}
          />
          <FieldErrors errors={state.errors?.endTime} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        An end time before the start time is treated as the following day.
      </p>
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="shift-notes">
          Notes
        </label>
        <Textarea
          aria-invalid={Boolean(state.errors?.notes)}
          defaultValue={state.values?.notes ?? shift?.notes ?? ""}
          id="shift-notes"
          key={`notes-${state.values?.notes ?? shift?.notes ?? ""}`}
          maxLength={500}
          name="notes"
          placeholder="Optional instructions"
          rows={3}
        />
        <FieldErrors errors={state.errors?.notes} />
      </div>
      <DialogFooter>
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : shift ? "Save shift" : "Create shift"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EmployeeRosterShiftManager({
  canManage,
  employeeMembershipId,
  employeeName,
  summary,
  timezone,
}: {
  canManage: boolean
  employeeMembershipId: number
  employeeName: string
  summary: EmployeeShiftSummary
  timezone: string
}) {
  const router = useRouter()
  const [editingShift, setEditingShift] = useState<RosterShift | null>(null)
  const [open, setOpen] = useState(false)
  const shifts = [
    ...(summary.current ? [summary.current] : []),
    ...summary.upcoming,
  ]
  const openCreate = () => {
    setEditingShift(null)
    setOpen(true)
  }
  const openEdit = (shift: RosterShift) => {
    setEditingShift(shift)
    setOpen(true)
  }
  const saved = () => {
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">Shifts</h4>
        {canManage ? (
          <Button
            onClick={openCreate}
            size="sm"
            type="button"
            variant="outline"
          >
            <PlusIcon />
            Add shift
          </Button>
        ) : null}
      </div>
      {shifts.length ? (
        <div className="grid gap-2">
          {shifts.map((shift) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border p-3"
              key={shift.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {new Intl.DateTimeFormat("en-AU", {
                    day: "numeric",
                    month: "short",
                    timeZone: timezone,
                    weekday: "short",
                  }).format(new Date(shift.startsAt))}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatLocalTime(shift.startsAt, timezone)}–
                  {formatLocalTime(shift.endsAt, timezone)} ·{" "}
                  {formatDuration(shiftDurationMinutes(shift))}
                </p>
              </div>
              {canManage ? (
                <Button
                  aria-label={`Edit ${employeeName} shift`}
                  data-shift-id={shift.id}
                  onClick={() => openEdit(shift)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <PencilIcon />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No current or upcoming shifts.
        </p>
      )}
      {!canManage ? (
        <p className="text-xs text-muted-foreground">
          Activate this employee to change their shifts.
        </p>
      ) : null}

      <Dialog open={canManage && open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingShift ? "Edit shift" : "Add shift"}
            </DialogTitle>
            <DialogDescription>
              {employeeName} · {timezone}
            </DialogDescription>
          </DialogHeader>
          <ShiftForm
            employeeMembershipId={employeeMembershipId}
            key={editingShift?.id ?? "create"}
            onSaved={saved}
            shift={editingShift}
            timezone={timezone}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
