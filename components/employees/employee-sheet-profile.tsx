"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowRightIcon, CameraIcon, MailIcon, PhoneIcon } from "lucide-react"

import { EmployeeAvatar } from "@/components/employees/employee-avatar"
import {
  EmployeeProfileFields,
  FieldErrors,
} from "@/components/employees/employee-form"
import { useEmployeeEdit } from "@/components/employees/membership-role-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatShortWeekdayZonedDate } from "@/lib/date-format"
import type { EmployeeSummary } from "@/lib/employees/data"
import {
  INITIAL_ACTION_STATE,
  type ActionState,
} from "@/lib/forms/action-state"
import type { EmployeeJobSummary } from "@/lib/jobs/types"
import {
  formatDuration,
  formatLocalTime,
  shiftDurationMinutes,
} from "@/lib/roster/time"
import type { EmployeeShiftSummary as EmployeeShiftSummaryModel } from "@/lib/roster/types"

const MAX_SUMMARY_ITEMS = 3

function jobScheduleTime(job: EmployeeJobSummary["active"][number]) {
  const timestamp = Date.parse(job.dueAt ?? job.scheduledAt ?? "")
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER
}

type EmployeeFormAction = (
  state: ActionState,
  formData: FormData
) => Promise<ActionState>

export function EmployeeSheetProfile({
  action,
  canEdit,
  employee,
  jobSummary,
  roleActions,
  shiftSummary,
  timezone,
}: {
  action: EmployeeFormAction
  canEdit: boolean
  employee: EmployeeSummary
  jobSummary: EmployeeJobSummary
  roleActions?: ReactNode
  shiftSummary: EmployeeShiftSummaryModel
  timezone: string
}) {
  const { markProfileDirty, registerProfileSave, saveChanges } =
    useEmployeeEdit()
  const [state, setState] = useState<ActionState>(INITIAL_ACTION_STATE)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const selectedAvatarRef = useRef<File | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const submitProfile = useCallback(async () => {
    const formData = formRef.current ? new FormData(formRef.current) : null
    if (formData && selectedAvatarRef.current) {
      formData.set("avatar", selectedAvatarRef.current)
    }
    const result = formData
      ? await action(INITIAL_ACTION_STATE, formData)
      : { message: "The employee form is unavailable.", ok: false }
    setState(result)
    if (result.ok && avatarInputRef.current) {
      avatarInputRef.current.value = ""
      selectedAvatarRef.current = null
    }
    return result
  }, [action])

  useEffect(() => {
    registerProfileSave(submitProfile)
    return () => registerProfileSave(null)
  }, [registerProfileSave, submitProfile])

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl]
  )

  const selectAvatar = () => avatarInputRef.current?.click()
  const updateAvatarPreview = (file: File | undefined) => {
    markProfileDirty()
    selectedAvatarRef.current = file ?? null
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
      return file ? URL.createObjectURL(file) : null
    })
  }
  const visibleJobs = [...jobSummary.active]
    .sort((left, right) => jobScheduleTime(left) - jobScheduleTime(right))
    .slice(0, MAX_SUMMARY_ITEMS)
  const visibleShifts = [
    ...(shiftSummary.current ? [shiftSummary.current] : []),
    ...[...shiftSummary.upcoming].sort(
      (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt)
    ),
  ].slice(0, MAX_SUMMARY_ITEMS)

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        saveChanges()
      }}
      ref={formRef}
    >
      <SheetHeader className="shrink-0 items-center border-b px-6 pb-5 text-center">
        <button
          aria-label={`Change ${employee.displayName} profile photo`}
          className="group relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={selectAvatar}
          type="button"
        >
          <EmployeeAvatar
            className="size-32"
            name={employee.displayName}
            url={previewUrl ?? employee.avatarUrl}
          />
          <span className="absolute right-0 bottom-0 grid size-10 place-items-center rounded-full border bg-popover shadow-sm transition-colors group-hover:bg-muted">
            <CameraIcon className="size-5" />
          </span>
        </button>
        <Input
          accept="image/jpeg,image/png,image/webp"
          aria-invalid={Boolean(state.errors?.avatar)}
          className="sr-only"
          id={`sheet-avatar-${employee.membershipId}`}
          name="avatar"
          onChange={(event) => updateAvatarPreview(event.target.files?.[0])}
          ref={avatarInputRef}
          tabIndex={-1}
          type="file"
        />
        <SheetTitle className="mt-2 text-xl">{employee.displayName}</SheetTitle>
        <SheetDescription className="sr-only">
          Employee profile and work details.
        </SheetDescription>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Badge className="capitalize" variant="secondary">
            {employee.status === "invited" ? "Invite pending" : employee.status}
          </Badge>
          <Badge className="capitalize" variant="outline">
            {employee.role}
          </Badge>
        </div>
        <div className="grid w-full max-w-3xl grid-cols-2 gap-2 pt-3">
          <Button
            nativeButton={false}
            render={<a href={`mailto:${employee.email}`} />}
            variant="outline"
          >
            <MailIcon />
            Email
          </Button>
          <Button
            nativeButton={false}
            render={
              <a href={`tel:${employee.phone.replace(/[^\d+*#,;]/g, "")}`} />
            }
            variant="outline"
          >
            <PhoneIcon />
            Call
          </Button>
        </div>
        {roleActions ? (
          <div className="w-full max-w-3xl">{roleActions}</div>
        ) : null}
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <FieldGroup>
          <FieldErrors errors={state.errors?.avatar} />
          <div
            className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,28rem),1fr))] gap-5"
            data-employee-work-layout
          >
            <div className="grid content-start gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">Work summary</h3>
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={`/dashboard/jobs?employee=${employee.membershipId}`}
                      prefetch={false}
                    />
                  }
                  size="sm"
                  variant="outline"
                >
                  View jobs
                  <ArrowRightIcon />
                </Button>
              </div>
              {visibleJobs.length ? (
                <div className="grid gap-2" data-employee-summary="jobs">
                  {visibleJobs.map((job) => (
                    <div className="rounded-md border p-2.5" key={job.id}>
                      <p className="text-sm font-medium">{job.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {job.priority} · {job.status.replace("_", " ")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pt-2 text-sm text-muted-foreground">
                  No active jobs assigned.
                </p>
              )}
            </div>
            <div className="grid content-start gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">Shifts</h3>
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={`/dashboard/roster?employee=${employee.membershipId}`}
                      prefetch={false}
                    />
                  }
                  size="sm"
                  variant="outline"
                >
                  View shifts
                  <ArrowRightIcon />
                </Button>
              </div>
              {visibleShifts.length ? (
                <div className="grid gap-2" data-employee-summary="shifts">
                  {visibleShifts.map((shift) => (
                    <div className="rounded-md border p-3" key={shift.id}>
                      <p className="truncate text-sm font-medium">
                        {formatShortWeekdayZonedDate(shift.startsAt, timezone)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatLocalTime(shift.startsAt, timezone)}–
                        {formatLocalTime(shift.endsAt, timezone)} ·{" "}
                        {formatDuration(shiftDurationMinutes(shift))}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No current or upcoming shifts.
                </p>
              )}
            </div>
          </div>
          {canEdit ? (
            <div className="grid max-w-3xl gap-3 border-t pt-5">
              <div>
                <h3 className="font-medium">Edit profile</h3>
                <FieldDescription>
                  Update the employee’s name or phone number.
                </FieldDescription>
              </div>
              <div
                className="grid gap-4 sm:grid-cols-3 [&>div]:contents"
                data-employee-profile-fields
                onChange={markProfileDirty}
              >
                <EmployeeProfileFields
                  employee={employee}
                  idPrefix={`sheet-${employee.membershipId}-`}
                  includeAvatar={false}
                  includeEmail={false}
                  includeJobTitle={false}
                  state={state}
                />
              </div>
            </div>
          ) : null}
        </FieldGroup>
      </div>
    </form>
  )
}
