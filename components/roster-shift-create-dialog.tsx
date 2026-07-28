"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { createCalendarRosterShiftAction } from "@/app/dashboard/roster/actions"
import { FieldErrors } from "@/components/employee-form"
import { RosterDatePicker } from "@/components/roster-date-picker"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  INITIAL_ACTION_STATE,
  type ActionState,
} from "@/lib/forms/action-state"
import {
  addMinutesToClockTime,
  clockTimeDurationMinutes,
} from "@/lib/roster/time"
import { useIsMobile } from "@/hooks/use-mobile"
import type {
  RosterAssignableJob,
  RosterShiftDraft,
} from "@/lib/roster/types"
import type { ActiveEmployeeOption } from "@/lib/employees/data"

export function RosterShiftCreateDialog({
  draft,
  employees,
  jobs,
  onOpenChange,
  timezone,
}: {
  draft: RosterShiftDraft | null
  employees: ActiveEmployeeOption[]
  jobs: RosterAssignableJob[]
  onOpenChange: (open: boolean) => void
  timezone: string
}) {
  const mobile = useIsMobile()
  const form = draft ? (
    <RosterShiftCreateForm
      draft={draft}
      employees={employees}
      jobs={jobs}
      key={`${draft.date}-${draft.employeeMembershipId}-${draft.startTime}-${draft.endTime}`}
      mobile={mobile}
      onSaved={() => onOpenChange(false)}
      timezone={timezone}
    />
  ) : null

  if (mobile) {
    return (
      <Drawer
        open={Boolean(draft)}
        onOpenChange={onOpenChange}
        showSwipeHandle
      >
        <DrawerContent className="[--drawer-content-max-height:calc(100dvh-1rem)]">
          {form}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={Boolean(draft)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92svh,48rem)] overflow-y-auto sm:max-w-xl">
        {form}
      </DialogContent>
    </Dialog>
  )
}

function RosterShiftCreateForm({
  draft,
  employees,
  jobs,
  mobile,
  onSaved,
  timezone,
}: {
  draft: RosterShiftDraft
  employees: ActiveEmployeeOption[]
  jobs: RosterAssignableJob[]
  mobile: boolean
  onSaved: () => void
  timezone: string
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCalendarRosterShiftAction,
    INITIAL_ACTION_STATE
  )
  const [date, setDate] = useState(draft.date)
  const [employeeMembershipId, setEmployeeMembershipId] = useState(
    draft.employeeMembershipId ? String(draft.employeeMembershipId) : ""
  )
  const [startTime, setStartTime] = useState(draft.startTime)
  const [endTime, setEndTime] = useState(draft.endTime)
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(
    () => new Set()
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
    if (!state.ok) return
    toast.success(state.message)
    router.refresh()
    onSaved()
  }, [onSaved, router, state.message, state.ok])

  const changeStartTime = (nextStart: string) => {
    const duration = clockTimeDurationMinutes(startTime, endTime)
    setStartTime(nextStart)
    if (duration !== null) {
      setEndTime(addMinutesToClockTime(nextStart, duration))
    }
  }

  return (
    <>
      {mobile ? (
        <DrawerHeader>
          <DrawerTitle>Add roster shift</DrawerTitle>
          <DrawerDescription>
            Confirm the exact shift and optionally assign not-started jobs.
          </DrawerDescription>
        </DrawerHeader>
      ) : (
        <DialogHeader>
          <DialogTitle>Add roster shift</DialogTitle>
          <DialogDescription>
            Confirm the exact shift and optionally assign not-started jobs.
          </DialogDescription>
        </DialogHeader>
      )}
      <form
        action={formAction}
        className={`grid gap-4 ${mobile ? "p-4 pt-3" : ""}`}
      >
        <input name="timezone" type="hidden" value={timezone} />
        {[...selectedJobs].map((jobId) => (
          <input key={jobId} name="jobIds" type="hidden" value={jobId} />
        ))}
        {state.message && !state.ok ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="calendar-shift-date">
            Date
          </label>
          <RosterDatePicker
            aria-invalid={Boolean(state.errors?.date)}
            id="calendar-shift-date"
            name="date"
            onChange={setDate}
            value={date}
          />
          <FieldErrors errors={state.errors?.date} />
        </div>
        <div className="grid gap-1.5">
          <label
            className="text-sm font-medium"
            htmlFor="calendar-shift-employee"
          >
            Employee
          </label>
          <input
            name="employeeMembershipId"
            type="hidden"
            value={employeeMembershipId}
          />
          <Select
            onValueChange={(value) =>
              value && setEmployeeMembershipId(value)
            }
            value={employeeMembershipId || null}
          >
            <SelectTrigger
              aria-invalid={Boolean(state.errors?.employeeMembershipId)}
              id="calendar-shift-employee"
            >
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
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="calendar-shift-start"
            >
              Start
            </label>
            <Input
              aria-invalid={Boolean(state.errors?.startTime)}
              id="calendar-shift-start"
              name="startTime"
              onChange={(event) => changeStartTime(event.target.value)}
              required
              step={60}
              type="time"
              value={startTime}
            />
            <FieldErrors errors={state.errors?.startTime} />
          </div>
          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="calendar-shift-end"
            >
              End
            </label>
            <Input
              aria-invalid={Boolean(state.errors?.endTime)}
              id="calendar-shift-end"
              name="endTime"
              onChange={(event) => setEndTime(event.target.value)}
              required
              step={60}
              type="time"
              value={endTime}
            />
            <FieldErrors errors={state.errors?.endTime} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          An end time before the start time is treated as the following day.
        </p>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="calendar-shift-notes">
            Notes
          </label>
          <Textarea
            aria-invalid={Boolean(state.errors?.notes)}
            defaultValue={state.values?.notes ?? draft.notes ?? ""}
            id="calendar-shift-notes"
            maxLength={500}
            name="notes"
            placeholder="Optional shift instructions"
            rows={2}
          />
          <FieldErrors errors={state.errors?.notes} />
        </div>
        <fieldset className="grid min-h-0 gap-2">
          <legend className="text-sm font-medium">Assign jobs</legend>
          <p className="text-xs text-muted-foreground">
            Selected jobs will be assigned to this employee, scheduled at the
            shift start, and due at the shift end.
          </p>
          {jobs.length ? (
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border p-2">
              {jobs.map((job) => {
                const checked = selectedJobs.has(job.id)
                const assignee = job.assigneeMembershipId
                  ? (employeeNames.get(job.assigneeMembershipId) ??
                    "Former employee")
                  : "Unassigned"
                return (
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted"
                    key={job.id}
                  >
                    <Checkbox
                      aria-label={`Assign ${job.title}`}
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        setSelectedJobs((current) => {
                          const next = new Set(current)
                          if (nextChecked) next.add(job.id)
                          else next.delete(job.id)
                          return next
                        })
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {job.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {assignee}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No not-started jobs are available.
            </p>
          )}
          <FieldErrors errors={state.errors?.jobIds} />
        </fieldset>
        <div className="flex justify-end pt-1">
          <Button disabled={pending} type="submit">
            {pending ? "Creating…" : "Create shift"}
          </Button>
        </div>
      </form>
    </>
  )
}
