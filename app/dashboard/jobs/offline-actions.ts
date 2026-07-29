"use server"

import { z } from "zod"

import { requireAssignedWorker } from "@/lib/auth/membership"
import { deliverJobSubmissionEmail } from "@/lib/email/job-submission"
import { getRequestOrigin } from "@/lib/http/origin"
import type { ReplayResult } from "@/lib/offline/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { detectImageMimeType, IMAGE_MIME_EXTENSIONS } from "@/lib/uploads/image"

const operationSchema = z.object({
  clientOperationId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  jobId: z.number().int().positive(),
  kind: z.enum(["start", "note", "photo", "submit"]),
  payload: z.record(z.string(), z.union([z.string(), z.number()])),
})

const uploadSchema = z.object({
  clientOperationId: z.string().uuid(),
  extension: z.enum(["jpg", "png", "webp", "heic", "heif"]),
  jobId: z.number().int().positive(),
})

type ReplayRpc = (
  name: "replay_job_operation",
  args: {
    p_client_operation_id: string
    p_expected_version: number
    p_job_id: number
    p_operation_type: "note" | "photo" | "start" | "submit"
    p_payload: Record<string, string | number>
  }
) => Promise<{ data: ReplayResult[] | null; error: { message: string } | null }>

export async function refreshOfflineSessionAction() {
  const worker = await requireAssignedWorker()
  return {
    membershipId: worker.membershipId,
    organisationId: worker.organisationId,
  }
}

export async function prepareOfflineEvidenceUploadAction(input: {
  clientOperationId: string
  extension: string
  jobId: number
}) {
  const parsed = uploadSchema.safeParse(input)
  if (!parsed.success) {
    return {
      message: "The offline photo metadata is invalid.",
      ok: false,
    } as const
  }
  const worker = await requireAssignedWorker()
  const objectName = `${worker.organisationId}/${parsed.data.jobId}/${
    worker.membershipId
  }/${parsed.data.clientOperationId}.${parsed.data.extension}`
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from("job-evidence")
    .createSignedUploadUrl(objectName)

  if (error || !data) {
    return {
      message: "The photo upload could not be prepared.",
      ok: false,
    } as const
  }
  return {
    bucketName: "job-evidence",
    objectName,
    ok: true,
    signature: data.token,
  } as const
}

export async function verifyOfflineEvidenceUploadAction(input: {
  clientOperationId: string
  extension: string
  jobId: number
}) {
  const parsed = uploadSchema.safeParse(input)
  if (!parsed.success) {
    return {
      message: "The offline photo metadata is invalid.",
      ok: false,
    } as const
  }
  const worker = await requireAssignedWorker()
  const objectName = `${worker.organisationId}/${parsed.data.jobId}/${
    worker.membershipId
  }/${parsed.data.clientOperationId}.${parsed.data.extension}`
  const { data, error } = await createAdminClient()
    .storage.from("job-evidence")
    .info(objectName)

  if (error || !data) {
    return {
      message: "The queued photo has not reached storage yet.",
      ok: false,
    } as const
  }
  return { objectName, ok: true } as const
}

export async function replayOfflineJobOperationAction(
  input: unknown
): Promise<
  { message: string; ok: false } | { ok: true; replay: ReplayResult }
> {
  const parsed = operationSchema.safeParse(input)
  if (!parsed.success) {
    return { message: "The queued operation is invalid.", ok: false }
  }
  const worker = await requireAssignedWorker()

  if (parsed.data.kind === "photo") {
    const storagePath = String(parsed.data.payload.storagePath ?? "")
    const expectedPrefix = `${worker.organisationId}/${parsed.data.jobId}/${
      worker.membershipId
    }/${parsed.data.clientOperationId}.`
    if (!storagePath.startsWith(expectedPrefix)) {
      return { message: "The queued photo path is invalid.", ok: false }
    }
    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from("job-evidence")
      .download(storagePath)
    if (error || !data) {
      return {
        message: "The queued photo has not finished uploading.",
        ok: false,
      }
    }
    const bytes = new Uint8Array(await data.arrayBuffer())
    const mimeType = detectImageMimeType(bytes)
    if (
      !mimeType ||
      !(mimeType in IMAGE_MIME_EXTENSIONS) ||
      bytes.byteLength > 10 * 1024 * 1024
    ) {
      await admin.storage.from("job-evidence").remove([storagePath])
      return {
        message: "The queued photo is not a supported image.",
        ok: false,
      }
    }
    parsed.data.payload.mimeType = mimeType
    parsed.data.payload.sizeBytes = bytes.byteLength
  }

  const supabase = await createClient()
  const { data, error } = await (supabase.rpc as unknown as ReplayRpc)(
    "replay_job_operation",
    {
      p_client_operation_id: parsed.data.clientOperationId,
      p_expected_version: parsed.data.expectedVersion,
      p_job_id: parsed.data.jobId,
      p_operation_type: parsed.data.kind,
      p_payload: parsed.data.payload,
    }
  )
  const replay = data?.[0]
  if (error || !replay) {
    return {
      message: error?.message ?? "The queued change could not sync.",
      ok: false,
    }
  }

  const submissionUpdateId = replay.result.submissionUpdateId
  if (
    parsed.data.kind === "submit" &&
    replay.operation_status === "acknowledged" &&
    submissionUpdateId
  ) {
    try {
      const { data: deliveries } = await createAdminClient()
        .from("job_notification_deliveries")
        .select("id")
        .eq("organisation_id", worker.organisationId)
        .eq("submission_update_id", submissionUpdateId)
      const origin = await getRequestOrigin()
      await Promise.allSettled(
        (deliveries ?? []).map((delivery) =>
          deliverJobSubmissionEmail(delivery.id, origin)
        )
      )
    } catch {
      // Authoritative submission remains successful when email is unavailable.
    }
  }

  return { ok: true, replay }
}
