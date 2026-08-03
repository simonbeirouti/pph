"use client"

import { useCallback } from "react"

import { useOptionalOfflineV2 } from "@/components/offline-v2-provider"
import { getOfflineV2Operations } from "@/lib/offline-v2/storage"
import type {
  OfflineEntityType,
  OfflineOperationKind,
  OfflineV2Snapshot,
} from "@/lib/offline-v2/types"
import { selectMutationTransport } from "@/lib/offline-v2/view-mode"

export { updateJobEverywhere } from "@/lib/offline-v2/optimistic"

type QueueInput = {
  blob?: Blob
  entityId: number | string
  entityType: OfflineEntityType
  expectedVersion?: number | null
  kind: OfflineOperationKind
  optimistic?: (snapshot: OfflineV2Snapshot) => OfflineV2Snapshot
  payload?: Record<string, unknown>
}

export function useOfflineV2Actions() {
  const offline = useOptionalOfflineV2()
  const canQueueOfflineMutation = Boolean(offline?.canQueueOfflineMutation)
  const repositoryManaged = Boolean(
    offline &&
    (offline.repositoryState !== "unavailable" ||
      offline.viewSource === "cache")
  )
  const mutationTransport = selectMutationTransport({
    canQueueOfflineMutation,
    repositoryManaged,
    repositoryState: offline?.repositoryState ?? "unavailable",
  })

  const queue = useCallback(
    async (input: QueueInput) => {
      if (!offline) return false
      const clientOperationId = crypto.randomUUID()
      const dependency = (await getOfflineV2Operations())
        .filter(
          (operation) =>
            operation.entityType === input.entityType &&
            operation.entity.id === input.entityId
        )
        .at(-1)
      return offline.queueOperation(
        {
          clientOperationId,
          createdAt: new Date().toISOString(),
          dependsOn: dependency ? [dependency.clientOperationId] : [],
          entity:
            typeof input.entityId === "number"
              ? { id: input.entityId, source: "server" }
              : { id: input.entityId, source: "local" },
          entityType: input.entityType,
          expectedVersion: input.expectedVersion ?? null,
          kind: input.kind,
          payload: input.payload ?? {},
          state: "pending",
        },
        {
          ...(input.blob ? { blob: input.blob } : {}),
          ...(input.optimistic ? { optimistic: input.optimistic } : {}),
        }
      )
    },
    [offline]
  )

  return {
    canMutate: Boolean(offline?.canMutate),
    canQueueOfflineMutation,
    isOffline: offline?.networkReachability === "offline",
    navigate: offline?.navigate,
    navigationMode: offline?.navigationMode ?? "next",
    networkReachability: offline?.networkReachability ?? "online",
    mutationTransport,
    queue,
    repositoryState: offline?.repositoryState ?? "preparing",
    usesLocalRepository: repositoryManaged,
  }
}
