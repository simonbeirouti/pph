"use client"

import { QueryClient } from "@tanstack/react-query"
import {
  PersistQueryClientProvider,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client"
import { useEffect, useState, type ReactNode } from "react"

import {
  createOfflinePersister,
  OFFLINE_CACHE_MAX_AGE,
  OFFLINE_QUERY_BUSTER,
  shouldPersistOfflineQuery,
} from "@/lib/offline/query"
import { ensureOfflineIdentity } from "@/lib/offline/storage"
import type { OfflineIdentity } from "@/lib/offline/types"

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: OFFLINE_CACHE_MAX_AGE,
        retry: 1,
        staleTime: 60_000,
      },
    },
  })
}

export function QueryProvider({
  children,
  identity,
}: {
  children: ReactNode
  identity: OfflineIdentity | null
}) {
  const [queryClient] = useState(createQueryClient)
  const [persister] = useState(createOfflinePersister)

  useEffect(() => {
    if (identity) void ensureOfflineIdentity(identity)
  }, [identity])

  return (
    <PersistQueryClientProvider
      client={queryClient}
      onSuccess={() =>
        persistQueryClientSave({
          buster: OFFLINE_QUERY_BUSTER,
          dehydrateOptions: { shouldDehydrateQuery: shouldPersistOfflineQuery },
          persister,
          queryClient,
        })
      }
      persistOptions={{
        buster: OFFLINE_QUERY_BUSTER,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistOfflineQuery },
        maxAge: OFFLINE_CACHE_MAX_AGE,
        persister,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
