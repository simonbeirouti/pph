"use client";

import { QueryClient } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client";
import { useState, type ReactNode } from "react";
import {
  createIdbPersister,
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_MAX_AGE,
  shouldPersistQuery,
} from "@/lib/query/persistence";

const QUERY_STALE_TIME = 1000 * 60;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: QUERY_CACHE_MAX_AGE,
        staleTime: QUERY_STALE_TIME,
      },
    },
  });
}

export function QueryProvider({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [persister] = useState(createIdbPersister);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      onSuccess={() => {
        void persistQueryClientSave({
          buster: QUERY_CACHE_BUSTER,
          dehydrateOptions: {
            shouldDehydrateQuery: shouldPersistQuery,
          },
          persister,
          queryClient,
        });
      }}
      persistOptions={{
        buster: QUERY_CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
        },
        maxAge: QUERY_CACHE_MAX_AGE,
        persister,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
