import "server-only";

import crypto from "node:crypto";
import { cache } from "react";
import {
  deleteRosterTaskWithClient,
  normalizeRosterTaskInput,
} from "@/lib/project-roster-core";
import { getAuthedSupabase, verifyProjectOwnership } from "@/lib/project-data";
import { normalizeAutomationRun } from "@/lib/project-automation";
import type {
  RosterDeliveryConfig,
  RosterScheduleConfig,
  RosterTaskConfig,
} from "@eva/core/roster";
import {
  rosterDeliveryConfigSchema,
  rosterScheduleConfigSchema,
  rosterTaskConfigSchema,
} from "@eva/core/roster";
import { createAdminClient } from "@eva/supabase/admin";
import { jsonObject, toJson, type JsonObject } from "@eva/supabase/json";
import type { Tables, TablesUpdate } from "@eva/supabase/types";
import { agentUrl } from "@/lib/public-urls";

export type RosterJobType = "project_checkup";
export type RosterTaskStatus =
  | "canceled"
  | "completed"
  | "failed"
  | "queued"
  | "running";

export type ProjectRosterTask = {
  readonly archived_at: string | null;
  readonly created_at: string;
  readonly cron_expression: string | null;
  readonly cron_job_id: number | null;
  readonly cron_job_name: string | null;
  readonly email_recipients: readonly string[];
  readonly delivery_config: RosterDeliveryConfig;
  readonly enabled: boolean;
  readonly id: string;
  readonly job_type: RosterJobType;
  readonly last_run_at: string | null;
  readonly last_run_id: string | null;
  readonly last_run_status: RosterTaskStatus | null;
  readonly lease_expires_at: string | null;
  readonly lease_token: string | null;
  readonly metadata: JsonObject;
  readonly next_run_at: string | null;
  readonly profile_id: string;
  readonly project_id: string;
  readonly schedule_config: RosterScheduleConfig;
  readonly task_config: RosterTaskConfig;
  readonly timezone: string;
  readonly title: string;
  readonly updated_at: string;
};

export type ProjectOutboundEmail = {
  readonly automation_run_id: string | null;
  readonly created_at: string;
  readonly error_message: string | null;
  readonly id: string;
  readonly profile_id: string;
  readonly project_id: string;
  readonly provider_message_id: string | null;
  readonly recipients: readonly string[];
  readonly roster_task_id: string | null;
  readonly sent_at: string | null;
  readonly status: "failed" | "queued" | "sending" | "sent";
  readonly subject: string;
  readonly text_body: string;
  readonly updated_at: string;
};

export type ProjectAgentJob = {
  readonly attempt_count: number;
  readonly automation_run_id: string | null;
  readonly available_at: string;
  readonly created_at: string;
  readonly eve_session_id: string | null;
  readonly id: string;
  readonly input: JsonObject;
  readonly last_error: string | null;
  readonly max_attempts: number;
  readonly priority_class: "background" | "user_requested";
  readonly profile_id: string;
  readonly project_id: string;
  readonly status:
    | "canceled"
    | "claimed"
    | "completed"
    | "dead_letter"
    | "failed"
    | "queued"
    | "running"
    | "waiting";
  readonly updated_at: string;
};

type RosterTaskInput = {
  readonly brief?: string;
  readonly deliveryConfig?: Record<string, unknown>;
  readonly emailRecipients?: readonly string[] | string;
  readonly enabled?: boolean;
  readonly focus?: string;
  readonly jobType?: RosterJobType;
  readonly metadata?: Record<string, unknown>;
  readonly scheduleConfig: Record<string, unknown>;
  readonly taskConfig?: Record<string, unknown>;
  readonly timezone: string;
  readonly title: string;
};

function rosterTaskStatus(value: string | null): RosterTaskStatus | null {
  if (value === null) return null;
  if (["canceled", "completed", "failed", "queued", "running"].includes(value)) {
    return value as RosterTaskStatus;
  }
  throw new Error(`Unsupported roster task status: ${value}`);
}

function normalizeProjectRosterTask(
  row: Tables<"project_roster_tasks">,
): ProjectRosterTask {
  if (row.job_type !== "project_checkup") {
    throw new Error(`Unsupported roster job type: ${row.job_type}`);
  }

  return {
    ...row,
    delivery_config: rosterDeliveryConfigSchema.parse(row.delivery_config),
    job_type: row.job_type,
    last_run_status: rosterTaskStatus(row.last_run_status),
    metadata: jsonObject(row.metadata),
    schedule_config: rosterScheduleConfigSchema.parse(row.schedule_config),
    task_config: rosterTaskConfigSchema.parse(row.task_config),
  };
}

function normalizeProjectAgentJob(
  row: Tables<"project_agent_jobs">,
): ProjectAgentJob {
  const statuses: ProjectAgentJob["status"][] = [
    "canceled",
    "claimed",
    "completed",
    "dead_letter",
    "failed",
    "queued",
    "running",
    "waiting",
  ];
  if (!statuses.includes(row.status as ProjectAgentJob["status"])) {
    throw new Error(`Unsupported agent job status: ${row.status}`);
  }
  if (row.priority_class !== "background" && row.priority_class !== "user_requested") {
    throw new Error(`Unsupported agent job priority: ${row.priority_class}`);
  }

  return {
    ...row,
    input: jsonObject(row.input),
    priority_class: row.priority_class,
    status: row.status as ProjectAgentJob["status"],
  };
}

function normalizeProjectOutboundEmail(
  row: Tables<"project_outbound_emails">,
): ProjectOutboundEmail {
  if (!["failed", "queued", "sending", "sent"].includes(row.status)) {
    throw new Error(`Unsupported outbound email status: ${row.status}`);
  }

  return {
    ...row,
    status: row.status as ProjectOutboundEmail["status"],
  };
}

function getRosterTickUrl() {
  const base = (process.env.EVE_BASE_URL?.trim() || agentUrl).replace(/\/$/u, "");
  return base ? `${base}/eve/v1/roster/tick` : "";
}

export async function triggerRosterDispatcher() {
  const url = getRosterTickUrl();
  const secret = process.env.ROSTER_DISPATCH_SECRET;

  if (!url || !secret || process.env.EVA_E2E === "1") {
    return { dispatched: false, reason: "Roster tick is not configured." };
  }

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${secret}` },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Roster dispatcher returned HTTP ${response.status}.`);
  }

  return { dispatched: true, result: await response.json() };
}

async function requireOwnedProject(projectId: string) {
  const { user } = await getAuthedSupabase();
  const ownedProject = await verifyProjectOwnership({
    profileId: user.id,
    projectId,
  });

  if (!ownedProject) {
    throw new Error("Project not found.");
  }

  return { profileId: user.id, projectId };
}

export const listProjectRosterTasks = cache(async (projectId: string) => {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("project_roster_tasks")
    .select("*")
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(normalizeProjectRosterTask).sort((a, b) => {
    return (a.next_run_at ?? "~").localeCompare(b.next_run_at ?? "~");
  });
});

export const listProjectAgentJobs = cache(async (projectId: string) => {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("project_agent_jobs")
    .select("*")
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeProjectAgentJob);
});

export const listProjectOutboundEmails = cache(async (projectId: string) => {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("project_outbound_emails")
    .select("*")
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(normalizeProjectOutboundEmail);
});

export async function createProjectRosterTask(input: RosterTaskInput & {
  readonly projectId: string;
}) {
  const scope = await requireOwnedProject(input.projectId);
  const normalized = normalizeRosterTaskInput(input);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await admin
    .from("project_roster_tasks")
    .insert({
      cron_expression: normalized.cronExpression,
      delivery_config: toJson(normalized.deliveryConfig),
      email_recipients: normalized.emailRecipients,
      enabled: normalized.enabled,
      job_type: normalized.jobType,
      metadata: toJson(input.metadata ?? {}),
      next_run_at: normalized.nextRunAt,
      profile_id: scope.profileId,
      project_id: scope.projectId,
      schedule_config: toJson(normalized.scheduleConfig),
      task_config: toJson(normalized.taskConfig),
      timezone: normalized.timezone,
      title: normalized.title,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeProjectRosterTask(data);
}

export async function updateProjectRosterTask(input: Partial<RosterTaskInput> & {
  readonly projectId: string;
  readonly taskId: string;
}) {
  const scope = await requireOwnedProject(input.projectId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data: existing, error: existingError } = await admin
    .from("project_roster_tasks")
    .select("*")
    .eq("id", input.taskId)
    .eq("profile_id", scope.profileId)
    .eq("project_id", scope.projectId)
    .is("archived_at", null)
    .single();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingTask = normalizeProjectRosterTask(existing);
  const normalized = normalizeRosterTaskInput({
    deliveryConfig: input.deliveryConfig ?? existingTask.delivery_config,
    emailRecipients:
      input.emailRecipients === undefined
        ? existingTask.email_recipients
        : input.emailRecipients,
    enabled: input.enabled ?? existingTask.enabled,
    jobType: input.jobType ?? existingTask.job_type,
    scheduleConfig: input.scheduleConfig ?? existingTask.schedule_config,
    taskConfig: input.taskConfig ?? existingTask.task_config,
    timezone: input.timezone ?? existingTask.timezone,
    title: input.title ?? existingTask.title,
  });
  const patch: TablesUpdate<"project_roster_tasks"> = {
    cron_expression: normalized.cronExpression,
    delivery_config: toJson(normalized.deliveryConfig),
    email_recipients: normalized.emailRecipients,
    enabled: normalized.enabled,
    job_type: normalized.jobType,
    metadata: toJson(
      input.metadata !== undefined
        ? { ...existingTask.metadata, ...input.metadata }
        : existingTask.metadata,
    ),
    next_run_at: normalized.enabled ? normalized.nextRunAt : existingTask.next_run_at,
    schedule_config: toJson(normalized.scheduleConfig),
    task_config: toJson(normalized.taskConfig),
    timezone: normalized.timezone,
    title: normalized.title,
  };

  const { data, error } = await admin
    .from("project_roster_tasks")
    .update(patch)
    .eq("id", input.taskId)
    .eq("profile_id", scope.profileId)
    .eq("project_id", scope.projectId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeProjectRosterTask(data);
}

export async function deleteProjectRosterTask(input: {
  readonly projectId: string;
  readonly taskId: string;
}) {
  const scope = await requireOwnedProject(input.projectId);
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await admin
    .from("project_roster_tasks")
    .select("*")
    .eq("id", input.taskId)
    .eq("profile_id", scope.profileId)
    .eq("project_id", scope.projectId)
    .is("archived_at", null)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const deleted = await deleteRosterTaskWithClient({
    supabase: admin,
    task: normalizeProjectRosterTask(data),
  });
  return normalizeProjectRosterTask(deleted);
}

async function enqueueProjectAgentJob(input: {
  readonly idempotencyKey: string;
  readonly priorityClass: "background" | "user_requested";
  readonly profileId: string;
  readonly projectId: string;
  readonly runId: string;
  readonly taskId?: string;
  readonly taskConfig?: RosterTaskConfig;
}) {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await admin
    .from("project_agent_jobs")
    .insert({
      automation_run_id: input.runId,
      idempotency_key: input.idempotencyKey,
      input: toJson({
        execution_source: "roster",
        ...(input.taskId ? { task_id: input.taskId } : {}),
        ...(input.taskConfig ? { task_config: input.taskConfig } : {}),
      }),
      job_type: "roster_task",
      priority_class: input.priorityClass,
      profile_id: input.profileId,
      project_id: input.projectId,
      status: "queued",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeProjectAgentJob(data);
}

export async function enqueueProjectRosterTaskNow(input: {
  readonly projectId: string;
  readonly taskId: string;
}) {
  const scope = await requireOwnedProject(input.projectId);
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured.");

  const taskResult = await admin
    .from("project_roster_tasks")
    .select("*")
    .eq("id", input.taskId)
    .eq("profile_id", scope.profileId)
    .eq("project_id", scope.projectId)
    .is("archived_at", null)
    .single();
  if (taskResult.error) throw new Error(taskResult.error.message);
  const task = normalizeProjectRosterTask(taskResult.data);

  const runResult = await admin
    .from("project_automation_runs")
    .insert({
      input_snapshot: {},
      metadata: { kind: "roster_task", roster_task_id: task.id, source: "run_now" },
      profile_id: scope.profileId,
      project_id: scope.projectId,
      status: "queued",
      trigger_id: task.id,
      trigger_type: "manual",
    })
    .select("*")
    .single();
  if (runResult.error) throw new Error(runResult.error.message);

  const requestId = crypto.randomUUID();
  const job = await enqueueProjectAgentJob({
    idempotencyKey: `roster-now:${task.id}:${requestId}`,
    priorityClass: "user_requested",
    profileId: scope.profileId,
    projectId: scope.projectId,
    runId: runResult.data.id,
    taskId: task.id,
  });

  void triggerRosterDispatcher().catch((error) => {
    console.error("[eva] Failed to wake roster dispatcher.", error);
  });

  return { job, run: normalizeAutomationRun(runResult.data), task };
}

export async function enqueueManualProjectCheckup(input: {
  readonly profileId: string;
  readonly projectId: string;
}) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured.");

  const runResult = await admin
    .from("project_automation_runs")
    .insert({
      input_snapshot: {},
      metadata: { kind: "manual_project_checkup", source: "manual_checkup" },
      profile_id: input.profileId,
      project_id: input.projectId,
      status: "queued",
      trigger_type: "manual",
    })
    .select("*")
    .single();
  if (runResult.error) throw new Error(runResult.error.message);

  const job = await enqueueProjectAgentJob({
    idempotencyKey: `manual-checkup:${runResult.data.id}`,
    priorityClass: "user_requested",
    profileId: input.profileId,
    projectId: input.projectId,
    runId: runResult.data.id,
    taskConfig: {
      executor: "project_review.v1",
      focus: "general_checkup",
      version: 1,
    },
  });

  void triggerRosterDispatcher().catch((error) => {
    console.error("[eva] Failed to wake roster dispatcher.", error);
  });

  return { job, run: normalizeAutomationRun(runResult.data) };
}
