"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { editCalendarRosterShiftAction } from "@/app/dashboard/roster/actions"
import { FieldErrors } from "@/components/employee-form"
import { useOfflineV2Actions } from "@/components/offline-v2-actions"
import { RosterDatePicker } from "@/components/roster-date-picker"
import { RosterTimePicker } from "@/components/roster-time-picker"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Textarea } from "@/components/ui/textarea"
import type { ActiveEmployeeOption } from "@/lib/employees/data"
import {
  INITIAL_ACTION_STATE,
  type ActionState,
} from "@/lib/forms/action-state"
import {
  addMinutesToClockTime,
  clockTimeDurationMinutes,
  localDateForInstant,
  localTimeInputForInstant,
  zonedLocalDateTimeToUtc,
} from "@/lib/roster/time"
import type { RosterShift } from "@/lib/roster/types"
import { useIsMobile } from "@/hooks/use-mobile"

export function RosterShiftEditDialog({
  employees,
  onOpenChange,
  onSaved,
  shift,
  timezone,
}: {
  employees: ActiveEmployeeOption[]
  onOpenChange: (open: boolean) => void
  onSaved: (shift: RosterShift) => void
  shift: RosterShift | null
  timezone: string
}) {
  const mobile = useIsMobile()
  const form = shift ? (
    <RosterShiftEditForm
      employees={employees}
      key={`${shift.id}-${shift.updatedAt}`}
      mobile={mobile}
      onSaved={(updatedShift) => {
        onSaved(updatedShift)
        onOpenChange(false)
      }}
      shift={shift}
      timezone={timezone}
    />
  ) : null

  if (mobile) {
    return (
      <Drawer open={Boolean(shift)} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent className="[--drawer-content-max-height:calc(100dvh-1rem)]">
          {form}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={Boolean(shift)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">{form}</DialogContent>
    </Dialog>
  )
}

function RosterShiftEditForm({
  employees,
  mobile,
  onSaved,
  shift,
  timezone,
}: {
  employees: ActiveEmployeeOption[]
  mobile: boolean
  onSaved: (shift: RosterShift) => void
  shift: RosterShift
  timezone: string
}) {
  const offline = useOfflineV2Actions()
  const action = async (state: ActionState, formData: FormData) => {
    if (!offline.usesLocalRepository) {
      return editCalendarRosterShiftAction(
        shift.id,
        shift.employeeMembershipId,
        shift.updatedAt,
        state,
        formData
      )
    }
    const nextDate = String(formData.get("date") ?? "")
    const nextStartTime = String(formData.get("startTime") ?? "")
    const nextEndTime = String(formData.get("endTime") ?? "")
    const nextTimezone = String(formData.get("timezone") ?? timezone)
    const nextEmployeeMembershipId = Number(
      formData.get("employeeMembershipId")
    )
    const startsAt = zonedLocalDateTimeToUtc(
      `${nextDate}T${nextStartTime}`,
      nextTimezone
    )
    const endsAt = zonedLocalDateTimeToUtc(
      `${nextDate}T${nextEndTime}`,
      nextTimezone
    )
    const notes = String(formData.get("notes") ?? "")
    const updatedAt = new Date().toISOString()
    await offline.queue({
      entityId: shift.id,
      entityType: "roster_shift",
      kind: "roster.update",
      payload: {
        date: nextDate,
        employeeMembershipId: nextEmployeeMembershipId,
        endTime: nextEndTime,
        notes,
        originalEmployeeMembershipId: shift.employeeMembershipId,
        startTime: nextStartTime,
        timezone: nextTimezone,
        updatedAt: shift.updatedAt,
      },
      optimistic: (snapshot) => ({
        ...snapshot,
        roster: {
          ...snapshot.roster,
          shifts: snapshot.roster.shifts.map((item) =>
            item.id === shift.id
              ? {
                  ...item,
                  employeeMembershipId: nextEmployeeMembershipId,
                  endsAt,
                  notes,
                  startsAt,
                  updatedAt,
                }
              : item
          ),
        },
      }),
    })
    return {
      message: "Shift saved on this device.",
      ok: true,
      values: {
        employeeMembershipId: String(nextEmployeeMembershipId),
        endsAt,
        notes,
        startsAt,
        updatedAt,
      },
    }
  }
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    INITIAL_ACTION_STATE
  )
  const [employeeMembershipId, setEmployeeMembershipId] = useState(
    String(shift.employeeMembershipId)
  )
  const [date, setDate] = useState(
    localDateForInstant(shift.startsAt, timezone)
  )
  const [startTime, setStartTime] = useState(
    localTimeInputForInstant(shift.startsAt, timezone)
  )
  const [endTime, setEndTime] = useState(
    localTimeInputForInstant(shift.endsAt, timezone)
  )
  const employeeNames = useMemo(
    () =>
      new Map(
        employees.map((employee) => [
          employee.employeeMembershipId,
          employee.displayName,
        ])
      ),
    [employees]
  )

  useEffect(() => {
    if (
      !state.ok ||
      !state.values?.employeeMembershipId ||
      !state.values.endsAt ||
      !state.values.startsAt ||
      !state.values.updatedAt
    ) {
      return
    }
    toast.success(state.message)
    onSaved({
      ...shift,
      employeeMembershipId: Number(state.values.employeeMembershipId),
      endsAt: state.values.endsAt,
      notes: state.values.notes ?? "",
      startsAt: state.values.startsAt,
      updatedAt: state.values.updatedAt,
    })
  }, [onSaved, shift, state.message, state.ok, state.values])

  return (
    <>
      {mobile ? (
        <DrawerHeader>
          <DrawerTitle>Edit roster shift</DrawerTitle>
          <DrawerDescription>
            Change the worker, date, exact times, or shift instructions.
          </DrawerDescription>
        </DrawerHeader>
      ) : (
        <DialogHeader>
          <DialogTitle>Edit roster shift</DialogTitle>
          <DialogDescription>
            Change the worker, date, exact times, or shift instructions.
          </DialogDescription>
        </DialogHeader>
      )}
      <form
        action={formAction}
        className={`grid gap-4 ${mobile ? "p-4 pt-3" : ""}`}
      >
        <input name="timezone" type="hidden" value={timezone} />
        {state.message && !state.ok ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid min-w-0 gap-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="edit-shift-employee"
            >
              Employee
            </label>
            <input
              name="employeeMembershipId"
              type="hidden"
              value={employeeMembershipId}
            />
            <Select
              onValueChange={(value) => value && setEmployeeMembershipId(value)}
              value={employeeMembershipId}
            >
              <SelectTrigger className="w-full" id="edit-shift-employee">
                <SelectValue>
                  {employeeNames.get(Number(employeeMembershipId)) ??
                    "Choose employee"}
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
            <FieldErrors errors={state.errors?.employeeMembershipId} />
          </div>
          <div className="grid min-w-0 gap-1.5">
            <label className="text-sm font-medium" htmlFor="edit-shift-date">
              Date
            </label>
            <RosterDatePicker
              aria-invalid={Boolean(state.errors?.date)}
              id="edit-shift-date"
              name="date"
              onChange={setDate}
              value={date}
            />
            <FieldErrors errors={state.errors?.date} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="edit-shift-start">
              Start
            </label>
            <RosterTimePicker
              id="edit-shift-start"
              label="Start"
              name="startTime"
              onChange={(nextStart) => {
                const duration = clockTimeDurationMinutes(startTime, endTime)
                setStartTime(nextStart)
                if (duration !== null) {
                  setEndTime(addMinutesToClockTime(nextStart, duration))
                }
              }}
              value={startTime}
            />
            <FieldErrors errors={state.errors?.startTime} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="edit-shift-end">
              End
            </label>
            <RosterTimePicker
              id="edit-shift-end"
              label="End"
              name="endTime"
              onChange={setEndTime}
              value={endTime}
            />
            <FieldErrors errors={state.errors?.endTime} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          An end before the start is treated as the following day.
        </p>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="edit-shift-notes">
            Notes
          </label>
          <Textarea
            defaultValue={state.values?.notes ?? shift.notes}
            id="edit-shift-notes"
            maxLength={500}
            name="notes"
            rows={3}
          />
          <FieldErrors errors={state.errors?.notes} />
        </div>
        <div className="flex justify-end pt-1">
          <Button disabled={pending} type="submit">
            {pending ? "Saving…" : "Save shift"}
          </Button>
        </div>
      </form>
    </>
  )
}
