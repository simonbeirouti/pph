"use client"

import { useRouter } from "next/navigation"
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import {
  CalendarClockIcon,
  FileStackIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  deleteScheduleAction,
  retryScheduleAction,
  saveScheduleAction,
  saveTemplateAction,
  setScheduleEnabledAction,
  setTemplateActiveAction,
} from "@/app/dashboard/templates/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatMediumZonedDateTime } from "@/lib/date-format"
import {
  INITIAL_TEMPLATE_ACTION_STATE,
  type JobSchedule,
  type JobTemplate,
  type TemplateEmployee,
} from "@/lib/templates/types"

const WEEKDAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [7, "Sun"],
] as const

const PRIORITY_OPTIONS = [
  { label: "Low", value: "low" },
  { label: "Normal", value: "normal" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
] as const

const RECURRENCE_OPTIONS = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
] as const

export function TemplateScheduleWorkspace({
  employees,
  initialView,
  schedules,
  templates,
  timezone,
}: {
  employees: readonly TemplateEmployee[]
  initialView: "templates" | "schedules"
  schedules: readonly JobSchedule[]
  templates: readonly JobTemplate[]
  timezone: string
}) {
  const router = useRouter()
  const [templateDialog, setTemplateDialog] = useState<
    JobTemplate | "new" | null
  >(null)
  const [scheduleDialog, setScheduleDialog] = useState<
    JobSchedule | "new" | null
  >(null)
  const templateById = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates]
  )
  const activeTemplates = templates.filter((template) => template.isActive)
  const orderedTemplates = useMemo(
    () =>
      [...templates].sort(
        (left, right) => Number(right.isActive) - Number(left.isActive)
      ),
    [templates]
  )
  const mobile = useIsMobile()

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Templates & schedules
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Standardise jobs and generate recurring work in {timezone}.
          </p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <Tabs
            className="min-w-0 flex-1 sm:w-auto sm:flex-none"
            onValueChange={(value) =>
              router.push(
                `/dashboard/templates?view=${
                  value === "schedules" ? "schedules" : "templates"
                }`
              )
            }
            value={initialView}
          >
            <TabsList
              aria-label="Template workspace"
              className="grid w-full grid-cols-2 sm:inline-flex sm:w-fit"
            >
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="schedules">Schedules</TabsTrigger>
            </TabsList>
          </Tabs>
          {initialView === "templates" ? (
            <Button onClick={() => setTemplateDialog("new")}>
              <PlusIcon /> New template
            </Button>
          ) : (
            <Button
              disabled={!activeTemplates.length || !employees.length}
              onClick={() => setScheduleDialog("new")}
            >
              <PlusIcon /> New schedule
            </Button>
          )}
        </div>
      </div>

      {initialView === "templates" ? (
        templates.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orderedTemplates.map((template) => (
              <TemplateCard
                employee={employees.find(
                  (employee) =>
                    employee.membershipId === template.assigneeMembershipId
                )}
                key={template.id}
                onEdit={() => setTemplateDialog(template)}
                template={template}
              />
            ))}
          </div>
        ) : (
          <WorkspaceEmpty
            action="Create template"
            description="Save common job details once, then reuse them for manual and scheduled work."
            icon={<FileStackIcon />}
            onAction={() => setTemplateDialog("new")}
            title="No job templates yet"
          />
        )
      ) : schedules.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {schedules.map((schedule) => (
            <ScheduleCard
              employee={employees.find(
                (employee) =>
                  employee.membershipId === schedule.assigneeMembershipId
              )}
              key={schedule.id}
              onEdit={() => setScheduleDialog(schedule)}
              schedule={schedule}
              template={templateById.get(schedule.templateId)}
              timezone={timezone}
            />
          ))}
        </div>
      ) : (
        <WorkspaceEmpty
          action="Create schedule"
          description={
            activeTemplates.length
              ? "Generate daily or weekly jobs from an active template."
              : "Create and activate a template before adding a schedule."
          }
          disabled={!activeTemplates.length || !employees.length}
          icon={<CalendarClockIcon />}
          onAction={() => setScheduleDialog("new")}
          title="No schedules yet"
        />
      )}

      <ResponsiveWorkspaceDialog
        description="These defaults can be overridden on each job. Existing jobs never change."
        mobile={mobile}
        open={templateDialog !== null}
        onOpenChange={(open) => !open && setTemplateDialog(null)}
        title={templateDialog === "new" ? "New template" : "Edit template"}
      >
        {templateDialog ? (
          <TemplateForm
            employees={employees}
            onSaved={() => setTemplateDialog(null)}
            template={templateDialog === "new" ? undefined : templateDialog}
          />
        ) : null}
      </ResponsiveWorkspaceDialog>

      <ResponsiveWorkspaceDialog
        description="Changes affect future occurrences only. Past jobs and audit history stay intact."
        mobile={mobile}
        open={scheduleDialog !== null}
        onOpenChange={(open) => !open && setScheduleDialog(null)}
        title={scheduleDialog === "new" ? "New schedule" : "Edit schedule"}
      >
        {scheduleDialog ? (
          <ScheduleForm
            employees={employees}
            onSaved={() => setScheduleDialog(null)}
            schedule={scheduleDialog === "new" ? undefined : scheduleDialog}
            templates={
              scheduleDialog === "new"
                ? activeTemplates
                : templates.filter(
                    (template) =>
                      template.isActive ||
                      template.id === scheduleDialog.templateId
                  )
            }
          />
        ) : null}
      </ResponsiveWorkspaceDialog>
    </div>
  )
}

function TemplateCard({
  employee,
  onEdit,
  template,
}: {
  employee?: TemplateEmployee
  onEdit: () => void
  template: JobTemplate
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Card className={!template.isActive ? "opacity-70" : undefined}>
      <CardHeader>
        <CardTitle>{template.title}</CardTitle>
        <CardDescription>
          {template.location || "No default location"}
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={`Template actions for ${template.title}`}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <PencilIcon /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await setTemplateActiveAction(
                        template.id,
                        !template.isActive
                      )
                      router.refresh()
                    } catch {
                      toast.error("Unable to update the template")
                    }
                  })
                }
              >
                {template.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <Badge
          className="w-fit"
          variant={template.isActive ? "default" : "secondary"}
        >
          {template.isActive ? "Active" : "Inactive"}
        </Badge>
        <p className="line-clamp-2 text-muted-foreground">
          {template.description || "No default description"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="capitalize">
            {template.priority}
          </Badge>
          <Badge variant="outline">
            {template.minimumCompletionPhotos} photos
          </Badge>
          {template.requiresCompletionNote ? (
            <Badge variant="outline">Note required</Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground">
          Default assignee: {employee?.displayName ?? "Unassigned"}
        </p>
      </CardContent>
    </Card>
  )
}

function ResponsiveWorkspaceDialog({
  children,
  description,
  mobile,
  onOpenChange,
  open,
  title,
}: {
  children: ReactNode
  description: string
  mobile: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}) {
  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent className="[--drawer-content-max-height:calc(100dvh-1rem)]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="p-4">{children}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function FormSelect({
  id,
  initialValue,
  name,
  onValueChange,
  options,
  required,
}: {
  id: string
  initialValue: string
  name: string
  onValueChange?: (value: string) => void
  options: ReadonlyArray<{ label: string; value: string }>
  required?: boolean
}) {
  const [value, setValue] = useState(initialValue)
  const label =
    options.find((option) => option.value === value)?.label ?? "Select"

  return (
    <Select
      name={name}
      onValueChange={(nextValue) => {
        if (nextValue === null) return
        setValue(nextValue)
        onValueChange?.(nextValue)
      }}
      required={required}
      value={value}
    >
      <SelectTrigger className="w-full" id={id}>
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ScheduleCard({
  employee,
  onEdit,
  schedule,
  template,
  timezone,
}: {
  employee?: TemplateEmployee
  onEdit: () => void
  schedule: JobSchedule
  template?: JobTemplate
  timezone: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const failed = schedule.occurrences.filter(
    (occurrence) => occurrence.status === "failed"
  )
  const run = async (action: () => Promise<void>, success: string) => {
    try {
      await action()
      toast.success(success)
      router.refresh()
    } catch {
      toast.error("The schedule could not be updated")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{template?.title ?? "Unavailable template"}</CardTitle>
        <CardDescription>
          {describeRecurrence(schedule)} ·{" "}
          {employee?.displayName ?? "Unavailable employee"}
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="Schedule actions"
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <PencilIcon /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={pending}
                onClick={() =>
                  startTransition(() =>
                    run(
                      () =>
                        setScheduleEnabledAction(
                          schedule.id,
                          !schedule.isEnabled
                        ),
                      schedule.isEnabled
                        ? "Schedule paused"
                        : "Schedule resumed"
                    )
                  )
                }
              >
                <PlayIcon /> {schedule.isEnabled ? "Pause" : "Resume"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                disabled={pending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Delete this schedule? Generated jobs and history will be kept."
                    )
                  )
                    return
                  startTransition(() =>
                    run(
                      () => deleteScheduleAction(schedule.id),
                      "Schedule deleted"
                    )
                  )
                }}
              >
                <Trash2Icon /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-2">
          {failed.length ? <Badge variant="destructive">Error</Badge> : null}
          <Badge variant={schedule.isEnabled ? "default" : "secondary"}>
            {schedule.isEnabled ? "Active" : "Paused"}
          </Badge>
        </div>
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <span className="text-muted-foreground">Next run: </span>
          {schedule.nextOccurrenceAt
            ? formatInstant(schedule.nextOccurrenceAt, timezone)
            : schedule.isEnabled
              ? "No future occurrence"
              : "Paused"}
        </div>
        {schedule.occurrences.length ? (
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">Recent occurrences</h3>
            {schedule.occurrences.slice(0, 5).map((occurrence) => (
              <div
                className="flex items-start justify-between gap-3 rounded-md border p-2 text-xs"
                key={occurrence.id}
              >
                <div>
                  <p>{formatInstant(occurrence.occurrenceAt, timezone)}</p>
                  {occurrence.lastError ? (
                    <p className="mt-1 text-destructive">
                      {occurrence.lastError}
                    </p>
                  ) : null}
                </div>
                <Badge
                  variant={
                    occurrence.status === "failed" ? "destructive" : "outline"
                  }
                >
                  {occurrence.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No occurrences generated yet.
          </p>
        )}
        {failed.length && schedule.isEnabled ? (
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(() =>
                run(() => retryScheduleAction(schedule.id), "Retry requested")
              )
            }
            size="sm"
            variant="outline"
          >
            <RotateCcwIcon /> Retry now
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function TemplateForm({
  employees,
  onSaved,
  template,
}: {
  employees: readonly TemplateEmployee[]
  onSaved: () => void
  template?: JobTemplate
}) {
  const action = useMemo(
    () => saveTemplateAction.bind(null, template?.id ?? null),
    [template?.id]
  )
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_TEMPLATE_ACTION_STATE
  )
  useEffect(() => {
    if (state.ok) onSaved()
  }, [onSaved, state.ok])
  return (
    <form action={formAction}>
      <FieldGroup>
        {state.message ? (
          <p className={state.ok ? "text-sm" : "text-sm text-destructive"}>
            {state.message}
          </p>
        ) : null}
        <Field>
          <FieldLabel htmlFor="template-title">Title</FieldLabel>
          <Input
            id="template-title"
            defaultValue={template?.title}
            name="title"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="template-description">Description</FieldLabel>
          <Textarea
            defaultValue={template?.description}
            id="template-description"
            name="description"
            rows={4}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="template-location">Location</FieldLabel>
          <Input
            id="template-location"
            defaultValue={template?.location}
            name="location"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="template-priority">Priority</FieldLabel>
            <FormSelect
              id="template-priority"
              initialValue={template?.priority ?? "normal"}
              name="priority"
              options={PRIORITY_OPTIONS}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="template-assignee">
              Default assignee
            </FieldLabel>
            <FormSelect
              id="template-assignee"
              initialValue={String(template?.assigneeMembershipId ?? "none")}
              name="assigneeMembershipId"
              options={[
                { label: "Unassigned", value: "none" },
                ...employees.map((employee) => ({
                  label: employee.displayName,
                  value: String(employee.membershipId),
                })),
              ]}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="template-minimum-photos">
            Minimum completion photos
          </FieldLabel>
          <Input
            defaultValue={template?.minimumCompletionPhotos ?? 0}
            id="template-minimum-photos"
            max={10}
            min={0}
            name="minimumCompletionPhotos"
            type="number"
          />
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            defaultChecked={template?.requiresCompletionNote}
            id="template-requires-note"
            name="requiresCompletionNote"
            value="true"
          />
          <FieldLabel htmlFor="template-requires-note">
            Require a completion note
          </FieldLabel>
        </Field>
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Save template"}
        </Button>
      </FieldGroup>
    </form>
  )
}

function ScheduleForm({
  employees,
  onSaved,
  schedule,
  templates,
}: {
  employees: readonly TemplateEmployee[]
  onSaved: () => void
  schedule?: JobSchedule
  templates: readonly JobTemplate[]
}) {
  const action = useMemo(
    () => saveScheduleAction.bind(null, schedule?.id ?? null),
    [schedule?.id]
  )
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_TEMPLATE_ACTION_STATE
  )
  const [recurrence, setRecurrence] = useState(
    schedule?.recurrenceType ?? "daily"
  )
  useEffect(() => {
    if (state.ok) onSaved()
  }, [onSaved, state.ok])
  return (
    <form action={formAction}>
      <FieldGroup>
        {state.message ? (
          <p className={state.ok ? "text-sm" : "text-sm text-destructive"}>
            {state.message}
          </p>
        ) : null}
        <Field>
          <FieldLabel htmlFor="schedule-template">Template</FieldLabel>
          <FormSelect
            id="schedule-template"
            initialValue={String(schedule?.templateId ?? templates[0]?.id)}
            name="templateId"
            options={templates.map((template) => ({
              label: `${template.title}${template.isActive ? "" : " (Inactive)"}`,
              value: String(template.id),
            }))}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="schedule-assignee">Assignee</FieldLabel>
          <FormSelect
            id="schedule-assignee"
            initialValue={String(
              schedule?.assigneeMembershipId ?? employees[0]?.membershipId
            )}
            name="assigneeMembershipId"
            options={employees.map((employee) => ({
              label: employee.displayName,
              value: String(employee.membershipId),
            }))}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="schedule-recurrence">Repeats</FieldLabel>
            <FormSelect
              id="schedule-recurrence"
              initialValue={recurrence}
              name="recurrenceType"
              onValueChange={(value) =>
                setRecurrence(value as "daily" | "weekly")
              }
              options={RECURRENCE_OPTIONS}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="schedule-time">Local time</FieldLabel>
            <Input
              defaultValue={schedule?.localTime ?? "09:00"}
              id="schedule-time"
              name="localTime"
              required
              type="time"
            />
          </Field>
        </div>
        {recurrence === "weekly" ? (
          <Field>
            <FieldLabel>Weekdays</FieldLabel>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map(([value, label]) => (
                <label className="flex items-center gap-2 text-sm" key={value}>
                  <Checkbox
                    defaultChecked={schedule?.weekdays.includes(value)}
                    name="weekdays"
                    value={String(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </Field>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="schedule-starts-on">Starts on</FieldLabel>
            <Input
              defaultValue={
                schedule?.startsOn ?? new Date().toISOString().slice(0, 10)
              }
              id="schedule-starts-on"
              name="startsOn"
              required
              type="date"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="schedule-ends-on">Ends on</FieldLabel>
            <Input
              defaultValue={schedule?.endsOn ?? ""}
              id="schedule-ends-on"
              name="endsOn"
              type="date"
            />
          </Field>
        </div>
        <Field orientation="horizontal">
          <Checkbox
            defaultChecked={schedule?.isEnabled ?? true}
            id="schedule-enabled"
            name="isEnabled"
            value="true"
          />
          <div>
            <FieldLabel htmlFor="schedule-enabled">Enabled</FieldLabel>
            <FieldDescription>
              Paused time is skipped when this is enabled again.
            </FieldDescription>
          </div>
        </Field>
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Save schedule"}
        </Button>
      </FieldGroup>
    </form>
  )
}

function WorkspaceEmpty({
  action,
  description,
  disabled,
  icon,
  onAction,
  title,
}: {
  action: string
  description: string
  disabled?: boolean
  icon: React.ReactNode
  onAction: () => void
  title: string
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <Button disabled={disabled} onClick={onAction}>
        {action}
      </Button>
    </Empty>
  )
}

function describeRecurrence(schedule: JobSchedule) {
  if (schedule.recurrenceType === "daily")
    return `Daily at ${schedule.localTime}`
  const days = WEEKDAYS.filter(([value]) => schedule.weekdays.includes(value))
    .map(([, label]) => label)
    .join(", ")
  return `${days} at ${schedule.localTime}`
}

function formatInstant(value: string, timezone: string) {
  return formatMediumZonedDateTime(value, timezone)
}
