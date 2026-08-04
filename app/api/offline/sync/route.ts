import { Buffer } from "node:buffer"

import { NextResponse } from "next/server"

import { replayOfflineJobOperationAction } from "@/app/dashboard/jobs/offline-actions"
import {
  addJobCommentAction,
  archiveJobAction,
  createJobAction,
  deleteJobAction,
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
import {
  buildOfflineV2Domains,
  buildOfflineV2Snapshot,
  type OfflineV2DomainData,
  type OfflineV2DomainName,
} from "@/lib/offline-v2/bootstrap"
import {
  OFFLINE_V2_LEASE_MS,
  OFFLINE_V2_SCHEMA_VERSION,
  type OfflineV2Patch,
  OfflineConflict,
  OfflineSyncResult,
  OfflineV2Operation,
} from "@/lib/offline-v2/types"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/database.types"
import { parseOfflineSyncRequest } from "@/lib/offline-v2/sync-validation"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const parsed = parseOfflineSyncRequest(await request.json())
    if (!parsed) {
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
    const operations = orderByDependencies(parsed.operations)
    const queuedOperationIds = new Set([
      ...operations.map((operation) => operation.clientOperationId),
      ...parsed.invalidOperations.map(
        (operation) => operation.clientOperationId
      ),
    ])
    const conflicts: OfflineConflict[] = []
    const idMappings: Record<string, number> = {}
    const operationResults: OfflineSyncResult["operationResults"] =
      parsed.invalidOperations.map((operation) => ({
        clientOperationId: operation.clientOperationId,
        error: operation.error,
        status: "needs_attention",
      }))
    const acknowledged = new Set<string>()
    const currentJobVersions = new Map<number, number>()
    const supabase = await createClient()

    for (const originalOperation of operations) {
      const storedOperation = resolveOperationIds(originalOperation, idMappings)
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
          (dependency) =>
            queuedOperationIds.has(dependency) && !acknowledged.has(dependency)
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
          (isRecord(result.result?.job) ? result.result.job.id : undefined)
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

    const { changes, complete } = await readSyncChanges(
      supabase,
      parsed.revision
    )
    const selection =
      parsed.schemaVersion === OFFLINE_V2_SCHEMA_VERSION && complete
        ? domainsForChanges(changes)
        : null
    const fullSnapshot =
      selection === null ? await buildOfflineV2Snapshot() : null
    const domainSnapshot =
      !fullSnapshot && selection?.domains.size
        ? await buildOfflineV2Domains(selection.domains, selection.jobDetailIds)
        : null
    const { data: currentRevision, error: revisionError } = await supabase.rpc(
      "get_offline_sync_revision"
    )
    if (revisionError) throw revisionError
    const refreshedAt = new Date()
    const leaseExpiresAt = new Date(
      refreshedAt.getTime() + OFFLINE_V2_LEASE_MS
    ).toISOString()
    const revision =
      fullSnapshot?.revision ?? currentRevision ?? parsed.revision
    const patch =
      fullSnapshot || !selection
        ? undefined
        : buildDomainPatch({
            baseRevision: parsed.revision,
            deletedJobIds: selection.deletedJobIds,
            domains: selection.domains,
            jobDetailIds: selection.jobDetailIds,
            leaseExpiresAt,
            refreshedAt: refreshedAt.toISOString(),
            revision,
            snapshot: domainSnapshot,
          })
    const response: OfflineSyncResult = {
      changes: changes.map((change) => ({
        changedAt: change.changed_at,
        entityId: change.entity_id,
        entityType: change.entity_type,
        operation: change.operation === "delete" ? "delete" : "upsert",
        relatedJobId: change.related_job_id,
        revision: change.revision,
      })),
      conflicts,
      ...(fullSnapshot ? { fullSnapshot } : {}),
      idMappings,
      leaseExpiresAt: fullSnapshot?.leaseExpiresAt ?? leaseExpiresAt,
      operationResults,
      ...(patch ? { patch } : {}),
      revision,
    }
    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    console.error("Offline sync failed", error)
    return NextResponse.json(
      {
        ...(process.env.NODE_ENV === "development" && error instanceof Error
          ? { detail: error.message }
          : {}),
        message: "Offline synchronisation failed.",
      },
      { status: 500 }
    )
  }
}

type SyncClient = Awaited<ReturnType<typeof createClient>>
type SyncChangeRow = {
  changed_at: string
  entity_id: number
  entity_type: string
  operation: string
  related_job_id: number | null
  revision: number
}

const MAX_CHANGE_PAGES = 3
const CHANGE_PAGE_SIZE = 5_000

async function readSyncChanges(client: SyncClient, afterRevision: number) {
  const changes: SyncChangeRow[] = []
  let cursor = afterRevision
  for (let page = 0; page < MAX_CHANGE_PAGES; page += 1) {
    const { data, error } = await client.rpc("get_offline_sync_changes", {
      p_after_revision: cursor,
    })
    if (error) throw error
    const rows = (data ?? []) as SyncChangeRow[]
    changes.push(...rows)
    if (rows.length < CHANGE_PAGE_SIZE) return { changes, complete: true }
    cursor = rows.at(-1)?.revision ?? cursor
  }
  return { changes, complete: false }
}

type PatchDomain = OfflineV2DomainName

type DomainSelection = {
  deletedJobIds: Set<number>
  domains: Set<PatchDomain>
  jobDetailIds?: Set<number>
}

function domainsForChanges(changes: SyncChangeRow[]): DomainSelection | null {
  const domains = new Set<PatchDomain>()
  const jobDetailIds = new Set<number>()
  const deletedJobIds = new Set<number>()
  let requiresCompleteJobDetails = false
  for (const change of changes) {
    const entityType = change.entity_type
    if (
      entityType === "organisations" ||
      entityType === "memberships" ||
      entityType === "employee_profiles"
    ) {
      return {
        deletedJobIds,
        domains: new Set<PatchDomain>([
          "dashboard",
          "employeeJobs",
          "jobDetails",
          "jobs",
          "membership",
          "people",
          "profile",
          "roster",
          "templates",
        ]),
      }
    }
    if (entityType === "roster_shifts") {
      addDomains(domains, ["dashboard", "jobs", "people", "roster"])
      continue
    }
    if (
      entityType === "jobs" ||
      entityType === "job_updates" ||
      entityType === "job_assets" ||
      entityType === "job_notification_deliveries"
    ) {
      addDomains(domains, [
        "dashboard",
        "employeeJobs",
        "jobDetails",
        "jobs",
        "people",
        "roster",
      ])
      const relatedJobId =
        change.related_job_id ??
        (entityType === "jobs" ? change.entity_id : null)
      if (relatedJobId) {
        jobDetailIds.add(relatedJobId)
        if (entityType === "jobs" && change.operation === "delete") {
          deletedJobIds.add(relatedJobId)
        }
      } else {
        requiresCompleteJobDetails = true
      }
      continue
    }
    if (
      entityType === "job_templates" ||
      entityType === "job_schedules" ||
      entityType === "job_schedule_occurrences"
    ) {
      addDomains(domains, ["jobs", "templates"])
      continue
    }
    if (entityType === "membership_role_audit") {
      addDomains(domains, ["membership", "people"])
      continue
    }
    return null
  }
  return {
    deletedJobIds,
    domains,
    ...(requiresCompleteJobDetails ? {} : { jobDetailIds }),
  }
}

function addDomains(target: Set<PatchDomain>, domains: readonly PatchDomain[]) {
  for (const domain of domains) target.add(domain)
}

function buildDomainPatch({
  baseRevision,
  deletedJobIds,
  domains,
  jobDetailIds,
  leaseExpiresAt,
  refreshedAt,
  revision,
  snapshot,
}: {
  baseRevision: number
  deletedJobIds: Set<number>
  domains: Set<PatchDomain>
  jobDetailIds?: Set<number>
  leaseExpiresAt: string
  refreshedAt: string
  revision: number
  snapshot: OfflineV2DomainData | null
}): OfflineV2Patch {
  return {
    baseRevision,
    leaseExpiresAt,
    refreshedAt,
    revision,
    ...(snapshot && domains.has("dashboard")
      ? { dashboard: snapshot.dashboard }
      : {}),
    ...(snapshot && domains.has("employeeJobs")
      ? { employeeJobs: snapshot.employeeJobs }
      : {}),
    ...(snapshot && domains.has("jobDetails")
      ? {
          jobDetails: {
            remove: jobDetailIds ? [...deletedJobIds] : [],
            ...(jobDetailIds ? {} : { reset: true }),
            upsert: snapshot.jobDetails ?? {},
          },
        }
      : {}),
    ...(snapshot && domains.has("jobs") ? { jobs: snapshot.jobs } : {}),
    ...(snapshot && domains.has("membership")
      ? { membership: snapshot.membership }
      : {}),
    ...(snapshot && domains.has("people") ? { people: snapshot.people } : {}),
    ...(snapshot && domains.has("profile")
      ? { profile: snapshot.profile }
      : {}),
    ...(snapshot && domains.has("roster") ? { roster: snapshot.roster } : {}),
    ...(snapshot && domains.has("templates")
      ? { templates: snapshot.templates }
      : {}),
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

  if (
    operation.entity.source === "server" &&
    operation.kind === "job.comment"
  ) {
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
        assigneeMembershipId: Number(operation.payload.assigneeMembershipId),
        feedback: String(operation.payload.feedback ?? ""),
        jobId: operation.entity.id,
        submissionVersion: Number(operation.payload.submissionVersion),
      })
    )
  }
  if (
    operation.entity.source === "server" &&
    operation.kind === "job.archive"
  ) {
    return actionResult(
      operation,
      await archiveJobAction(
        operation.entity.id,
        Number(operation.payload.submissionVersion)
      )
    )
  }
  if (operation.entity.source === "server" && operation.kind === "job.delete") {
    const result = await deleteJobAction(operation.entity.id)
    return actionResult(
      operation,
      !result.ok && result.message === "The job is no longer available."
        ? { message: "Job already deleted.", ok: true }
        : result
    )
  }
  if (operation.kind === "job.notification.retry") {
    return actionResult(
      operation,
      await retryJobNotificationAction(Number(operation.payload.deliveryId))
    )
  }
  if (
    operation.kind === "job.reassign" &&
    operation.entity.source === "server"
  ) {
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
        employeeMembershipId: Number(operation.payload.employeeMembershipId),
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
        employeeMembershipId: Number(operation.payload.employeeMembershipId),
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
      ? await supabase
          .from("jobs")
          .select("id, version")
          .eq("id", id)
          .maybeSingle()
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
