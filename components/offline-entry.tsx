"use client"

import { useEffect, useState } from "react"

import { AssignedWorkOfflineWorkspace } from "@/components/assigned-work-offline-workspace"
import { QueryProvider } from "@/components/query-provider"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getPersistedWorkPack } from "@/lib/offline/storage"
import type { OfflineWorkPack } from "@/lib/offline/types"

export function OfflineEntry() {
  const [pack, setPack] = useState<OfflineWorkPack | null | undefined>(
    undefined
  )
  const [selectedJobId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null
    const rawJobId = new URL(window.location.href).searchParams.get("job")
    return rawJobId && /^[1-9]\d*$/.test(rawJobId) ? Number(rawJobId) : null
  })

  useEffect(() => {
    void getPersistedWorkPack().then(setPack)
  }, [])

  if (pack === undefined) {
    return <p role="status">Opening cached work…</p>
  }
  if (!pack) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No current offline work</CardTitle>
          <CardDescription>
            Connect to the internet, sign in, and enable offline work from your
            assigned jobs before returning offline.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <QueryProvider identity={pack.identity}>
      <AssignedWorkOfflineWorkspace
        fallback={<p role="status">Restoring assigned work…</p>}
        initialPack={pack}
        initiallyOffline
        selectedJobId={selectedJobId}
      />
    </QueryProvider>
  )
}
