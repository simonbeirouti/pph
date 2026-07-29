"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { CalendarIcon, PencilIcon } from "lucide-react"

import { createJobAction, updateJobAction } from "@/app/dashboard/jobs/actions"
import {
  updateJobEverywhere,
  useOfflineV2Actions,
} from "@/components/offline-v2-actions"
import { FieldErrors } from "@/components/employee-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
  JobActionState,
  JobBoardEmployee,
  JobCard,
  JobRosterShiftOption,
} from "@/lib/jobs/types"
import { INITIAL_JOB_ACTION_STATE } from "@/lib/jobs/types"
import type { JobTemplateOption } from "@/lib/templates/types"
import {
  isoToLocalDateTime,
  localDateTimeToIso,
} from "@/lib/jobs/validation"

type JobFormAction = (
  state: JobActionState,
  formData: FormData
) => Promise<JobActionState>

export function JobCreateDialog({
  employees,
  onCreated,
  rosterShifts,
  templates,
  timezone,
}: {
  employees: readonly JobBoardEmployee[]
  onCreated: (job: JobCard) => void
  rosterShifts: readonly JobRosterShiftOption[]
  templates: readonly JobTemplateOption[]
  timezone: string
}) {
  const [open, setOpen] = useState(false)
  const offline = useOfflineV2Actions()
  const action: JobFormAction = async (_state, formData) => {
    if (!offline.isOffline) return createJobAction(_state, formData)
    const payload = formPayload(formData)
    const localId = crypto.randomUUID()
    const temporaryId = -Date.now()
    const now = new Date().toISOString()
    const job: JobCard = {
      assigneeMembershipId: positiveNumber(
        String(payload.assigneeMembershipId ?? "")
      ),
      description: String(payload.description ?? ""),
      dueAt: nullableLocalDateTime(payload.dueAt, timezone),
      id: temporaryId,
      location: String(payload.location ?? ""),
      minimumCompletionPhotos: Number(payload.minimumCompletionPhotos ?? 0),
      priority: String(payload.priority ?? "normal") as JobCard["priority"],
      requiresCompletionNote: Boolean(payload.requiresCompletionNote),
      scheduledAt: nullableLocalDateTime(payload.scheduledAt, timezone),
      status: "assigned",
      title: String(payload.title ?? ""),
      updatedAt: now,
    }
    await offline.queue({
      entityId: localId,
      entityType: "job",
      kind: "job.create",
      payload: { ...payload, temporaryId },
      optimistic: (snapshot) => ({
        ...snapshot,
        jobs: snapshot.jobs
          ? { ...snapshot.jobs, jobs: [job, ...snapshot.jobs.jobs] }
          : null,
      }),
    })
    return { job, message: "Job saved on this device.", ok: true }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Create job
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create job</DialogTitle>
            <DialogDescription>
              Add work to the board. Times use {timezone}.
            </DialogDescription>
          </DialogHeader>
          <JobForm
            action={action}
            employees={employees}
            idPrefix="create-job-"
            onSaved={(job) => {
              onCreated(job)
              setOpen(false)
            }}
            rosterShifts={rosterShifts}
            submitLabel="Create job"
            templates={templates}
            timezone={timezone}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

export function JobEditDialog({
  currentAssigneeName,
  employees,
  job,
  onUpdated,
  rosterShifts,
  timezone,
}: {
  currentAssigneeName?: string
  employees: readonly JobBoardEmployee[]
  job: JobCard
  onUpdated: (job: JobCard) => void
  rosterShifts: readonly JobRosterShiftOption[]
  timezone: string
}) {
  const [open, setOpen] = useState(false)
  const offline = useOfflineV2Actions()
  const action = useMemo<JobFormAction>(
    () => async (state, formData) => {
      if (!offline.isOffline) {
        return updateJobAction(job.id, state, formData)
      }
      const payload = formPayload(formData)
      const updated: JobCard = {
        ...job,
        assigneeMembershipId: positiveNumber(
          String(payload.assigneeMembershipId ?? "")
        ),
        description: String(payload.description ?? ""),
        dueAt: nullableLocalDateTime(payload.dueAt, timezone),
        location: String(payload.location ?? ""),
        minimumCompletionPhotos: Number(
          payload.minimumCompletionPhotos ?? 0
        ),
        priority: String(payload.priority ?? "normal") as JobCard["priority"],
        requiresCompletionNote: Boolean(payload.requiresCompletionNote),
        scheduledAt: nullableLocalDateTime(payload.scheduledAt, timezone),
        title: String(payload.title ?? ""),
        updatedAt: new Date().toISOString(),
      }
      await offline.queue({
        entityId: job.id,
        entityType: "job",
        expectedVersion: job.version ?? null,
        kind: "job.update",
        payload,
        optimistic: (snapshot) =>
          updateJobEverywhere(snapshot, job.id, () => updated),
      })
      return { job: updated, message: "Job saved on this device.", ok: true }
    },
    [job, offline, timezone]
  )

  return (
    <>
      <Button
        aria-label={`Edit ${job.title}`}
        className="absolute top-2 right-2 z-10"
        onClick={() => setOpen(true)}
        onPointerDown={(event) => event.stopPropagation()}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <PencilIcon className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit job</DialogTitle>
            <DialogDescription>
              Update job details and requirements. Times use {timezone}.
            </DialogDescription>
          </DialogHeader>
          <JobForm
            action={action}
            currentAssigneeName={currentAssigneeName}
            employees={employees}
            idPrefix={`edit-job-${job.id}-`}
            initialJob={job}
            onSaved={(updatedJob) => {
              onUpdated(updatedJob)
              setOpen(false)
            }}
            rosterShifts={rosterShifts}
            submitLabel="Save changes"
            timezone={timezone}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function formPayload(formData: FormData) {
  return {
    assigneeMembershipId: String(
      formData.get("assigneeMembershipId") ?? ""
    ),
    description: String(formData.get("description") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    location: String(formData.get("location") ?? ""),
    minimumCompletionPhotos: String(
      formData.get("minimumCompletionPhotos") ?? "0"
    ),
    priority: String(formData.get("priority") ?? "normal"),
    requiresCompletionNote: formData.has("requiresCompletionNote"),
    rosterShiftId: String(formData.get("rosterShiftId") ?? ""),
    scheduledAt: String(formData.get("scheduledAt") ?? ""),
    templateId: String(formData.get("templateId") ?? ""),
    title: String(formData.get("title") ?? ""),
  }
}

function positiveNumber(value: string) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function nullableLocalDateTime(value: unknown, timezone: string) {
  const local = String(value ?? "")
  return local ? localDateTimeToIso(local, timezone) : null
}

function JobForm({
  action,
  currentAssigneeName,
  employees,
  idPrefix,
  initialJob,
  onSaved,
  rosterShifts,
  submitLabel,
  templates = [],
  timezone,
}: {
  action: JobFormAction
  currentAssigneeName?: string
  employees: readonly JobBoardEmployee[]
  idPrefix: string
  initialJob?: JobCard
  onSaved: (job: JobCard) => void
  rosterShifts: readonly JobRosterShiftOption[]
  submitLabel: string
  templates?: readonly JobTemplateOption[]
  timezone: string
}) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_JOB_ACTION_STATE
  )
  const [scheduledAt, setScheduledAt] = useState(() =>
    isoToLocalDateTime(initialJob?.scheduledAt ?? null, timezone)
  )
  const [dueAt, setDueAt] = useState(() =>
    isoToLocalDateTime(initialJob?.dueAt ?? null, timezone)
  )
  const [priority, setPriority] = useState<JobCard["priority"]>(
    initialJob?.priority ?? "normal"
  )
  const [assigneeMembershipId, setAssigneeMembershipId] = useState(
    initialJob?.assigneeMembershipId
      ? String(initialJob.assigneeMembershipId)
      : "unassigned"
  )
  const [rosterShiftId, setRosterShiftId] = useState("none")
  const availableRosterShifts =
    assigneeMembershipId === "unassigned"
      ? []
      : rosterShifts.filter(
          (shift) => String(shift.employeeMembershipId) === assigneeMembershipId
        )
  const selectedAssigneeName =
    assigneeMembershipId === "unassigned"
      ? "Unassigned"
      : (employees.find(
          (employee) => String(employee.membershipId) === assigneeMembershipId
        )?.displayName ??
        currentAssigneeName ??
        "Former employee")
  const [requiresCompletionNote, setRequiresCompletionNote] = useState(
    initialJob?.requiresCompletionNote ?? false
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState("none")
  const selectedTemplate = templates.find(
    (template) => String(template.id) === selectedTemplateId
  )
  const defaultsKey = selectedTemplateId
  const handledJobId = useRef<number | null>(null)
  const fieldId = (name: string) => `${idPrefix}${name}`

  useEffect(() => {
    if (state.job && handledJobId.current !== state.job.id) {
      handledJobId.current = state.job.id
      onSaved(state.job)
    }
  }, [onSaved, state.job])

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.message && !state.ok ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        {templates.length ? (
          <Field>
            <FieldLabel htmlFor={fieldId("template")}>Template</FieldLabel>
            <Select
              name="templateId"
              onValueChange={(value) => {
                const next = value ?? "none"
                const template = templates.find(
                  (candidate) => String(candidate.id) === next
                )
                setSelectedTemplateId(next)
                if (template) {
                  setPriority(template.priority)
                  setAssigneeMembershipId(
                    template.assigneeMembershipId
                      ? String(template.assigneeMembershipId)
                      : "unassigned"
                  )
                  setRequiresCompletionNote(template.requiresCompletionNote)
                  setRosterShiftId("none")
                }
              }}
              value={selectedTemplateId}
            >
              <SelectTrigger className="w-full" id={fieldId("template")}>
                <SelectValue>
                  {selectedTemplate?.title ?? "Start without a template"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Start without a template</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={String(template.id)}>
                    {template.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Choosing a template fills its defaults; every field remains
              editable.
            </FieldDescription>
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor={fieldId("title")}>Title</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.title)}
            defaultValue={
              state.values?.title ??
              selectedTemplate?.title ??
              initialJob?.title
            }
            id={fieldId("title")}
            key={`title-${defaultsKey}-${state.values?.title ?? initialJob?.title ?? ""}`}
            name="title"
            required
          />
          <FieldErrors errors={state.errors?.title} />
        </Field>
        <Field>
          <FieldLabel htmlFor={fieldId("description")}>Description</FieldLabel>
          <Textarea
            aria-invalid={Boolean(state.errors?.description)}
            defaultValue={
              state.values?.description ??
              selectedTemplate?.description ??
              initialJob?.description
            }
            id={fieldId("description")}
            key={`description-${defaultsKey}-${state.values?.description ?? initialJob?.description ?? ""}`}
            name="description"
            rows={4}
          />
          <FieldErrors errors={state.errors?.description} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={fieldId("location")}>Location</FieldLabel>
            <Input
              aria-invalid={Boolean(state.errors?.location)}
              defaultValue={
                state.values?.location ??
                selectedTemplate?.location ??
                initialJob?.location
              }
              id={fieldId("location")}
              key={`location-${defaultsKey}-${state.values?.location ?? initialJob?.location ?? ""}`}
              name="location"
            />
            <FieldErrors errors={state.errors?.location} />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("priority")}>Priority</FieldLabel>
            <Select
              name="priority"
              onValueChange={(value) => {
                if (value) setPriority(value as JobCard["priority"])
              }}
              value={priority}
            >
              <SelectTrigger
                aria-invalid={Boolean(state.errors?.priority)}
                className="w-full"
                id={fieldId("priority")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <FieldErrors errors={state.errors?.priority} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={fieldId("assignee")}>Assignee</FieldLabel>
          <Select
            name="assigneeMembershipId"
            onValueChange={(value) => {
              if (rosterShiftId !== "none") {
                setDueAt("")
                setScheduledAt("")
              }
              setRosterShiftId("none")
              setAssigneeMembershipId(value ?? "unassigned")
            }}
            value={assigneeMembershipId}
          >
            <SelectTrigger
              aria-invalid={Boolean(state.errors?.assigneeMembershipId)}
              className="w-full"
              id={fieldId("assignee")}
            >
              <SelectValue>{selectedAssigneeName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {employees.map((employee) => (
                <SelectItem
                  key={employee.membershipId}
                  value={String(employee.membershipId)}
                >
                  {employee.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldErrors errors={state.errors?.assigneeMembershipId} />
        </Field>
        <Field>
          <FieldLabel htmlFor={fieldId("roster-shift")}>
            Rostered shift
          </FieldLabel>
          <Select
            disabled={assigneeMembershipId === "unassigned"}
            name="rosterShiftId"
            onValueChange={(value) => {
              const nextValue = value ?? "none"
              setRosterShiftId(nextValue)
              const shift = rosterShifts.find(
                (option) => String(option.id) === nextValue
              )
              if (shift) {
                setScheduledAt(isoToLocalDateTime(shift.startsAt, timezone))
                setDueAt(isoToLocalDateTime(shift.endsAt, timezone))
              }
            }}
            value={rosterShiftId}
          >
            <SelectTrigger
              aria-invalid={Boolean(state.errors?.rosterShiftId)}
              className="w-full"
              id={fieldId("roster-shift")}
            >
              <SelectValue>
                {rosterShiftId === "none"
                  ? assigneeMembershipId === "unassigned"
                    ? "Choose an assignee first"
                    : "No rostered shift"
                  : formatRosterShift(
                      availableRosterShifts.find(
                        (shift) => String(shift.id) === rosterShiftId
                      ),
                      timezone
                    )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No rostered shift</SelectItem>
              {availableRosterShifts.map((shift) => (
                <SelectItem key={shift.id} value={String(shift.id)}>
                  {formatRosterShift(shift, timezone)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            {assigneeMembershipId === "unassigned"
              ? "Select an employee to see their roster."
              : availableRosterShifts.length
                ? "Choosing a shift sets the job start and due time from the shift."
                : "This employee has no current or upcoming shifts."}
          </FieldDescription>
          <FieldErrors errors={state.errors?.rosterShiftId} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimePicker
            error={state.errors?.scheduledAt}
            id={fieldId("scheduled-at")}
            label="Scheduled"
            name="scheduledAt"
            onChange={(value) => {
              setRosterShiftId("none")
              setScheduledAt(value)
            }}
            value={scheduledAt}
          />
          <DateTimePicker
            error={state.errors?.dueAt}
            id={fieldId("due-at")}
            label="Due"
            name="dueAt"
            onChange={(value) => {
              setRosterShiftId("none")
              setDueAt(value)
            }}
            value={dueAt}
          />
        </div>
        <Field>
          <FieldLabel htmlFor={fieldId("minimum-photos")}>
            Minimum completion photos
          </FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.minimumCompletionPhotos)}
            defaultValue={
              state.values?.minimumCompletionPhotos ??
              selectedTemplate?.minimumCompletionPhotos ??
              initialJob?.minimumCompletionPhotos ??
              "0"
            }
            id={fieldId("minimum-photos")}
            key={`photos-${defaultsKey}-${state.values?.minimumCompletionPhotos ?? initialJob?.minimumCompletionPhotos ?? "0"}`}
            max={10}
            min={0}
            name="minimumCompletionPhotos"
            type="number"
          />
          <FieldErrors errors={state.errors?.minimumCompletionPhotos} />
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            checked={requiresCompletionNote}
            id={fieldId("requires-note")}
            name="requiresCompletionNote"
            onCheckedChange={setRequiresCompletionNote}
            value="true"
          />
          <div>
            <FieldLabel htmlFor={fieldId("requires-note")}>
              Require a completion note
            </FieldLabel>
            <FieldDescription>
              Employees must add a note before submitting in S05.
            </FieldDescription>
          </div>
        </Field>
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : submitLabel}
        </Button>
      </FieldGroup>
    </form>
  )
}

function DateTimePicker({
  error,
  id,
  label,
  name,
  onChange,
  value,
}: {
  error: string[] | undefined
  id: string
  label: string
  name: string
  onChange: (value: string) => void
  value: string
}) {
  const [datePart = "", timePart = ""] = value.split("T")
  const selected = parseDatePart(datePart)

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input name={name} type="hidden" value={value} />
      <Popover>
        <PopoverTrigger
          render={
            <Button
              aria-invalid={Boolean(error)}
              className="w-full justify-start font-normal"
              id={id}
              type="button"
              variant="outline"
            />
          }
        >
          <CalendarIcon className="size-4" />
          {value ? formatLocalDateTime(value) : "Choose date and time"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto">
          <Calendar
            mode="single"
            onSelect={(date) => {
              if (!date) return
              onChange(`${formatDatePart(date)}T${timePart || "09:00"}`)
            }}
            selected={selected}
          />
          <div className="grid gap-2 border-t pt-2">
            <FieldLabel htmlFor={`${id}-time`}>{label} time</FieldLabel>
            <Input
              disabled={!datePart}
              id={`${id}-time`}
              onChange={(event) => {
                if (!datePart) return
                onChange(`${datePart}T${event.currentTarget.value}`)
              }}
              type="time"
              value={timePart}
            />
            {value ? (
              <Button
                onClick={() => onChange("")}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear {label.toLocaleLowerCase()}
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <FieldErrors errors={error} />
    </Field>
  )
}

function parseDatePart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function formatDatePart(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatLocalDateTime(value: string) {
  const [datePart, timePart] = value.split("T")
  const date = parseDatePart(datePart)
  if (!date) return "Choose date and time"

  return `${new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)} at ${timePart}`
}

function formatRosterShift(
  shift: JobRosterShiftOption | undefined,
  timezone: string
) {
  if (!shift) return "No rostered shift"
  const start = new Date(shift.startsAt)
  const end = new Date(shift.endsAt)
  const date = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: timezone,
    weekday: "short",
  }).format(start)
  const time = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  })
  return `${date} · ${time.format(start)}–${time.format(end)}`
}
