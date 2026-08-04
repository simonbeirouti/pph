import { z } from "zod"

import type { OfflineV2Operation } from "@/lib/offline-v2/types"

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

const requestEnvelopeSchema = z.object({
  operations: z.array(z.unknown()).max(500),
  revision: z.number().int().nonnegative(),
  schemaVersion: z.number().int().positive(),
})

export function parseOfflineSyncRequest(input: unknown) {
  const envelope = requestEnvelopeSchema.safeParse(input)
  if (!envelope.success) return null

  const operations: OfflineV2Operation[] = []
  const invalidOperations: { clientOperationId: string; error: string }[] = []
  for (const candidate of envelope.data.operations) {
    const parsed = operationSchema.safeParse(candidate)
    if (parsed.success) {
      operations.push(parsed.data as OfflineV2Operation)
      continue
    }
    const clientOperationId =
      typeof candidate === "object" &&
      candidate !== null &&
      "clientOperationId" in candidate &&
      typeof candidate.clientOperationId === "string" &&
      candidate.clientOperationId.length
        ? candidate.clientOperationId
        : null
    if (!clientOperationId) return null
    invalidOperations.push({
      clientOperationId,
      error: `Invalid queued operation: ${parsed.error.issues
        .map((issue) => issue.path.join(".") || issue.message)
        .join(", ")}`,
    })
  }

  return {
    invalidOperations,
    operations,
    revision: envelope.data.revision,
    schemaVersion: envelope.data.schemaVersion,
  }
}
