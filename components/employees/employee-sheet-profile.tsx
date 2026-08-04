"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { CameraIcon, MailIcon, PhoneIcon } from "lucide-react"

import { EmployeeProfileFields, FieldErrors } from "@/components/employees/employee-form"
import { EmployeeAvatar } from "@/components/employees/employee-avatar"
import { EmployeeRosterShiftManager } from "@/components/roster/employee-roster-shift-manager"
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
import type { EmployeeSummary } from "@/lib/employees/data"
import type { EmployeeJobSummary } from "@/lib/jobs/types"
import type { EmployeeShiftSummary as EmployeeShiftSummaryModel } from "@/lib/roster/types"
import {
  INITIAL_ACTION_STATE,
  type ActionState,
} from "@/lib/forms/action-state"

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
  const formRef = useRef<HTMLFormElement>(null)
  const submitProfile = useCallback(async () => {
    const result = formRef.current
      ? await action(INITIAL_ACTION_STATE, new FormData(formRef.current))
      : { message: "The employee form is unavailable.", ok: false }
    setState(result)
    if (result.ok && avatarInputRef.current) {
      avatarInputRef.current.value = ""
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
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
      return file ? URL.createObjectURL(file) : null
    })
  }

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
        <div className="grid w-full grid-cols-2 gap-2 pt-3">
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
        {roleActions}
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <FieldGroup>
          <FieldErrors errors={state.errors?.avatar} />
          <div className="grid gap-1">
            <h3 className="font-medium">Work summary</h3>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-2xl font-semibold">
                  {jobSummary.active.length}
                </p>
                <p className="text-xs text-muted-foreground">Active jobs</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-2xl font-semibold">
                  {jobSummary.archived.length}
                </p>
                <p className="text-xs text-muted-foreground">Recent archived</p>
              </div>
            </div>
            {jobSummary.active.length ? (
              <div className="mt-2 grid gap-2">
                {jobSummary.active.map((job) => (
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
            <div className="pt-3">
              <EmployeeRosterShiftManager
                canManage={
                  canEdit &&
                  employee.role !== "owner" &&
                  employee.status === "active"
                }
                employeeMembershipId={employee.membershipId}
                employeeName={employee.displayName}
                summary={shiftSummary}
                timezone={timezone}
              />
            </div>
          </div>
          {canEdit ? (
            <div className="grid gap-3 border-t pt-5">
              <div>
                <h3 className="font-medium">Edit profile</h3>
                <FieldDescription>
                  Update the employee’s name or phone number.
                </FieldDescription>
              </div>
              <div className="grid gap-4" onChange={markProfileDirty}>
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
