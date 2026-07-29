import { Buffer } from "node:buffer"

import { NextResponse } from "next/server"
import { z } from "zod"

import { replayOfflineJobOperationAction } from "@/app/dashboard/jobs/offline-actions"
import {
  addJobCommentAction,
  archiveJobAction,
  createJobAction,
  reassignJobAction,
  removeJobEvidenceAction,
  reopenJobAction,
  retryJobNotificationAction,
  updateJobAction,
} from "@/app/dashboard/jobs/actions"
import { archiveEmployeeRosterShiftAction } from "@/app/dashboard/employees/roster-actions"
import {
  createCalendarRosterShiftAction,
  editCalendarRosterShiftAction,
  setCalendarRosterShiftLockAction,
  updateCalendarRosterShiftAction,
} from "@/app/dashboard/roster/actions"
import {
  changeMembershipRoleAction,
  createEmployeeAction,
  deleteInvitedEmployeeAction,
  resendEmployeeInvitationAction,
  setEmployeeActiveAction,
  updateEmployeeAction,
} from "@/app/dashboard/employees/actions"
import { updateOwnProfileAction } from "@/app/dashboard/profile/actions"
import { INITIAL_ACTION_STATE } from "@/lib/forms/action-state"
import {
  deleteScheduleAction,
  retryScheduleAction,
  saveScheduleAction,
  saveTemplateAction,
  setScheduleEnabledAction,
  setTemplateActiveAction,
} from "@/app/dashboard/templates/actions"
import { INITIAL_TEMPLATE_ACTION_STATE } from "@/lib/templates/types"
import { getMembershipContext } from "@/lib/auth/membership"
import { buildOfflineV2Snapshot } from "@/lib/offline-v2/bootstrap"
import type {
  OfflineConflict,
  OfflineSyncResult,
  OfflineV2Operation,
} from "@/lib/offline-v2/types"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/database.types"

export const dynamic = "force-dynamic"

const operationSchema = z.object({
  clientOperationId: z.string().uuid(),
  createdAt: z.string().datetime(),
  dependsOn: z.array(z.string().uuid()),
  entity: z.discriminatedUnion("source", [
    z.object({ id: z.number().int().positive(), source: z.literal("server") }),
    z.object({ id: z.string().min(1), source: z.literal("local") }),
  ]),
  entityType: z.enum([
    "job",
    "roster_shift",
    "membership",
    "employee_profile",
    "job_template",
    "job_schedule",
    "profile",
    "notification",
  ]),
  expectedVersion: z.number().int().positive().nullable(),
  kind: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  state: z.enum(["pending", "syncing", "failed", "needs_attention"]),
})

const requestSchema = z.object({
  operations: z.array(operationSchema).max(500),
  revision: z.number().int().nonnegative(),
})

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { message: "The offline operation batch is invalid." },
        { status: 400 }
      )
    }
    const membership = await getMembershipContext()
    if (!membership) {
      return NextResponse.json(
        { message: "Active membership required." },
        { status: 401 }
      )
    }
    const operations = orderByDependencies(
      parsed.data.operations as OfflineV2Operation[]
    )
    const conflicts: OfflineConflict[] = []
    const idMappings: Record<string, number> = {}
    const operationResults: OfflineSyncResult["operationResults"] = []
    const acknowledged = new Set<string>()
    const currentJobVersions = new Map<number, number>()
    const supabase = await createClient()

    for (const originalOperation of operations) {
      const storedOperation = resolveOperationIds(
        originalOperation,
        idMappings
      )
      const operation =
        storedOperation.entityType === "job" &&
        storedOperation.entity.source === "server" &&
        currentJobVersions.has(storedOperation.entity.id)
          ? {
              ...storedOperation,
              expectedVersion:
                currentJobVersions.get(storedOperation.entity.id) ?? null,
            }
          : storedOperation
      if (
        operation.dependsOn.some(
          (dependency) => !acknowledged.has(dependency)
        )
      ) {
        operationResults.push({
          clientOperationId: operation.clientOperationId,
          error: "A required earlier change has not synchronised.",
          status: "failed",
        })
        continue
      }

      const usesAtomicWorkerReplay =
        operation.entity.source === "server" &&
        ["job.start", "job.note", "job.evidence.add", "job.submit"].includes(
          operation.kind
        )
      let result: OfflineSyncResult["operationResults"][number]
      const versionConflict = usesAtomicWorkerReplay
        ? null
        : await findVersionConflict(supabase, operation)
      if (versionConflict) {
        result = {
          clientOperationId: operation.clientOperationId,
          error: "version_conflict",
          result: versionConflict,
          status: "conflict",
        }
      } else if (usesAtomicWorkerReplay) {
        const { data: claim, error: claimError } = await supabase.rpc(
          "claim_offline_operation",
          {
            p_client_operation_id: operation.clientOperationId,
            p_entity_id: String(operation.entity.id),
            p_entity_type: operation.entityType,
            p_operation_type: operation.kind,
          }
        )
        const receipt = claim?.[0]
        const saved = receipt?.result as
          | {
              operationResult?: OfflineSyncResult["operationResults"][number]
              status?: string
            }
          | undefined
        if (claimError || !receipt) {
          result = {
            clientOperationId: operation.clientOperationId,
            error: "The operation receipt could not be reserved.",
            status: "failed",
          }
        } else if (!receipt.claimed && saved?.status === "acknowledged") {
          result =
            saved.operationResult ??
            ({
              clientOperationId: operation.clientOperationId,
              status: "acknowledged",
            } as const)
        } else {
          // The worker replay RPC owns the authoritative transaction and its
          // legacy receipt, so retrying an interrupted general receipt is safe.
          result = await replayOperation(operation, membership.membershipId)
          await supabase.rpc("complete_offline_operation", {
            p_client_operation_id: operation.clientOperationId,
            p_result: JSON.parse(
              JSON.stringify({
                operationResult: result,
                status: result.status,
              })
            ) as Json,
          })
        }
      } else {
        const { data: claim, error: claimError } = await supabase.rpc(
          "claim_offline_operation",
          {
            p_client_operation_id: operation.clientOperationId,
            p_entity_id: String(operation.entity.id),
            p_entity_type: operation.entityType,
            p_operation_type: operation.kind,
          }
        )
        const receipt = claim?.[0]
        if (claimError || !receipt) {
          result = {
            clientOperationId: operation.clientOperationId,
            error: "The operation receipt could not be reserved.",
            status: "failed",
          }
        } else if (!receipt.claimed) {
          const saved = receipt.result as {
            operationResult?: OfflineSyncResult["operationResults"][number]
            status?: string
          }
          result =
            saved.operationResult ??
            ({
              clientOperationId: operation.clientOperationId,
              error:
                saved.status === "processing"
                  ? "A previous replay was interrupted and needs attention."
                  : "This operation was already processed.",
              status:
                saved.status === "acknowledged"
                  ? "acknowledged"
                  : "needs_attention",
            } as const)
        } else {
          result = await replayOperation(operation, membership.membershipId)
          await supabase.rpc("complete_offline_operation", {
            p_client_operation_id: operation.clientOperationId,
            p_result: JSON.parse(
              JSON.stringify({
                operationResult: result,
                status: result.status,
              })
            ) as Json,
          })
        }
      }
      operationResults.push(result)
      if (result.status === "acknowledged") {
        acknowledged.add(operation.clientOperationId)
        if (
          operation.entityType === "job" &&
          operation.entity.source === "server" &&
          typeof result.result?.version === "number"
        ) {
          currentJobVersions.set(operation.entity.id, result.result.version)
        }
        const destinationId =
          result.result?.destinationId ??
          (isRecord(result.result?.job)
            ? result.result.job.id
            : undefined)
        if (
          operation.entity.source === "local" &&
          typeof destinationId === "number"
        ) {
          idMappings[operation.entity.id] = destinationId
          const temporaryId = operation.payload.temporaryId
          if (typeof temporaryId === "number") {
            idMappings[String(temporaryId)] = destinationId
          }
        }
      } else if (result.status === "conflict") {
        conflicts.push({
          clientOperationId: operation.clientOperationId,
          createdAt: new Date().toISOString(),
          entity: operation.entity,
          entityType: operation.entityType,
          local: operation.payload,
          reason: result.error ?? "version_conflict",
          remote: result.result ?? {},
        })
      }
    }

    const { data: changes } = await supabase.rpc(
      "get_offline_sync_changes",
      { p_after_revision: parsed.data.revision }
    )
    const snapshot = await buildOfflineV2Snapshot()
    const response: OfflineSyncResult = {
      changes: (changes ?? []).map((change) => ({
        changedAt: change.changed_at,
        entityId: change.entity_id,
        entityType: change.entity_type,
        operation:
          change.operation === "delete" ? "delete" : "upsert",
        revision: change.revision,
      })),
      conflicts,
      idMappings,
      leaseExpiresAt: snapshot.leaseExpiresAt,
      operationResults,
      revision: snapshot.revision,
      snapshot,
    }
    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    console.error("Offline sync failed", error)
    return NextResponse.json(
      { message: "Offline synchronisation failed." },
      { status: 500 }
    )
  }
}

async function replayOperation(
  operation: OfflineV2Operation,
  actorMembershipId: number
): Promise<OfflineSyncResult["operationResults"][number]> {
  if (
    operation.entity.source === "server" &&
    ["job.start", "job.note", "job.evidence.add", "job.submit"].includes(
      operation.kind
    )
  ) {
    const kind =
      operation.kind === "job.evidence.add"
        ? "photo"
        : operation.kind.slice("job.".length)
    const replay = await replayOfflineJobOperationAction({
      clientOperationId: operation.clientOperationId,
      expectedVersion: operation.expectedVersion,
      jobId: operation.entity.id,
      kind,
      payload: operation.payload,
    })
    if (!replay.ok) {
      return {
        clientOperationId: operation.clientOperationId,
        error: replay.message,
        status: "failed",
      }
    }
    return {
      clientOperationId: operation.clientOperationId,
      result: replay.replay.result,
      status:
        replay.replay.operation_status === "acknowledged"
          ? "acknowledged"
          : replay.replay.operation_status === "conflict"
            ? "conflict"
            : "needs_attention",
    }
  }
  if (operation.kind === "template.create") {
    return actionResult(
      operation,
      await saveTemplateAction(
        null,
        INITIAL_TEMPLATE_ACTION_STATE,
        payloadFormData(operation.payload)
      )
    )
  }
  if (
    operation.kind === "template.update" &&
    operation.entity.source === "server"
  ) {
    return actionResult(
      operation,
      await saveTemplateAction(
        operation.entity.id,
        INITIAL_TEMPLATE_ACTION_STATE,
        payloadFormData(operation.payload)
      )
    )
  }
  if (
    operation.kind === "template.active" &&
    operation.entity.source === "server"
  ) {
    await setTemplateActiveAction(
      operation.entity.id,
      Boolean(operation.payload.isActive)
    )
    return actionResult(operation, { ok: true })
  }
  if (operation.kind === "schedule.create") {
    return actionResult(
      operation,
      await saveScheduleAction(
        null,
        INITIAL_TEMPLATE_ACTION_STATE,
        payloadFormData(operation.payload)
      )
    )
  }
  if (
    operation.kind === "schedule.update" &&
    operation.entity.source === "server"
  ) {
    return actionResult(
      operation,
      await saveScheduleAction(
        operation.entity.id,
        INITIAL_TEMPLATE_ACTION_STATE,
        payloadFormData(operation.payload)
      )
    )
  }
  if (
    operation.kind === "schedule.enabled" &&
    operation.entity.source === "server"
  ) {
    await setScheduleEnabledAction(
      operation.entity.id,
      Boolean(operation.payload.isEnabled)
    )
    return actionResult(operation, { ok: true })
  }
  if (
    operation.kind === "schedule.delete" &&
    operation.entity.source === "server"
  ) {
    await deleteScheduleAction(operation.entity.id)
    return actionResult(operation, { ok: true })
  }
  if (
    operation.kind === "schedule.retry" &&
    operation.entity.source === "server"
  ) {
    await retryScheduleAction(operation.entity.id)
    return actionResult(operation, { ok: true })
  }
  if (operation.kind === "membership.create") {
    return actionResult(
      operation,
      await createEmployeeAction(
        INITIAL_ACTION_STATE,
        payloadFormData(operation.payload)
      )
    )
  }
  if (
    operation.kind === "membership.update" &&
    operation.entity.source === "server"
  ) {
    return actionResult(
      operation,
      await updateEmployeeAction(
        operation.entity.id,
        INITIAL_ACTION_STATE,
        payloadFormData(operation.payload)
      )
    )
  }
  if (
    operation.kind === "membership.access" &&
    operation.entity.source === "server"
  ) {
    return actionResult(
      operation,
      await setEmployeeActiveAction(
        operation.entity.id,
        Boolean(operation.payload.active)
      )
    )
  }
  if (
    operation.kind === "membership.role" &&
    operation.entity.source === "server"
  ) {
    return actionResult(
      operation,
      await changeMembershipRoleAction(
        operation.entity.id,
        String(operation.payload.role) as "owner" | "manager" | "employee"
      )
    )
  }
  if (
    operation.kind === "membership.delete_invited" &&
    operation.entity.source === "server"
  ) {
    return actionResult(
      operation,
      await deleteInvitedEmployeeAction(operation.entity.id)
    )
  }
  if (
    operation.kind === "membership.invitation.resend" &&
    operation.entity.source === "server"
  ) {
    return actionResult(
      operation,
      await resendEmployeeInvitationAction(
        operation.entity.id,
        INITIAL_ACTION_STATE,
        new FormData()
      )
    )
  }

  if (operation.entity.source === "server" && operation.kind === "job.comment") {
    return actionResult(
      operation,
      await addJobCommentAction(
        operation.entity.id,
        String(operation.payload.body ?? "")
      )
    )
  }
  if (
    operation.entity.source === "server" &&
    operation.kind === "job.evidence.remove"
  ) {
    return actionResult(
      operation,
      await removeJobEvidenceAction(
        operation.entity.id,
        Number(operation.payload.assetId)
      )
    )
  }
  if (operation.entity.source === "server" && operation.kind === "job.reopen") {
    return actionResult(
      operation,
      await reopenJobAction({
        assigneeMembershipId: Number(
          operation.payload.assigneeMembershipId
        ),
        feedback: String(operation.payload.feedback ?? ""),
        jobId: operation.entity.id,
        submissionVersion: Number(operation.payload.submissionVersion),
      })
    )
  }
  if (operation.entity.source === "server" && operation.kind === "job.archive") {
    return actionResult(
      operation,
      await archiveJobAction(
        operation.entity.id,
        Number(operation.payload.submissionVersion)
      )
    )
  }
  if (operation.kind === "job.notification.retry") {
    return actionResult(
      operation,
      await retryJobNotificationAction(
        Number(operation.payload.deliveryId)
      )
    )
  }
  if (operation.kind === "job.reassign" && operation.entity.source === "server") {
    return actionResult(
      operation,
      await reassignJobAction(
        operation.entity.id,
        operation.payload.assigneeMembershipId === null
          ? null
          : Number(operation.payload.assigneeMembershipId)
      )
    )
  }
  if (operation.kind === "job.create") {
    return actionResult(
      operation,
      await createJobAction(
        { message: "", ok: false },
        payloadFormData(operation.payload)
      )
    )
  }
  if (operation.kind === "job.update" && operation.entity.source === "server") {
    return actionResult(
      operation,
      await updateJobAction(
        operation.entity.id,
        { message: "", ok: false },
        payloadFormData(operation.payload)
      )
    )
  }
  if (operation.kind === "roster.create") {
    return actionResult(
      operation,
      await createCalendarRosterShiftAction(
        { message: "", ok: false },
        payloadFormData(operation.payload)
      )
    )
  }
  if (
    operation.kind === "roster.update" &&
    operation.entity.source === "server"
  ) {
    if ("date" in operation.payload) {
      const formData = payloadFormData(operation.payload)
      return actionResult(
        operation,
        await editCalendarRosterShiftAction(
          operation.entity.id,
          Number(operation.payload.originalEmployeeMembershipId),
          String(operation.payload.updatedAt ?? ""),
          INITIAL_ACTION_STATE,
          formData
        )
      )
    }
    return actionResult(
      operation,
      await updateCalendarRosterShiftAction({
        employeeMembershipId: Number(
          operation.payload.employeeMembershipId
        ),
        endsAt: String(operation.payload.endsAt ?? ""),
        shiftId: operation.entity.id,
        startsAt: String(operation.payload.startsAt ?? ""),
        updatedAt: String(operation.payload.updatedAt ?? ""),
      })
    )
  }
  if (
    operation.kind === "roster.lock" &&
    operation.entity.source === "server"
  ) {
    return actionResult(
      operation,
      await setCalendarRosterShiftLockAction({
        employeeMembershipId: Number(
          operation.payload.employeeMembershipId
        ),
        locked: Boolean(operation.payload.locked),
        shiftId: operation.entity.id,
        updatedAt: String(operation.payload.updatedAt ?? ""),
      })
    )
  }
  if (
    operation.kind === "roster.archive" &&
    operation.entity.source === "server"
  ) {
    return actionResult(
      operation,
      await archiveEmployeeRosterShiftAction(
        Number(operation.payload.employeeMembershipId),
        operation.entity.id,
        String(operation.payload.updatedAt ?? "")
      )
    )
  }

  if (
    operation.kind === "profile.update" &&
    operation.entity.source === "server" &&
    operation.entity.id === actorMembershipId
  ) {
    return actionResult(
      operation,
      await updateOwnProfileAction(
        INITIAL_ACTION_STATE,
        payloadFormData(operation.payload)
      )
    )
  }

  return {
    clientOperationId: operation.clientOperationId,
    error: "This queued operation requires the offline-v2 replay migration.",
    status: "needs_attention",
  }
}

function actionResult(
  operation: OfflineV2Operation,
  result: { message?: string; ok: boolean; [key: string]: unknown }
): OfflineSyncResult["operationResults"][number] {
  return result.ok
    ? {
        clientOperationId: operation.clientOperationId,
        result: { ...result, message: result.message ?? "Applied" },
        status: "acknowledged",
      }
    : {
        clientOperationId: operation.clientOperationId,
        error: result.message ?? "The queued change could not be applied.",
        status: "needs_attention",
      }
}

function payloadFormData(payload: Record<string, unknown>) {
  const formData = new FormData()
  const avatarDataUrl =
    typeof payload.avatarDataUrl === "string" ? payload.avatarDataUrl : null
  const avatarMatch = avatarDataUrl?.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
  )
  if (avatarMatch) {
    formData.set(
      "avatar",
      new File(
        [Buffer.from(avatarMatch[2], "base64")],
        String(payload.avatarName ?? "offline-avatar"),
        { type: avatarMatch[1] }
      )
    )
  }
  for (const [key, value] of Object.entries(payload)) {
    if (key === "avatarDataUrl" || key === "avatarName") continue
    if (Array.isArray(value)) {
      for (const item of value) formData.append(key, String(item))
    } else if (typeof value === "boolean") {
      if (value) formData.set(key, "true")
    } else if (value !== null && value !== undefined) {
      formData.set(key, String(value))
    }
  }
  return formData
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function resolveOperationIds(
  operation: OfflineV2Operation,
  mappings: Record<string, number>
): OfflineV2Operation {
  const mappedEntityId = mappings[String(operation.entity.id)]
  return {
    ...operation,
    entity:
      mappedEntityId === undefined
        ? operation.entity
        : { id: mappedEntityId, source: "server" },
    payload: rewriteMappedValues(operation.payload, mappings) as Record<
      string,
      unknown
    >,
  }
}

function rewriteMappedValues(
  value: unknown,
  mappings: Record<string, number>
): unknown {
  if (typeof value === "number" || typeof value === "string") {
    return mappings[String(value)] ?? value
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteMappedValues(item, mappings))
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        rewriteMappedValues(item, mappings),
      ])
    )
  }
  return value
}

async function findVersionConflict(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operation: OfflineV2Operation
) {
  if (
    operation.expectedVersion === null ||
    operation.entity.source !== "server"
  ) {
    return null
  }
  const id = operation.entity.id
  const result =
    operation.entityType === "job"
      ? await supabase.from("jobs").select("id, version").eq("id", id).maybeSingle()
      : operation.entityType === "roster_shift"
        ? await supabase
            .from("roster_shifts")
            .select("id, version")
            .eq("id", id)
            .maybeSingle()
        : operation.entityType === "membership"
          ? await supabase
              .from("memberships")
              .select("id, version")
              .eq("id", id)
              .maybeSingle()
          : operation.entityType === "employee_profile" ||
              operation.entityType === "profile"
            ? await supabase
                .from("employee_profiles")
                .select("membership_id, version")
                .eq("membership_id", id)
                .maybeSingle()
            : operation.entityType === "job_template"
              ? await supabase
                  .from("job_templates")
                  .select("id, version")
                  .eq("id", id)
                  .maybeSingle()
              : operation.entityType === "job_schedule"
                ? await supabase
                    .from("job_schedules")
                    .select("id, version")
                    .eq("id", id)
                    .maybeSingle()
                : null
  if (!result || result.error || !result.data) {
    return { reason: "entity_unavailable" }
  }
  return result.data.version === operation.expectedVersion
    ? null
    : {
        actualVersion: result.data.version,
        entity: result.data,
        expectedVersion: operation.expectedVersion,
        reason: "version_conflict",
      }
}

function orderByDependencies(operations: OfflineV2Operation[]) {
  const pending = new Map(
    operations.map((operation) => [operation.clientOperationId, operation])
  )
  const ordered: OfflineV2Operation[] = []
  const resolved = new Set<string>()
  while (pending.size) {
    const next = [...pending.values()].find((operation) =>
      operation.dependsOn.every(
        (dependency) => resolved.has(dependency) || !pending.has(dependency)
      )
    )
    if (!next) {
      throw new Error("Offline operation dependency cycle")
    }
    pending.delete(next.clientOperationId)
    ordered.push(next)
    resolved.add(next.clientOperationId)
  }
  return ordered
}
