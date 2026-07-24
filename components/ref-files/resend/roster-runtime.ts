import type { SessionContext } from "eve/context";
import { Resend } from "resend";
import { rosterResultSchema, type RosterResult } from "@eva/core/roster";
import { isJsonObject } from "@eva/supabase/json";
import { getServiceClient } from "./project-scope.js";

function rosterAttributes(ctx: Pick<SessionContext, "session">) {
  const auth = ctx.session.auth.current;
  const attributes = auth?.attributes;
  const jobId = attributes?.job_id;
  const leaseToken = attributes?.lease_token;
  const projectId = attributes?.project_id;
  const runId = attributes?.automation_run_id;

  if (
    auth?.authenticator !== "eva-roster" ||
    auth.principalType !== "user" ||
    attributes?.execution_source !== "roster" ||
    typeof jobId !== "string" ||
    typeof leaseToken !== "string" ||
    typeof projectId !== "string" ||
    typeof runId !== "string"
  ) {
    throw new Error("A verified roster execution is required.");
  }

  return {
    jobId,
    leaseToken,
    profileId: auth.principalId,
    projectId,
    rosterTaskId:
      typeof attributes.roster_task_id === "string"
        ? attributes.roster_task_id
        : null,
    runId,
  };
}

function resultEmail(input: {
  projectName: string;
  result: RosterResult;
  taskTitle: string;
}) {
  const findings = input.result.findings.map(
    (finding) => `- [${finding.category}] ${finding.text}`,
  );
  const recommendations = input.result.recommendations.map(
    (recommendation) => `- ${recommendation}`,
  );
  return {
    subject: `${input.projectName}: ${input.taskTitle}`,
    text: [
      input.result.summary,
      findings.length ? `\nFindings\n${findings.join("\n")}` : "",
      recommendations.length
        ? `\nRecommendations\n${recommendations.join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function deliverResultEmail(input: {
  result: RosterResult;
  rosterTaskId: string | null;
  runId: string;
  scope: ReturnType<typeof rosterAttributes>;
}) {
  if (!input.rosterTaskId) return null;
  const supabase = getServiceClient();
  const [taskResult, projectResult] = await Promise.all([
    supabase
      .from("project_roster_tasks")
      .select("title, delivery_config")
      .eq("id", input.rosterTaskId)
      .eq("profile_id", input.scope.profileId)
      .eq("project_id", input.scope.projectId)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("name")
      .eq("id", input.scope.projectId)
      .eq("profile_id", input.scope.profileId)
      .maybeSingle(),
  ]);
  if (taskResult.error) throw new Error(taskResult.error.message);
  if (projectResult.error) throw new Error(projectResult.error.message);
  const deliveryConfig = taskResult.data?.delivery_config;
  const email = isJsonObject(deliveryConfig) && isJsonObject(deliveryConfig.email)
    ? deliveryConfig.email
    : null;
  if (email?.enabled !== true || !Array.isArray(email.recipients)) return null;
  const recipients = email.recipients.filter(
    (recipient): recipient is string => typeof recipient === "string",
  );
  if (!recipients.length) return null;

  const content = resultEmail({
    projectName: projectResult.data?.name ?? "Project",
    result: input.result,
    taskTitle: taskResult.data?.title ?? "Roster result",
  });
  const created = await supabase
    .from("project_outbound_emails")
    .insert({
      automation_run_id: input.runId,
      kind: "checkup_report",
      profile_id: input.scope.profileId,
      project_id: input.scope.projectId,
      recipients,
      roster_task_id: input.rosterTaskId,
      status: "queued",
      subject: content.subject,
      text_body: content.text,
    })
    .select("*")
    .single();

  if (created.error) {
    const existing = await supabase
      .from("project_outbound_emails")
      .select("*")
      .eq("automation_run_id", input.runId)
      .eq("kind", "checkup_report")
      .maybeSingle();
    if (existing.data) return existing.data;
    throw new Error(created.error.message);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_APP_FROM_EMAIL;
  if (!apiKey || !from) {
    await supabase
      .from("project_outbound_emails")
      .update({ error_message: "Email delivery is not configured.", status: "failed" })
      .eq("id", created.data.id);
    return { ...created.data, status: "failed" };
  }

  await supabase
    .from("project_outbound_emails")
    .update({ status: "sending" })
    .eq("id", created.data.id);

  try {
    const sent = await new Resend(apiKey).emails.send({
      from,
      subject: content.subject,
      text: content.text,
      to: recipients,
    });
    if (sent.error) throw new Error(sent.error.message);
    const completed = await supabase
      .from("project_outbound_emails")
      .update({
        provider_message_id: sent.data?.id ?? null,
        sent_at: new Date().toISOString(),
        status: "sent",
      })
      .eq("id", created.data.id)
      .select("*")
      .single();
    if (completed.error) throw new Error(completed.error.message);
    return completed.data;
  } catch (error) {
    const failed = await supabase
      .from("project_outbound_emails")
      .update({
        error_message: error instanceof Error ? error.message : "Email send failed.",
        status: "failed",
      })
      .eq("id", created.data.id)
      .select("*")
      .single();
    return failed.data;
  }
}

export async function completeRosterRun(value: unknown, ctx: SessionContext) {
  const result = rosterResultSchema.parse(value);
  const scope = rosterAttributes(ctx);
  const supabase = getServiceClient();
  const existing = await supabase
    .from("project_agent_jobs")
    .select("status, output")
    .eq("id", scope.jobId)
    .eq("profile_id", scope.profileId)
    .eq("project_id", scope.projectId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.status === "completed") {
    return { completed: true, replay: true, result: existing.data.output };
  }

  const completed = await supabase.rpc("complete_project_agent_job", {
    p_job_id: scope.jobId,
    p_lease_token: scope.leaseToken,
    p_result: result,
  });
  if (completed.error) throw new Error(completed.error.message);
  const email = await deliverResultEmail({
    result,
    rosterTaskId: scope.rosterTaskId,
    runId: scope.runId,
    scope,
  });
  return { completed: true, emailStatus: email?.status ?? null, result };
}

export async function failRosterRun(
  ctx: Pick<SessionContext, "session">,
  error: string,
) {
  let scope: ReturnType<typeof rosterAttributes>;
  try {
    scope = rosterAttributes(ctx);
  } catch {
    return;
  }
  const supabase = getServiceClient();
  const result = await supabase.rpc("fail_project_agent_job", {
    p_error: error,
    p_job_id: scope.jobId,
    p_lease_token: scope.leaseToken,
  });
  if (result.error) throw new Error(result.error.message);
}
