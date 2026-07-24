"use client";

import {
  DragDropProvider,
  PointerSensor,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  CalendarClockIcon,
  HistoryIcon,
  MailIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  PowerIcon,
  Trash2Icon,
} from "@eva/ui/components/icons";
import * as React from "react";
import {
  createRosterTaskAction,
  deleteRosterTaskAction,
  moveRosterTaskAction,
  runRosterTaskNowAction,
  toggleRosterTaskEnabledAction,
  updateRosterTaskAction,
} from "@/app/dashboard/project-actions";
import { Button } from "@eva/ui/components/button";
import { Badge } from "@eva/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@eva/ui/components/dialog";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@eva/ui/components/popover";
import { Input } from "@eva/ui/components/input";
import { Label } from "@eva/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eva/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@eva/ui/components/sheet";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@eva/ui/components/tabs";
import { Textarea } from "@eva/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@eva/ui/components/tooltip";
import { LocalizedDate } from "@/components/localized-date";
import { useActionMutation } from "@/hooks/use-action-mutation";
import type { ProjectAutomationRun } from "@/lib/project-automation";
import type {
  ProjectAgentJob,
  ProjectOutboundEmail,
  ProjectRosterTask,
} from "@/lib/project-roster";
import {
  removeQueryListItem,
  setQueryListData,
  upsertQueryListItem,
} from "@/lib/query/cache";
import {
  rosterEmailsQueryKey,
  rosterJobsQueryKey,
  rosterRunsQueryKey,
  rosterTasksQueryKey,
} from "@/lib/query/keys";
import { cn } from "@eva/ui/lib/utils";
import { toast } from "@eva/ui/components/sonner";
import { zonedLocalDateTimeToUtc } from "@eva/core/roster-time";

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
] as const;
const FOCUSES = [
  { label: "General checkup", value: "general_checkup" },
  { label: "Work items", value: "work_items" },
  { label: "Customers", value: "customers" },
  { label: "Memory hygiene", value: "memory_hygiene" },
  { label: "Sales", value: "sales" },
  { label: "Marketing", value: "marketing" },
  { label: "Support", value: "support" },
  { label: "Finance", value: "finance" },
  { label: "Custom", value: "custom" },
] as const;
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const QUARTER_MINUTES = [0, 15, 30, 45] as const;
const QUARTER_HEIGHT = 12;
const CARD_HEIGHT = QUARTER_HEIGHT;
const STACK_COLLAPSED_OFFSET = 4;
const BASE_HOUR_HEIGHT = QUARTER_HEIGHT * QUARTER_MINUTES.length;
const TASK_DRAG_ACTIVATION_DISTANCE = 4;

type RosterStatusFilter = "active" | "all" | "paused";

type RosterFormState = {
  readonly brief: string;
  readonly dayOfWeek: number;
  readonly emailEnabled: boolean;
  readonly emailRecipients: string;
  readonly enabled: boolean;
  readonly focus: ProjectRosterTask["task_config"]["focus"];
  readonly localTime: string;
  readonly runAt: string;
  readonly scheduleKind: "once" | "daily" | "weekly";
  readonly tags: string;
  readonly title: string;
  readonly timezone: string;
};

type RosterTaskOccurrence = {
  readonly occurrenceKey: string;
  readonly task: ProjectRosterTask;
  readonly viewDayOfWeek: number;
  readonly viewLocalTime: string;
};

type RosterTaskDragData = {
  readonly sourceDayOfWeek: number;
  readonly taskId: string;
};

type RosterCronHealth = {
  readonly label: "Next run queued" | "Paused" | "Scheduled";
  readonly reason: string | null;
  readonly variant: "destructive" | "outline" | "secondary";
};

function createPointerDistanceConstraint(startEvent: PointerEvent) {
  let controller: { activate: (event: PointerEvent) => void } | null = null;
  const start = {
    x: startEvent.clientX,
    y: startEvent.clientY,
  };

  return {
    abort() {},
    set controller(value: { activate: (event: PointerEvent) => void }) {
      controller = value;
    },
    onEvent(event: PointerEvent) {
      if (event.type !== "pointermove") {
        return;
      }

      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;

      if (Math.hypot(deltaX, deltaY) >= TASK_DRAG_ACTIVATION_DISTANCE) {
        controller?.activate(event);
      }
    },
  };
}

const TASK_DRAG_SENSORS = [
  PointerSensor.configure({
    activationConstraints: (event: PointerEvent) =>
      [createPointerDistanceConstraint(event)] as never,
  }),
];

function getRosterTaskDragData(data: unknown): RosterTaskDragData | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const candidate = data as Partial<RosterTaskDragData>;

  if (
    typeof candidate.taskId !== "string" ||
    typeof candidate.sourceDayOfWeek !== "number"
  ) {
    return null;
  }

  return {
    sourceDayOfWeek: candidate.sourceDayOfWeek,
    taskId: candidate.taskId,
  };
}

function taskTags(task: ProjectRosterTask | null) {
  const tags = task?.metadata?.tags;

  return Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === "string").join(", ")
    : "";
}

function taskTagList(task: ProjectRosterTask) {
  return taskTags(task)
    .split(", ")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function cronHealthForTask(task: ProjectRosterTask): RosterCronHealth {
  if (!task.enabled) {
    return {
      label: "Paused",
      reason: null,
      variant: "secondary",
    };
  }

  return {
    label: task.last_run_status === "queued" ? "Next run queued" : "Scheduled",
    reason: task.next_run_at
      ? `Next occurrence ${new Date(task.next_run_at).toLocaleString()}`
      : null,
    variant: "outline",
  };
}

function formStateFromTask(
  task: ProjectRosterTask | null,
): RosterFormState {
  const schedule = task?.schedule_config;
  const delivery = task?.delivery_config?.email;

  return {
    brief: task?.task_config?.brief ?? "",
    dayOfWeek: schedule?.kind === "weekly" ? schedule.day_of_week : 1,
    emailEnabled: delivery?.enabled ?? false,
    emailRecipients:
      delivery?.enabled ? delivery.recipients.join(", ") : "",
    enabled: task?.enabled ?? true,
    focus: task?.task_config?.focus ?? "general_checkup",
    localTime: schedule && schedule.kind !== "once" ? schedule.local_time : "09:00",
    runAt:
      schedule?.kind === "once"
        ? new Date(schedule.run_at).toISOString().slice(0, 16)
        : new Date(Date.now() + 60 * 60 * 1_000).toISOString().slice(0, 16),
    scheduleKind: schedule?.kind ?? "weekly",
    tags: taskTags(task),
    title: task?.title ?? "Project checkup",
    timezone: task?.timezone ?? getDeviceTimezone(),
  };
}

function slotTime(hour: number, minute = 0) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function slotId(day: number, hour: number, minute = 0) {
  return `${day}|${slotTime(hour, minute)}`;
}

function parseSlotId(id: string) {
  const [day, localTime] = id.split("|");

  return {
    dayOfWeek: Number.parseInt(day ?? "1", 10),
    localTime: localTime || "09:00",
  };
}

function localTimeParts(localTime: string) {
  const [hour = "0", minute = "0"] = localTime.split(":");

  return {
    hour: Number.parseInt(hour, 10),
    minute: Number.parseInt(minute, 10),
  };
}

function quarterIndexFromMinute(minute: number) {
  const index = Math.round(minute / 15);

  return Math.min(Math.max(index, 0), QUARTER_MINUTES.length - 1);
}

function formatScheduleSummary(task: ProjectRosterTask, viewDayOfWeek: number) {
  const day = DAYS.find((item) => item.value === viewDayOfWeek)?.label ?? "Mon";

  if (task.schedule_config.kind === "once") {
    return `Once at ${new Date(task.schedule_config.run_at).toLocaleString()}`;
  }

  if (task.schedule_config.kind === "daily") {
    return `Daily at ${task.schedule_config.local_time}`;
  }

  return `Every ${day} at ${task.schedule_config.local_time}`;
}

function occurrenceMatchesSlot(
  occurrence: RosterTaskOccurrence,
  day: number,
  hour: number,
) {
  const taskHour = localTimeParts(occurrence.viewLocalTime).hour;

  if (taskHour !== hour) return false;

  return occurrence.viewDayOfWeek === day;
}

function getDeviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function buildTaskOccurrence({
  sourceDayOfWeek,
  task,
}: {
  readonly sourceDayOfWeek: number;
  readonly task: ProjectRosterTask;
}): RosterTaskOccurrence {
  const localTime =
    task.schedule_config.kind === "once"
      ? new Intl.DateTimeFormat("en-AU", {
          hour: "2-digit",
          hour12: false,
          minute: "2-digit",
          timeZone: task.timezone,
        }).format(new Date(task.schedule_config.run_at))
      : task.schedule_config.local_time;

  return {
    occurrenceKey: `${task.id}-${sourceDayOfWeek}`,
    task,
    viewDayOfWeek: sourceDayOfWeek,
    viewLocalTime: localTime,
  };
}

function buildTaskOccurrences(
  tasks: readonly ProjectRosterTask[],
) {
  return tasks.flatMap((task) => {
    if (task.schedule_config.kind === "once") {
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: task.timezone,
        weekday: "short",
      }).format(new Date(task.schedule_config.run_at));
      const day = DAYS.find((candidate) => candidate.label === weekday)?.value ?? 1;
      return buildTaskOccurrence({ sourceDayOfWeek: day, task });
    }

    if (task.schedule_config.kind === "daily") {
      return DAYS.map((day) =>
        buildTaskOccurrence({
          sourceDayOfWeek: day.value,
          task,
        }),
      );
    }

    return buildTaskOccurrence({
      sourceDayOfWeek: task.schedule_config.day_of_week,
      task,
    });
  });
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: string) {
  return formString(formData, key) === "true";
}

function formNumber(formData: FormData, key: string, fallback: number) {
  const value = Number.parseInt(formString(formData, key), 10);

  return Number.isFinite(value) ? value : fallback;
}

function optimisticEmailRecipients(value: string) {
  return value
    .split(",")
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

function optimisticTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function optimisticTaskFromFormData(
  task: ProjectRosterTask,
  formData: FormData,
): ProjectRosterTask {
  const tags = optimisticTags(formString(formData, "tags"));
  const scheduleKind = formString(formData, "scheduleKind") as
    | "once"
    | "daily"
    | "weekly";
  const recipients = optimisticEmailRecipients(
    formString(formData, "emailRecipients"),
  );
  const emailEnabled = formBoolean(formData, "emailEnabled");
  const localTime = formString(formData, "localTime") || "09:00";
  const scheduleConfig =
    scheduleKind === "once"
      ? ({
          version: 1,
          kind: "once",
          run_at: new Date(formString(formData, "runAt")).toISOString(),
        } as const)
      : scheduleKind === "daily"
        ? ({ version: 1, kind: "daily", local_time: localTime } as const)
        : ({
            version: 1,
            kind: "weekly",
            day_of_week: formNumber(formData, "dayOfWeek", 1),
            local_time: localTime,
          } as const);

  return {
    ...task,
    delivery_config: {
      version: 1,
      email: emailEnabled
        ? { enabled: true, recipients }
        : { enabled: false },
    },
    email_recipients: emailEnabled ? recipients : [],
    enabled: formBoolean(formData, "enabled"),
    metadata: {
      ...task.metadata,
      tags,
    },
    schedule_config: scheduleConfig,
    task_config: {
      version: 1,
      executor: "project_review.v1",
      focus: (formString(formData, "focus") || "general_checkup") as ProjectRosterTask["task_config"]["focus"],
      ...(formString(formData, "focus") === "custom"
        ? { brief: formString(formData, "brief") }
        : {}),
    },
    timezone: formString(formData, "timezone") || task.timezone,
    title: formString(formData, "title") || task.title,
    updated_at: new Date().toISOString(),
  };
}

function optimisticTaskFromCreateFormData({
  formData,
  profileId,
  projectId,
}: {
  readonly formData: FormData;
  readonly profileId: string;
  readonly projectId: string;
}): ProjectRosterTask {
  const scheduleKind = (formString(formData, "scheduleKind") || "weekly") as
    | "once"
    | "daily"
    | "weekly";
  const localTime = formString(formData, "localTime") || "09:00";
  const dayOfWeek = formNumber(formData, "dayOfWeek", 1);
  const [hour = "9", minute = "0"] = localTime.split(":");
  const cronExpression =
    scheduleKind === "once"
      ? null
      : scheduleKind === "daily"
        ? `${Number.parseInt(minute, 10)} ${Number.parseInt(hour, 10)} * * *`
        : `${Number.parseInt(minute, 10)} ${Number.parseInt(hour, 10)} * * ${dayOfWeek}`;
  const now = new Date().toISOString();

  return {
    archived_at: null,
    created_at: now,
    cron_expression: cronExpression,
    cron_job_id: null,
    cron_job_name: null,
    delivery_config: formBoolean(formData, "emailEnabled")
      ? {
          version: 1,
          email: {
            enabled: true,
            recipients: optimisticEmailRecipients(
              formString(formData, "emailRecipients"),
            ),
          },
        }
      : { version: 1, email: { enabled: false } },
    email_recipients: formBoolean(formData, "emailEnabled")
      ? optimisticEmailRecipients(formString(formData, "emailRecipients"))
      : [],
    enabled: formBoolean(formData, "enabled"),
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `optimistic-${crypto.randomUUID()}`
        : `optimistic-${now}`,
    job_type: "project_checkup",
    last_run_at: null,
    last_run_id: null,
    last_run_status: null,
    lease_expires_at: null,
    lease_token: null,
    metadata: {
      tags: optimisticTags(formString(formData, "tags")),
    },
    next_run_at: null,
    profile_id: profileId,
    project_id: projectId,
    schedule_config:
      scheduleKind === "once"
        ? {
            version: 1,
            kind: "once",
            run_at: new Date(formString(formData, "runAt")).toISOString(),
          }
        : scheduleKind === "daily"
          ? { version: 1, kind: "daily", local_time: localTime }
          : {
              version: 1,
              kind: "weekly",
              day_of_week: dayOfWeek,
              local_time: localTime,
            },
    task_config: {
      version: 1,
      executor: "project_review.v1",
      focus: (formString(formData, "focus") || "general_checkup") as ProjectRosterTask["task_config"]["focus"],
      ...(formString(formData, "focus") === "custom"
        ? { brief: formString(formData, "brief") }
        : {}),
    },
    timezone: formString(formData, "timezone") || "UTC",
    title: formString(formData, "title") || "Project checkup",
    updated_at: now,
  };
}

function RosterCalendarGrid({
  activeTargetSlotId,
  days,
  gridClassName,
  gridStyle,
  onDeleteTask,
  onCreateTask,
  onEditTask,
  onRunTask,
  snapDayColumns = false,
  stickyHeader = false,
  stickyTimeColumn = false,
  onToggleTask,
  occurrences,
}: {
  readonly activeTargetSlotId: string | null;
  readonly days: readonly (typeof DAYS)[number][];
  readonly gridClassName: string;
  readonly gridStyle?: React.CSSProperties;
  readonly onCreateTask: (dayOfWeek: number, localTime: string) => void;
  readonly onDeleteTask: (taskId: string) => void;
  readonly onEditTask: (task: ProjectRosterTask) => void;
  readonly onRunTask: (taskId: string) => void;
  readonly snapDayColumns?: boolean;
  readonly stickyHeader?: boolean;
  readonly stickyTimeColumn?: boolean;
  readonly onToggleTask: (task: ProjectRosterTask) => void;
  readonly occurrences: readonly RosterTaskOccurrence[];
}) {
  return (
    <div className={cn("grid", gridClassName)} style={gridStyle}>
      <div
        className={cn(
          "border-b bg-muted/40 p-2",
          stickyHeader && "sticky top-0 z-20",
          stickyTimeColumn && "sticky left-0 z-30 border-r bg-muted",
          stickyHeader && stickyTimeColumn && "z-40",
        )}
      />
      {days.map((day) => (
        <div
          className={cn(
            "border-b border-l bg-muted/40 px-3 py-2 font-medium text-sm",
            snapDayColumns && "snap-start snap-always scroll-ml-16",
            stickyHeader && "sticky top-0 z-20",
          )}
          data-roster-day-header={snapDayColumns ? "" : undefined}
          key={day.value}
        >
          {day.label}
        </div>
      ))}
      {HOURS.map((hour) => (
        <React.Fragment key={hour}>
          <div
            className={cn(
              "border-b bg-muted/20 px-2 py-2 font-normal text-muted-foreground/60 text-xs tabular-nums",
              stickyTimeColumn && "sticky left-0 z-20 border-r bg-background/95",
            )}
          >
            {slotTime(hour)}
          </div>
          {days.map((day) => (
            <RosterSlot
              activeTargetSlotId={activeTargetSlotId}
              day={day.value}
              hour={hour}
              key={`${day.value}-${hour}`}
              onCreateTask={onCreateTask}
              onDeleteTask={onDeleteTask}
              onEditTask={onEditTask}
              onRunTask={onRunTask}
              onToggleTask={onToggleTask}
              occurrences={occurrences.filter((occurrence) =>
                occurrenceMatchesSlot(occurrence, day.value, hour),
              )}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

export function RosterCalendar({
  initialEmails,
  initialJobs,
  initialRuns,
  initialTasks,
  projectId,
  projectName,
}: {
  readonly initialEmails: readonly ProjectOutboundEmail[];
  readonly initialJobs: readonly ProjectAgentJob[];
  readonly initialRuns: readonly ProjectAutomationRun[];
  readonly initialTasks: readonly ProjectRosterTask[];
  readonly projectId: string;
  readonly projectName: string;
}) {
  const queryClient = useQueryClient();
  const tasksQueryKey = React.useMemo(
    () => rosterTasksQueryKey(projectId),
    [projectId],
  );
  const emailsQueryKey = React.useMemo(
    () => rosterEmailsQueryKey(projectId),
    [projectId],
  );
  const runsQueryKey = React.useMemo(
    () => rosterRunsQueryKey(projectId),
    [projectId],
  );
  const jobsQueryKey = React.useMemo(
    () => rosterJobsQueryKey(projectId),
    [projectId],
  );
  const tasksQuery = useQuery({
    initialData: () =>
      queryClient.getQueryData<ProjectRosterTask[]>(tasksQueryKey) ?? [
        ...initialTasks,
      ],
    queryFn: async () => [...initialTasks],
    queryKey: tasksQueryKey,
  });
  const emailsQuery = useQuery({
    initialData: () =>
      queryClient.getQueryData<ProjectOutboundEmail[]>(emailsQueryKey) ?? [
        ...initialEmails,
      ],
    queryFn: async () => [...initialEmails],
    queryKey: emailsQueryKey,
  });
  const runsQuery = useQuery({
    initialData: () =>
      queryClient.getQueryData<ProjectAutomationRun[]>(runsQueryKey) ?? [
        ...initialRuns,
      ],
    queryFn: async () => [...initialRuns],
    queryKey: runsQueryKey,
  });
  const jobsQuery = useQuery({
    initialData: () =>
      queryClient.getQueryData<ProjectAgentJob[]>(jobsQueryKey) ?? [
        ...initialJobs,
      ],
    queryFn: async () => [...initialJobs],
    queryKey: jobsQueryKey,
  });
  const tasks = tasksQuery.data ?? [];
  const emails = emailsQuery.data ?? [];
  const runs = runsQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];
  const [defaultTimezone] = React.useState(getDeviceTimezone);
  const [editingTask, setEditingTask] = React.useState<ProjectRosterTask | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<RosterStatusFilter>("active");
  const [activeTargetSlotId, setActiveTargetSlotId] = React.useState<string | null>(null);
  const [formState, setFormState] = React.useState<RosterFormState>(() =>
    formStateFromTask(null),
  );
  const previousTasksRef = React.useRef(tasks);
  const mobileCalendarScrollRef = React.useRef<HTMLDivElement | null>(null);
  const mobileSnapTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRosterTaskDraggingRef = React.useRef(false);
  const previousMobileScrollLeftRef = React.useRef(0);
  const rollbackTasksRef = React.useRef<ProjectRosterTask[] | null>(null);
  const optimisticCreateTaskIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setQueryListData(queryClient, tasksQueryKey, initialTasks);
    setQueryListData(queryClient, emailsQueryKey, initialEmails);
    setQueryListData(queryClient, runsQueryKey, initialRuns);
    setQueryListData(queryClient, jobsQueryKey, initialJobs);
  }, [
    emailsQueryKey,
    initialEmails,
    initialRuns,
    initialJobs,
    initialTasks,
    queryClient,
    runsQueryKey,
    jobsQueryKey,
    tasksQueryKey,
  ]);

  React.useEffect(
    () => () => {
      if (mobileSnapTimeoutRef.current) {
        clearTimeout(mobileSnapTimeoutRef.current);
      }
    },
    [],
  );

  const visibleTasks = React.useMemo(() => {
    if (statusFilter === "active") {
      return tasks.filter((task) => task.enabled);
    }

    if (statusFilter === "paused") {
      return tasks.filter((task) => !task.enabled);
    }

    return tasks;
  }, [statusFilter, tasks]);
  const visibleOccurrences = React.useMemo(
    () => buildTaskOccurrences(visibleTasks),
    [visibleTasks],
  );

  function getRosterTasksSnapshot() {
    return queryClient.getQueryData<ProjectRosterTask[]>(tasksQueryKey) ?? tasks;
  }

  function replaceRosterTasks(nextTasks: readonly ProjectRosterTask[]) {
    setQueryListData(queryClient, tasksQueryKey, nextTasks);
  }

  function updateRosterTasks(
    updater: (current: readonly ProjectRosterTask[]) => readonly ProjectRosterTask[],
  ) {
    queryClient.setQueryData<ProjectRosterTask[]>(tasksQueryKey, (current) => [
      ...updater(current ?? tasks),
    ]);
  }

  function captureRosterTasksRollback() {
    rollbackTasksRef.current = getRosterTasksSnapshot();
  }

  function rollbackRosterTasks() {
    if (!rollbackTasksRef.current) {
      return;
    }

    replaceRosterTasks(rollbackTasksRef.current);
    rollbackTasksRef.current = null;
  }

  function clearRosterTasksRollback() {
    rollbackTasksRef.current = null;
  }

  function openCreateDialog() {
    setEditingTask(null);
    setFormState(formStateFromTask(null));
    setIsDialogOpen(true);
  }

  function openCreateDialogForSlot(dayOfWeek: number, localTime: string) {
    setEditingTask(null);
    setFormState({
      ...formStateFromTask(null),
      dayOfWeek,
      localTime,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(task: ProjectRosterTask) {
    setEditingTask(task);
    setFormState(formStateFromTask(task));
    setIsDialogOpen(true);
  }

  const createMutation = useActionMutation<ProjectRosterTask>({
    action: createRosterTaskAction,
    loadingMessage: "Creating roster task...",
    onError: () => {
      rollbackRosterTasks();
      optimisticCreateTaskIdRef.current = null;
    },
    onOptimistic: (formData) => {
      const snapshot = getRosterTasksSnapshot();
      const optimisticTask = optimisticTaskFromCreateFormData({
        formData,
        profileId: snapshot[0]?.profile_id ?? "optimistic",
        projectId,
      });

      captureRosterTasksRollback();
      optimisticCreateTaskIdRef.current = optimisticTask.id;
      upsertQueryListItem(queryClient, tasksQueryKey, optimisticTask);
    },
    onSuccess: (result) => {
      clearRosterTasksRollback();
      if (optimisticCreateTaskIdRef.current) {
        removeQueryListItem(
          queryClient,
          tasksQueryKey,
          optimisticCreateTaskIdRef.current,
        );
        optimisticCreateTaskIdRef.current = null;
      }
      if (result.data) {
        upsertQueryListItem(queryClient, tasksQueryKey, result.data);
      }
      setIsDialogOpen(false);
    },
  });
  const updateMutation = useActionMutation<ProjectRosterTask>({
    action: updateRosterTaskAction,
    loadingMessage: "Updating roster task...",
    onError: rollbackRosterTasks,
    onOptimistic: (formData) => {
      const taskId = formString(formData, "taskId");
      const task = getRosterTasksSnapshot().find((item) => item.id === taskId);

      if (!task) return;

      captureRosterTasksRollback();
      upsertQueryListItem(
        queryClient,
        tasksQueryKey,
        optimisticTaskFromFormData(task, formData),
      );
    },
    onSuccess: (result) => {
      clearRosterTasksRollback();
      if (result.data) {
        upsertQueryListItem(queryClient, tasksQueryKey, result.data);
      }
      setIsDialogOpen(false);
    },
  });
  const deleteMutation = useActionMutation<ProjectRosterTask>({
    action: deleteRosterTaskAction,
    loadingMessage: "Deleting roster task...",
    onError: rollbackRosterTasks,
    onOptimistic: (formData) => {
      const taskId = formString(formData, "taskId");

      if (!taskId) return;

      captureRosterTasksRollback();
      removeQueryListItem(queryClient, tasksQueryKey, taskId);
    },
    onSuccess: (result) => {
      clearRosterTasksRollback();
      if (result.data) {
        removeQueryListItem(queryClient, tasksQueryKey, result.data.id);
      }
    },
  });
  const runMutation = useActionMutation({
    action: runRosterTaskNowAction,
    loadingMessage: "Running roster task...",
  });
  const toggleMutation = useActionMutation<ProjectRosterTask>({
    action: toggleRosterTaskEnabledAction,
    loadingMessage: "Updating roster task...",
    onError: rollbackRosterTasks,
    onOptimistic: (formData) => {
      const taskId = formString(formData, "taskId");
      const enabled = formBoolean(formData, "enabled");

      if (!taskId) return;

      captureRosterTasksRollback();
      updateRosterTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                enabled,
                updated_at: new Date().toISOString(),
              }
            : task,
        ),
      );
    },
    onSuccess: (result) => {
      clearRosterTasksRollback();
      if (result.data) {
        upsertQueryListItem(queryClient, tasksQueryKey, result.data);
      }
    },
  });

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("brief", formState.brief);
    formData.set("dayOfWeek", String(formState.dayOfWeek));
    formData.set("emailEnabled", String(formState.emailEnabled));
    formData.set("emailRecipients", formState.emailRecipients);
    formData.set("enabled", String(formState.enabled));
    formData.set("focus", formState.focus);
    formData.set("localTime", formState.localTime);
    formData.set(
      "runAt",
      formState.scheduleKind === "once"
        ? zonedLocalDateTimeToUtc(formState.runAt, formState.timezone)
        : "",
    );
    formData.set("scheduleKind", formState.scheduleKind);
    formData.set("tags", formState.tags);
    formData.set("timezone", formState.timezone);
    formData.set("title", formState.title);

    if (editingTask) {
      formData.set("taskId", editingTask.id);
      await updateMutation.run(formData);
    } else {
      await createMutation.run(formData);
    }
  }

  async function persistMove(taskId: string, targetSlotId: string) {
    const { dayOfWeek, localTime } = parseSlotId(targetSlotId);
    const taskTimezone =
      getRosterTasksSnapshot().find((task) => task.id === taskId)?.timezone ??
      defaultTimezone;
    const formData = new FormData();
    formData.set("dayOfWeek", String(dayOfWeek));
    formData.set("localTime", localTime);
    formData.set("taskId", taskId);
    formData.set("timezone", taskTimezone);

    const previous = getRosterTasksSnapshot();
    replaceRosterTasks(
      previous.map((task) =>
        task.id === taskId
          ? {
              ...task,
              schedule_config: {
                version: 1,
                kind: "weekly",
                day_of_week: dayOfWeek,
                local_time: localTime,
              },
              timezone: taskTimezone,
              updated_at: new Date().toISOString(),
            }
          : task,
      ),
    );
    previousTasksRef.current = previous;

    const result = await moveRosterTaskAction(formData);

    if (!result.ok) {
      replaceRosterTasks(previous);
      toast.error(result.message);
      return;
    }

    if (result.data) {
      upsertQueryListItem(queryClient, tasksQueryKey, result.data);
    }
  }

  function snapMobileCalendarToNearestDay() {
    if (isRosterTaskDraggingRef.current) {
      return;
    }

    const scroller = mobileCalendarScrollRef.current;
    const firstDayHeader = scroller?.querySelector<HTMLElement>(
      "[data-roster-day-header]",
    );

    if (!scroller || !firstDayHeader) return;

    const dayWidth = firstDayHeader.getBoundingClientRect().width;

    if (dayWidth <= 0) return;

    const targetIndex = Math.min(
      DAYS.length - 1,
      Math.max(0, Math.round(scroller.scrollLeft / dayWidth)),
    );
    const targetLeft = targetIndex * dayWidth;

    if (Math.abs(scroller.scrollLeft - targetLeft) < 1) return;

    scroller.scrollTo({
      behavior: "smooth",
      left: targetLeft,
    });
  }

  function handleMobileCalendarScroll() {
    const scroller = mobileCalendarScrollRef.current;

    if (!scroller || isRosterTaskDraggingRef.current) {
      return;
    }

    const horizontalDelta = Math.abs(
      scroller.scrollLeft - previousMobileScrollLeftRef.current,
    );
    previousMobileScrollLeftRef.current = scroller.scrollLeft;

    if (horizontalDelta < 1) {
      return;
    }

    if (mobileSnapTimeoutRef.current) {
      clearTimeout(mobileSnapTimeoutRef.current);
    }

    mobileSnapTimeoutRef.current = setTimeout(() => {
      snapMobileCalendarToNearestDay();
    }, 90);
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-semibold text-3xl">Roster</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Scheduled agent work for {projectName}
          </p>
        </div>
        <div className="hidden flex-wrap items-center gap-2 md:flex md:justify-end">
          <Tabs
            onValueChange={(value) => setStatusFilter(value as RosterStatusFilter)}
            value={statusFilter}
          >
            <TabsList className="h-9">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="paused">Paused</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={openCreateDialog} type="button">
            <PlusIcon className="size-4" />
            New task
          </Button>
          <Button
            aria-label="Open roster history"
            onClick={() => setIsHistoryOpen(true)}
            size="icon"
            type="button"
            variant="outline"
          >
            <HistoryIcon className="size-4" />
          </Button>
        </div>
      </header>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className="grid min-w-0 gap-2 md:hidden">
          <Tabs
            className="w-full"
            onValueChange={(value) => setStatusFilter(value as RosterStatusFilter)}
            value={statusFilter}
          >
            <TabsList className="h-9 w-full">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="paused">Paused</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid grid-cols-[minmax(0,9fr)_minmax(40px,1fr)] gap-2">
            <Button className="w-full" onClick={openCreateDialog} type="button">
              <PlusIcon className="size-4" />
              New task
            </Button>
            <Button
              aria-label="Open roster history"
              className="w-full"
              onClick={() => setIsHistoryOpen(true)}
              size="icon"
              type="button"
              variant="outline"
            >
              <HistoryIcon className="size-4" />
            </Button>
          </div>
        </div>
        <DragDropProvider
          onDragStart={() => {
            isRosterTaskDraggingRef.current = true;
            if (mobileSnapTimeoutRef.current) {
              clearTimeout(mobileSnapTimeoutRef.current);
              mobileSnapTimeoutRef.current = null;
            }
            setActiveTargetSlotId(null);
            previousTasksRef.current = tasks;
          }}
          onDragOver={(event) => {
            const targetId = String(event.operation.target?.id ?? "");
            setActiveTargetSlotId(
              event.operation.target?.type === "slot" && targetId ? targetId : null,
            );
          }}
          onDragEnd={(event) => {
            const operation = event.operation;
            const sourceData = getRosterTaskDragData(operation.source?.data);
            const targetId = String(operation.target?.id ?? "");

            isRosterTaskDraggingRef.current = false;
            setActiveTargetSlotId(null);

            if (
              !sourceData ||
              !targetId ||
              operation.source?.type !== "roster-task" ||
              operation.target?.type !== "slot"
            ) {
              return;
            }

            void persistMove(sourceData.taskId, targetId);
          }}
        >
          <div
            aria-label="Roster calendar"
            className="hidden min-h-0 flex-1 overflow-auto rounded-lg border md:block"
            role="region"
          >
            <RosterCalendarGrid
              activeTargetSlotId={activeTargetSlotId}
              days={DAYS}
              gridClassName="min-w-[980px] grid-cols-[72px_repeat(7,minmax(120px,1fr))]"
              onDeleteTask={(taskId) => {
                const formData = new FormData();
                formData.set("taskId", taskId);
                void deleteMutation.run(formData);
              }}
              onCreateTask={openCreateDialogForSlot}
              onEditTask={openEditDialog}
              onRunTask={(taskId) => {
                const formData = new FormData();
                formData.set("taskId", taskId);
                void runMutation.run(formData);
              }}
              onToggleTask={(task) => {
                const formData = new FormData();
                formData.set("enabled", String(!task.enabled));
                formData.set("taskId", task.id);
                void toggleMutation.run(formData);
              }}
              occurrences={visibleOccurrences}
              stickyHeader
            />
          </div>
          <div className="min-h-0 min-w-0 flex-1 md:hidden">
            <div
              aria-label="Roster calendar"
              className="h-full min-h-0 min-w-0 snap-x snap-mandatory scroll-pl-16 scroll-smooth overflow-auto rounded-lg border overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onScroll={handleMobileCalendarScroll}
              ref={mobileCalendarScrollRef}
              role="region"
            >
              <RosterCalendarGrid
                activeTargetSlotId={activeTargetSlotId}
                days={DAYS}
                gridClassName="w-max"
                gridStyle={{
                  gridTemplateColumns:
                    "64px repeat(7, minmax(calc(100dvw - 96px), calc(100dvw - 96px)))",
                }}
                onDeleteTask={(taskId) => {
                  const formData = new FormData();
                  formData.set("taskId", taskId);
                  void deleteMutation.run(formData);
                }}
                onCreateTask={openCreateDialogForSlot}
                onEditTask={openEditDialog}
                onRunTask={(taskId) => {
                  const formData = new FormData();
                  formData.set("taskId", taskId);
                  void runMutation.run(formData);
                }}
                onToggleTask={(task) => {
                  const formData = new FormData();
                  formData.set("enabled", String(!task.enabled));
                  formData.set("taskId", task.id);
                  void toggleMutation.run(formData);
                }}
                occurrences={visibleOccurrences}
                snapDayColumns
                stickyHeader
                stickyTimeColumn
              />
            </div>
          </div>
        </DragDropProvider>
      </section>

      <RosterHistorySheet
        emails={emails}
        isOpen={isHistoryOpen}
        jobs={jobs}
        onOpenChange={setIsHistoryOpen}
        runs={runs}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Edit roster task" : "New roster task"}
            </DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" id="roster-task-form" onSubmit={submitTask}>
            <div className="grid gap-2">
              <Label htmlFor="roster-title">Title</Label>
              <Input
                id="roster-title"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                value={formState.title}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="roster-focus">Focus</Label>
              <Select
                onValueChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    focus: value as RosterFormState["focus"],
                  }))
                }
                value={formState.focus}
              >
                <SelectTrigger id="roster-focus" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOCUSES.map((focus) => (
                    <SelectItem key={focus.value} value={focus.value}>
                      {focus.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formState.focus === "custom" ? (
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="roster-brief">Custom brief</Label>
                  <span className="text-muted-foreground text-xs">
                    {formState.brief.length}/4000
                  </span>
                </div>
                <Textarea
                  id="roster-brief"
                  maxLength={4000}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      brief: event.target.value,
                    }))
                  }
                  placeholder="Describe the bounded analysis you want eva to perform."
                  required
                  rows={4}
                  value={formState.brief}
                />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="roster-schedule-kind">Schedule</Label>
                <Select
                  onValueChange={(value) =>
                    setFormState((current) => ({
                      ...current,
                      scheduleKind: value as RosterFormState["scheduleKind"],
                    }))
                  }
                  value={formState.scheduleKind}
                >
                  <SelectTrigger id="roster-schedule-kind" className="w-full min-w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="roster-day">Day</Label>
                <Select
                  disabled={formState.scheduleKind !== "weekly"}
                  onValueChange={(value) =>
                    setFormState((current) => ({
                      ...current,
                      dayOfWeek: Number.parseInt(value, 10),
                    }))
                  }
                  value={String(formState.dayOfWeek)}
                >
                  <SelectTrigger id="roster-day" className="w-full min-w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                {formState.scheduleKind === "once" ? (
                  <>
                    <Label htmlFor="roster-run-at">Run at</Label>
                    <Input
                      id="roster-run-at"
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          runAt: event.target.value,
                        }))
                      }
                      required
                      type="datetime-local"
                      value={formState.runAt}
                    />
                  </>
                ) : (
                  <>
                    <Label htmlFor="roster-time">Time</Label>
                    <Input
                      id="roster-time"
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          localTime: event.target.value,
                        }))
                      }
                      step={900}
                      type="time"
                      value={formState.localTime}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="roster-tags">Tags</Label>
              <Input
                id="roster-tags"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    tags: event.target.value,
                  }))
                }
                placeholder="operations, reporting"
                value={formState.tags}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                checked={formState.emailEnabled}
                className="size-4"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    emailEnabled: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Email this result
            </label>

            {formState.emailEnabled ? (
              <div className="grid gap-2">
                <Label htmlFor="roster-recipients">Email recipients</Label>
                <Textarea
                  id="roster-recipients"
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      emailRecipients: event.target.value,
                    }))
                  }
                  placeholder="founder@example.com, ops@example.com"
                  required
                  rows={3}
                  value={formState.emailRecipients}
                />
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input
                checked={formState.enabled}
                className="size-4"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Enabled
            </label>

            <DialogFooter>
              <Button
                disabled={createMutation.isPending || updateMutation.isPending}
                form="roster-task-form"
                type="submit"
              >
                {editingTask ? "Save task" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RosterSlot({
  activeTargetSlotId,
  day,
  hour,
  onEditTask,
  onCreateTask,
  onDeleteTask,
  onRunTask,
  onToggleTask,
  occurrences,
}: {
  readonly activeTargetSlotId: string | null;
  readonly day: number;
  readonly hour: number;
  readonly onCreateTask: (dayOfWeek: number, localTime: string) => void;
  readonly onDeleteTask: (taskId: string) => void;
  readonly onEditTask: (task: ProjectRosterTask) => void;
  readonly onRunTask: (taskId: string) => void;
  readonly onToggleTask: (task: ProjectRosterTask) => void;
  readonly occurrences: readonly RosterTaskOccurrence[];
}) {
  const [isHovered, setIsHovered] = React.useState(false);
  const activeTarget = activeTargetSlotId ? parseSlotId(activeTargetSlotId) : null;
  const activeTargetQuarterIndex =
    activeTarget?.dayOfWeek === day && localTimeParts(activeTarget.localTime).hour === hour
      ? quarterIndexFromMinute(localTimeParts(activeTarget.localTime).minute)
      : null;
  const isExpanded = isHovered || activeTargetQuarterIndex !== null;
  const quarterLanes = React.useMemo(() => {
    const grouped = new Map<number, RosterTaskOccurrence[]>();

    for (const occurrence of occurrences) {
      const { minute } = localTimeParts(occurrence.viewLocalTime);
      const quarterIndex = quarterIndexFromMinute(minute);
      const group = grouped.get(quarterIndex) ?? [];
      group.push(occurrence);
      grouped.set(quarterIndex, group);
    }

    let top = 0;

    return QUARTER_MINUTES.map((minute, quarterIndex) => {
      const laneOccurrences = [...(grouped.get(quarterIndex) ?? [])].sort(
        (first, second) => first.task.title.localeCompare(second.task.title),
      );
      const projectedCount =
        laneOccurrences.length + (activeTargetQuarterIndex === quarterIndex ? 1 : 0);
      const laneHeight = isExpanded
        ? Math.max(QUARTER_HEIGHT, projectedCount * CARD_HEIGHT)
        : QUARTER_HEIGHT;
      const lane = {
        height: laneHeight,
        minute,
        occurrences: laneOccurrences,
        top,
      };

      top += laneHeight;

      return lane;
    });
  }, [activeTargetQuarterIndex, isExpanded, occurrences]);
  const stackOffset = isExpanded ? CARD_HEIGHT : STACK_COLLAPSED_OFFSET;
  const slotMinHeight = Math.max(
    BASE_HOUR_HEIGHT,
    quarterLanes.reduce((height, lane) => height + lane.height, 0),
  );

  return (
    <div
      className="border-b border-l transition-[min-height] duration-150 ease-out"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ minHeight: `${slotMinHeight}px` }}
    >
      <div
        className="relative h-full transition-[min-height] duration-150 ease-out"
        style={{
          minHeight: `${slotMinHeight}px`,
        }}
      >
        {quarterLanes.map((lane) => (
          <RosterQuarterDropZone
            day={day}
            height={lane.height}
            hour={hour}
            key={lane.minute}
            minute={lane.minute}
            onCreateTask={onCreateTask}
            top={lane.top}
          />
        ))}
        {quarterLanes.flatMap((lane) =>
          lane.occurrences.map((occurrence, stackIndex) => (
            <RosterTaskCard
              key={occurrence.occurrenceKey}
              onDelete={() => onDeleteTask(occurrence.task.id)}
              onEdit={() => onEditTask(occurrence.task)}
              onRun={() => onRunTask(occurrence.task.id)}
              onToggle={() => onToggleTask(occurrence.task)}
              occurrence={occurrence}
              top={lane.top + stackIndex * stackOffset}
              zIndex={stackIndex + 1}
            />
          )),
        )}
      </div>
    </div>
  );
}
function RosterQuarterDropZone({
  day,
  height,
  hour,
  minute,
  onCreateTask,
  top,
}: {
  readonly day: number;
  readonly height: number;
  readonly hour: number;
  readonly minute: (typeof QUARTER_MINUTES)[number];
  readonly onCreateTask: (dayOfWeek: number, localTime: string) => void;
  readonly top: number;
}) {
  const localTime = slotTime(hour, minute);
  const { isDropTarget, ref } = useDroppable({
    accept: "roster-task",
    id: slotId(day, hour, minute),
    type: "slot",
  });

  return (
    <button
      aria-label={`Create task at ${localTime}`}
      className={cn(
        "absolute right-0 left-0 z-0 cursor-pointer transition-colors hover:bg-muted/40",
        isDropTarget && "bg-primary/10",
      )}
      onClick={(event) => {
        event.stopPropagation();
        onCreateTask(day, localTime);
      }}
      ref={ref}
      style={{
        height: `${height}px`,
        top: `${top}px`,
      }}
      type="button"
    />
  );
}

function RosterTaskCard({
  onDelete,
  onEdit,
  onRun,
  onToggle,
  occurrence,
  top,
  zIndex,
}: {
  readonly onDelete: () => void;
  readonly onEdit: () => void;
  readonly onRun: () => void;
  readonly onToggle: () => void;
  readonly occurrence: RosterTaskOccurrence;
  readonly top: number;
  readonly zIndex: number;
}) {
  const task = occurrence.task;
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const suppressPreviewRef = React.useRef(false);
  const { isDragging, isDropping, ref } = useDraggable<RosterTaskDragData>({
    data: {
      sourceDayOfWeek: occurrence.viewDayOfWeek,
      taskId: task.id,
    },
    id: occurrence.occurrenceKey,
    sensors: TASK_DRAG_SENSORS,
    type: "roster-task",
  });
  const cardRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      ref(element);
    },
    [ref],
  );
  const tags = taskTagList(task);
  const cronHealth = cronHealthForTask(task);
  React.useEffect(() => {
    if (!isPreviewOpen) return;

    const closePreview = () => setIsPreviewOpen(false);
    document.addEventListener("scroll", closePreview, {
      capture: true,
      passive: true,
    });

    return () => document.removeEventListener("scroll", closePreview, true);
  }, [isPreviewOpen]);
  const statusClassName = task.enabled
    ? "border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15"
    : "border-muted-foreground/30 bg-muted/50 text-muted-foreground";
  const card = (
    <Popover open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "absolute right-1 left-1 h-3 touch-none select-none overflow-hidden rounded-sm border px-1 shadow-xs transition-[background-color,border-color,box-shadow,opacity] hover:shadow-md",
            statusClassName,
            isDragging && "opacity-80 transition-none",
            isDropping && "transition-none",
          )}
          data-roster-task-card
          onClick={(event) => {
            if (suppressPreviewRef.current || isDragging || isDropping) {
              event.preventDefault();
              suppressPreviewRef.current = false;
              return;
            }

            setIsPreviewOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setIsPreviewOpen(true);
            }
          }}
          onPointerCancel={() => {
            pointerStartRef.current = null;
            suppressPreviewRef.current = false;
          }}
          onPointerDown={(event) => {
            pointerStartRef.current = {
              x: event.clientX,
              y: event.clientY,
            };
            suppressPreviewRef.current = false;
          }}
          onPointerMove={(event) => {
            const start = pointerStartRef.current;

            if (!start) return;

            const deltaX = event.clientX - start.x;
            const deltaY = event.clientY - start.y;

            if (Math.hypot(deltaX, deltaY) > 4) {
              suppressPreviewRef.current = true;
            }
          }}
          ref={cardRef}
          role="button"
          style={{
            top: `${top}px`,
            zIndex: isDragging || isDropping ? 50 : zIndex,
          }}
          tabIndex={0}
        >
          <div className="flex h-full min-w-0 cursor-grab items-center active:cursor-grabbing">
            <p className="truncate font-medium text-[10px] leading-3">
              {task.title}
            </p>
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="center"
        collisionPadding={12}
        className="w-[min(calc(100vw-2rem),24rem)] rounded-2xl p-0"
        side="bottom"
        sideOffset={8}
      >
        <div className="grid gap-5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              <span
                className={cn(
                  "mt-2 size-3 shrink-0 rounded-sm",
                  task.enabled ? "bg-primary" : "bg-muted-foreground",
                )}
              />
              <div className="min-w-0">
                <h3 className="text-balance font-medium text-xl leading-tight">
                  {task.title}
                </h3>
                <p className="mt-2 text-muted-foreground text-sm">
                  {formatScheduleSummary(task, occurrence.viewDayOfWeek)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[
                {
                  icon: PlayIcon,
                  label: "Run roster task now",
                  onClick: onRun,
                },
                {
                  icon: PencilIcon,
                  label: "Edit roster task",
                  onClick: onEdit,
                },
                {
                  icon: PowerIcon,
                  label: task.enabled ? "Pause roster task" : "Resume roster task",
                  onClick: onToggle,
                },
                {
                  icon: Trash2Icon,
                  label: "Delete roster task",
                  onClick: onDelete,
                },
              ].map(({ icon: Icon, label, onClick }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label={label}
                      onClick={onClick}
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                    >
                      <Icon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex items-start gap-3 text-muted-foreground">
              <AlertCircleIcon className="mt-0.5 size-4" />
              <span className="min-w-0">
                <span className="font-medium text-foreground">
                  {cronHealth.label}
                </span>
                {cronHealth.reason ? (
                  <span className="block text-xs">{cronHealth.reason}</span>
                ) : null}
              </span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <MailIcon className="size-4" />
              <span className="truncate">
                {task.email_recipients.length
                  ? task.email_recipients.join(", ")
                  : "No email recipients"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={task.enabled ? "outline" : "secondary"}>
              {task.enabled ? "Enabled" : "Paused"}
            </Badge>
            <Badge variant={cronHealth.variant}>{cronHealth.label}</Badge>
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  return card;
}

function RosterHistorySheet({
  emails,
  isOpen,
  jobs,
  onOpenChange,
  runs,
}: {
  readonly emails: readonly ProjectOutboundEmail[];
  readonly isOpen: boolean;
  readonly jobs: readonly ProjectAgentJob[];
  readonly onOpenChange: (open: boolean) => void;
  readonly runs: readonly ProjectAutomationRun[];
}) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Roster history</SheetTitle>
        </SheetHeader>
        <div className="grid gap-5 px-4 pb-4">
          <section className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <HistoryIcon className="size-4 text-muted-foreground" />
              <h2 className="font-medium text-sm">Dispatcher jobs</h2>
            </div>
            <div className="mt-3 grid gap-3">
              {jobs.length ? (
                jobs.map((job) => (
                  <div
                    className="grid gap-1 border-b pb-3 last:border-0 last:pb-0"
                    key={job.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          job.status === "failed" || job.status === "dead_letter"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {job.status}
                      </Badge>
                      <LocalizedDate
                        className="text-muted-foreground text-xs"
                        options={{ dateStyle: "medium", timeStyle: "short" }}
                        value={job.created_at}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Attempt {job.attempt_count}/{job.max_attempts}
                      {job.eve_session_id
                        ? ` · Eve ${job.eve_session_id.slice(0, 8)}`
                        : " · awaiting Eve"}
                    </p>
                    {job.last_error ? (
                      <p className="line-clamp-2 text-destructive text-xs">
                        {job.last_error}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No dispatcher jobs yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <CalendarClockIcon className="size-4 text-muted-foreground" />
              <h2 className="font-medium text-sm">Latest runs</h2>
            </div>
            <div className="mt-3 grid gap-3">
              {runs.length ? (
                runs.map((run) => (
                  <div
                    className="grid gap-1 border-b pb-3 last:border-0 last:pb-0"
                    key={run.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{run.status}</Badge>
                      <LocalizedDate
                        className="text-muted-foreground text-xs"
                        options={{
                          dateStyle: "medium",
                          timeStyle: "short",
                        }}
                        value={run.started_at}
                      />
                    </div>
                    <p className="line-clamp-3 text-sm">
                      {run.summary || run.error_message || "No summary yet."}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No roster runs yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <MailIcon className="size-4 text-muted-foreground" />
              <h2 className="font-medium text-sm">Email delivery</h2>
            </div>
            <div className="mt-3 grid gap-3">
              {emails.length ? (
                emails.map((email) => (
                  <div
                    className="grid gap-1 border-b pb-3 last:border-0 last:pb-0"
                    key={email.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={email.status === "failed" ? "destructive" : "outline"}>
                        {email.status}
                      </Badge>
                      <LocalizedDate
                        className="text-muted-foreground text-xs"
                        options={{
                          dateStyle: "medium",
                          timeStyle: "short",
                        }}
                        value={email.created_at}
                      />
                    </div>
                    <p className="line-clamp-1 text-sm">{email.subject}</p>
                    <p className="line-clamp-1 text-muted-foreground text-xs">
                      {email.recipients.join(", ")}
                    </p>
                    {email.error_message ? (
                      <p className="line-clamp-2 text-destructive text-xs">
                        {email.error_message}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No report emails yet.</p>
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
