"use client"

import { useCallback } from "react"

import { useOptionalOfflineV2 } from "@/components/offline-v2-provider"
import {
  getOfflineV2Operations,
  putOfflineV2Blob,
} from "@/lib/offline-v2/storage"
import type {
  OfflineEntityType,
  OfflineOperationKind,
  OfflineV2Snapshot,
} from "@/lib/offline-v2/types"

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

  const queue = useCallback(
    async (input: QueueInput) => {
      if (!offline?.usesLocalRepository) return false
      const clientOperationId = crypto.randomUUID()
      if (input.blob) {
        await putOfflineV2Blob(clientOperationId, input.blob)
      }
      const dependency = (await getOfflineV2Operations())
        .filter(
          (operation) =>
            operation.entityType === input.entityType &&
            operation.entity.id === input.entityId
        )
        .at(-1)
      await offline.queueOperation({
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
      })
      if (input.optimistic) {
        await offline.updateSnapshot(input.optimistic)
      }
      return true
    },
    [offline]
  )

  return {
    isOffline: Boolean(offline?.usesLocalRepository),
    navigate: offline?.navigate,
    queue,
  }
}
