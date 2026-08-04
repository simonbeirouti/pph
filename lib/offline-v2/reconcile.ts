import type {
  OfflineSyncResult,
  OfflineV2Operation,
} from "@/lib/offline-v2/types"

type OperationResult = OfflineSyncResult["operationResults"][number]

export function reconcileOfflineOperations({
  operationResults,
  replayedOperations,
  storedOperations,
}: {
  operationResults: readonly OperationResult[]
  replayedOperations: readonly OfflineV2Operation[]
  storedOperations: readonly OfflineV2Operation[]
}) {
  const replayedById = new Map(
    replayedOperations.map((operation) => [
      operation.clientOperationId,
      operation,
    ])
  )
  const resultById = new Map(
    operationResults.map((result) => [result.clientOperationId, result])
  )
  const acknowledgedJobVersions = new Map<
    string,
    { jobId: number; version: number }
  >()

  for (const result of operationResults) {
    const replayed = replayedById.get(result.clientOperationId)
    const version = result.result?.version
    if (
      result.status !== "acknowledged" ||
      !replayed ||
      replayed.entityType !== "job" ||
      replayed.entity.source !== "server" ||
      typeof version !== "number"
    ) {
      continue
    }
    acknowledgedJobVersions.set(result.clientOperationId, {
      jobId: replayed.entity.id,
      version,
    })
  }

  return storedOperations.flatMap((stored) => {
    const result = resultById.get(stored.clientOperationId)
    if (result?.status === "acknowledged") return []

    const replayed = replayedById.get(stored.clientOperationId) ?? stored
    const retained = result
      ? {
          ...replayed,
          lastError: result.error ?? "The queued change could not be applied.",
          state:
            result.status === "conflict" || result.status === "needs_attention"
              ? ("needs_attention" as const)
              : ("pending" as const),
        }
      : stored

    if (retained.entityType !== "job" || retained.entity.source !== "server") {
      return [retained]
    }

    const dependencyVersion = retained.dependsOn
      .map((dependency) => acknowledgedJobVersions.get(dependency))
      .find((acknowledged) => acknowledged?.jobId === retained.entity.id)

    return [
      dependencyVersion
        ? { ...retained, expectedVersion: dependencyVersion.version }
        : retained,
    ]
  })
}
