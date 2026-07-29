"use client"

import type { Persister } from "@tanstack/react-query-persist-client"
import type { Query } from "@tanstack/react-query"

import {
  persistQueryClient,
  removeQueryClient,
  restoreQueryClient,
} from "@/lib/offline/storage"
import {
  OFFLINE_CACHE_MAX_AGE,
  OFFLINE_SCHEMA_VERSION,
  type OfflineIdentity,
} from "@/lib/offline/types"

export const OFFLINE_QUERY_BUSTER = `assigned-work-v${OFFLINE_SCHEMA_VERSION}`

export function assignedWorkQueryKey(identity: OfflineIdentity) {
  return [
    "assigned-work",
    identity.organisationId,
    identity.membershipId,
  ] as const
}

export function createOfflinePersister(): Persister {
  return {
    persistClient: persistQueryClient,
    removeClient: removeQueryClient,
    restoreClient: restoreQueryClient,
  }
}

export function shouldPersistOfflineQuery(query: Query) {
  return (
    query.meta?.offlineWorkPack === true &&
    query.queryKey[0] === "assigned-work" &&
    query.state.status === "success"
  )
}

export { OFFLINE_CACHE_MAX_AGE }
