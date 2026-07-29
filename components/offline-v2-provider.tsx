"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  getOfflineV2Blob,
  applyOfflineIdMappings,
  cacheOfflineSnapshotMedia,
  estimateOfflineCapacity,
  getOfflineConflicts,
  getOfflineV2Operations,
  getOfflineV2Snapshot,
  hydrateOfflineSnapshotMedia,
  isOfflineLogoutPending,
  migrateLegacyOfflineData,
  persistOfflineV2Snapshot,
  putOfflineConflict,
  putOfflineV2Operation,
  purgeOfflineV2Data,
  removeOfflineV2Operation,
} from "@/lib/offline-v2/storage"
import { logoutAction } from "@/app/dashboard/actions"
import { prepareOfflineEvidenceUploadAction } from "@/app/dashboard/jobs/offline-actions"
import { ensureOfflineShellReady } from "@/components/service-worker-registration"
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/browser"
import type {
  OfflineConflict,
  OfflineMembership,
  OfflineSyncStatus,
  OfflineV2Operation,
  OfflineV2Snapshot,
  OfflineSyncResult,
} from "@/lib/offline-v2/types"
import { isOfflineLeaseValid } from "@/lib/offline-v2/types"

type OfflineV2ContextValue = {
  conflicts: OfflineConflict[]
  currentPath: string
  isOnline: boolean
  navigate: (href: string, options?: { replace?: boolean }) => void
  operations: OfflineV2Operation[]
  queueOperation: (operation: OfflineV2Operation) => Promise<void>
  refresh: () => Promise<void>
  snapshot: OfflineV2Snapshot | null
  status: OfflineSyncStatus
  updateSnapshot: (
    updater: (snapshot: OfflineV2Snapshot) => OfflineV2Snapshot
  ) => Promise<void>
}

const OfflineV2Context = createContext<OfflineV2ContextValue | null>(null)

export function OfflineV2Provider({
  children,
  serverMembership,
}: {
  children: ReactNode
  serverMembership?: OfflineMembership
}) {
  const [snapshot, setSnapshot] = useState<OfflineV2Snapshot | null>(null)
  const [operations, setOperations] = useState<OfflineV2Operation[]>([])
  const [conflicts, setConflicts] = useState<OfflineConflict[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [status, setStatus] = useState<OfflineSyncStatus>("preparing")
  const [currentPath, setCurrentPath] = useState(
    "/dashboard"
  )
  const snapshotStateRef = useRef<OfflineV2Snapshot | null>(null)
  const snapshotRevisionRef = useRef(0)

  const reloadLocalState = useCallback(async () => {
    const [storedSnapshot, storedOperations, storedConflicts] =
      await Promise.all([
        getOfflineV2Snapshot(),
        getOfflineV2Operations(),
        getOfflineConflicts(),
      ])
    const identityMatches =
      !serverMembership ||
      !storedSnapshot ||
      (storedSnapshot.membership.membershipId ===
        serverMembership.membershipId &&
        storedSnapshot.membership.organisationId ===
          serverMembership.organisationId)
    if (!identityMatches) await purgeOfflineV2Data()
    const usableSnapshot =
      identityMatches && storedSnapshot
        ? await hydrateOfflineSnapshotMedia(storedSnapshot)
        : null
    snapshotRevisionRef.current = usableSnapshot?.revision ?? 0
    snapshotStateRef.current = usableSnapshot
    setSnapshot(usableSnapshot)
    setOperations(storedOperations)
    setConflicts(storedConflicts)
    if (!navigator.onLine) {
      if (!usableSnapshot) {
        setStatus("cold")
      } else if (!isOfflineLeaseValid(usableSnapshot.leaseExpiresAt)) {
        setStatus("lease_expired")
      } else if (storedConflicts.length) {
        setStatus("needs_attention")
      } else if (storedOperations.length) {
        setStatus("changes_pending")
      } else {
        setStatus("offline")
      }
    }
  }, [serverMembership])

  const refresh = useCallback(async () => {
    if (!navigator.onLine) {
      await reloadLocalState()
      return
    }
    setStatus("preparing")
    try {
      const pendingOperations = await preparePendingUploads(
        await getOfflineV2Operations()
      )
      setStatus(pendingOperations.length ? "syncing" : "preparing")
      const response = await fetch(
        pendingOperations.length
          ? "/api/offline/sync"
          : "/api/offline/bootstrap",
        {
        cache: "no-store",
        credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          method: pendingOperations.length ? "POST" : "GET",
          ...(pendingOperations.length
            ? {
                body: JSON.stringify({
                  operations: pendingOperations,
                  revision: snapshotRevisionRef.current,
                }),
              }
            : {}),
        }
      )
      if (response.status === 401 || response.status === 403) {
        await purgeOfflineV2Data()
        snapshotStateRef.current = null
        setSnapshot(null)
        setOperations([])
        setConflicts([])
        setStatus("cold")
        return
      }
      if (!response.ok) throw new Error(`Bootstrap failed: ${response.status}`)
      const payload = (await response.json()) as
        | OfflineV2Snapshot
        | OfflineSyncResult
      const syncResult =
        "operationResults" in payload ? payload : null
      if (syncResult) {
        for (const result of syncResult.operationResults) {
          if (result.status === "acknowledged") {
            await removeOfflineV2Operation(result.clientOperationId)
          }
        }
        for (const conflict of syncResult.conflicts) {
          await putOfflineConflict(conflict)
        }
        await applyOfflineIdMappings(syncResult.idMappings)
      }
      const nextSnapshot = syncResult?.snapshot ?? (payload as OfflineV2Snapshot)
      snapshotRevisionRef.current = nextSnapshot.revision
      const structuredBytes = new Blob([JSON.stringify(nextSnapshot)]).size
      const capacity = await estimateOfflineCapacity(structuredBytes)
      if (!capacity.sufficient) {
        setStatus("storage_warning")
        return
      }
      await persistOfflineV2Snapshot(nextSnapshot)
      const mediaComplete = await cacheOfflineSnapshotMedia(nextSnapshot)
      const shellReady = await ensureOfflineShellReady(
        navigator.serviceWorker,
        window.caches
      )
      const hydratedSnapshot =
        await hydrateOfflineSnapshotMedia(nextSnapshot)
      snapshotStateRef.current = hydratedSnapshot
      setSnapshot(hydratedSnapshot)
      const [nextOperations, nextConflicts] = await Promise.all([
        getOfflineV2Operations(),
        getOfflineConflicts(),
      ])
      setOperations(nextOperations)
      setConflicts(nextConflicts)
      setStatus(
        !mediaComplete || !shellReady
          ? "storage_warning"
          : nextConflicts.length
          ? "needs_attention"
          : nextOperations.length
            ? "changes_pending"
            : "offline_ready"
      )
    } catch {
      await reloadLocalState()
    }
  }, [reloadLocalState])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsOnline(navigator.onLine)
      setCurrentPath(
        `${window.location.pathname}${window.location.search}`
      )
      const logoutPending = await Promise.race([
        isOfflineLogoutPending(),
        new Promise<false>((resolve) =>
          window.setTimeout(() => resolve(false), 1_000)
        ),
      ])
      if (logoutPending) {
        if (navigator.onLine) {
          await logoutAction()
          return
        }
        setSnapshot(null)
        snapshotStateRef.current = null
        setStatus("cold")
        return
      }
      await Promise.race([
        migrateLegacyOfflineData(),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1_000)),
      ])
      if (cancelled) return
      await reloadLocalState()
      if (!cancelled && navigator.onLine) await refresh()
    })()
    return () => {
      cancelled = true
    }
  }, [refresh, reloadLocalState])

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      void refresh()
    }
    const onOffline = () => {
      setIsOnline(false)
      void reloadLocalState()
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void refresh()
      }
    }
    const onPopState = () =>
      setCurrentPath(`${window.location.pathname}${window.location.search}`)
    const onRealtimeInvalidation = () => {
      if (navigator.onLine) void refresh()
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    window.addEventListener("popstate", onPopState)
    window.addEventListener("pph:offline-invalidate", onRealtimeInvalidation)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("popstate", onPopState)
      window.removeEventListener(
        "pph:offline-invalidate",
        onRealtimeInvalidation
      )
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [refresh, reloadLocalState])

  const navigate = useCallback(
    (href: string, options?: { replace?: boolean }) => {
      const url = new URL(href, window.location.origin)
      const nextPath = `${url.pathname}${url.search}`
      if (options?.replace) {
        window.history.replaceState(null, "", nextPath)
      } else {
        window.history.pushState(null, "", nextPath)
      }
      setCurrentPath(nextPath)
      window.scrollTo({ top: 0 })
    },
    []
  )

  useEffect(() => {
    if (isOnline) return
    const interceptDashboardLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      const url = new URL(anchor.href, window.location.origin)
      if (
        url.origin !== window.location.origin ||
        !url.pathname.startsWith("/dashboard")
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      navigate(`${url.pathname}${url.search}`)
    }
    document.addEventListener("click", interceptDashboardLink, true)
    return () =>
      document.removeEventListener("click", interceptDashboardLink, true)
  }, [isOnline, navigate])

  const queueOperation = useCallback(async (operation: OfflineV2Operation) => {
    await putOfflineV2Operation(operation)
    setOperations((current) =>
      [...current.filter(
        (item) => item.clientOperationId !== operation.clientOperationId
      ), operation].toSorted((left, right) =>
        left.createdAt.localeCompare(right.createdAt)
      )
    )
    setStatus("changes_pending")
  }, [])

  const updateSnapshot = useCallback(
    async (updater: (current: OfflineV2Snapshot) => OfflineV2Snapshot) => {
      const current = snapshotStateRef.current
      if (!current) return
      const next = updater(current)
      snapshotStateRef.current = next
      await persistOfflineV2Snapshot(next)
      setSnapshot(next)
    },
    []
  )

  const value = useMemo<OfflineV2ContextValue>(
    () => ({
      conflicts,
      currentPath,
      isOnline,
      navigate,
      operations,
      queueOperation,
      refresh,
      snapshot,
      status,
      updateSnapshot,
    }),
    [
      conflicts,
      currentPath,
      isOnline,
      navigate,
      operations,
      queueOperation,
      refresh,
      snapshot,
      status,
      updateSnapshot,
    ]
  )

  return (
    <OfflineV2Context.Provider value={value}>
      <div className="contents" data-offline-provider={status}>
        {children}
      </div>
    </OfflineV2Context.Provider>
  )
}

export function useOfflineV2() {
  const context = useContext(OfflineV2Context)
  if (!context) {
    throw new Error("useOfflineV2 must be used inside OfflineV2Provider")
  }
  return context
}

export function useOptionalOfflineV2() {
  return useContext(OfflineV2Context)
}

async function preparePendingUploads(operations: OfflineV2Operation[]) {
  const preparedOperations: OfflineV2Operation[] = []
  for (const operation of operations) {
    if (
      operation.kind === "membership.create" ||
      operation.kind === "membership.update" ||
      operation.kind === "profile.update"
    ) {
      const avatar = await getOfflineV2Blob(operation.clientOperationId)
      if (avatar) {
        preparedOperations.push({
          ...operation,
          payload: {
            ...operation.payload,
            avatarDataUrl: await blobDataUrl(avatar),
            avatarName:
              avatar instanceof File && avatar.name
                ? avatar.name
                : "offline-avatar",
          },
        })
        continue
      }
    }
    if (
      operation.kind !== "job.evidence.add" ||
      operation.entity.source !== "server" ||
      typeof operation.payload.storagePath === "string"
    ) {
      preparedOperations.push(operation)
      continue
    }
    const blob = await getOfflineV2Blob(operation.clientOperationId)
    if (!blob) {
      preparedOperations.push({
        ...operation,
        lastError: "The queued photo is missing from this device.",
        state: "failed",
      })
      continue
    }
    const prepared = await prepareOfflineEvidenceUploadAction({
      clientOperationId: operation.clientOperationId,
      extension: String(operation.payload.extension ?? ""),
      jobId: operation.entity.id,
    })
    if (!prepared.ok) {
      preparedOperations.push({
        ...operation,
        lastError: prepared.message,
        state: "failed",
      })
      continue
    }
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.storage
      .from(prepared.bucketName)
      .uploadToSignedUrl(
        prepared.objectName,
        prepared.signature,
        blob,
        { contentType: String(operation.payload.mimeType ?? blob.type) }
      )
    const next: OfflineV2Operation = error
      ? {
          ...operation,
          lastError: "The queued photo could not upload.",
          state: "failed",
        }
      : {
          ...operation,
          payload: {
            ...operation.payload,
            storagePath: prepared.objectName,
          },
          state: "pending",
        }
    await putOfflineV2Operation(next)
    preparedOperations.push(next)
  }
  return preparedOperations
}

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}
