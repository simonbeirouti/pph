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
  commitOfflineV2Operation,
  commitOfflineV2Sync,
  getOfflineV2Blob,
  cacheOfflineSnapshotMedia,
  estimateOfflineCapacity,
  getOfflineConflicts,
  getOfflineV2Operations,
  getOfflineV2Snapshot,
  hydrateOfflineSnapshotMedia,
  isOfflineLogoutPending,
  migrateLegacyOfflineData,
  persistOfflineV2Snapshot,
  putOfflineV2Operation,
  purgeOfflineV2Data,
  deleteOfflineV2Database,
} from "@/lib/offline-v2/storage"
import { logoutAction } from "@/app/dashboard/actions"
import {
  prepareOfflineEvidenceUploadAction,
  verifyOfflineEvidenceUploadAction,
} from "@/app/dashboard/jobs/offline-actions"
import {
  clearOfflineRepositoryPrepared,
  ensureOfflineShellReady,
  isOfflineRepositoryPrepared,
  markOfflineRepositoryPrepared,
} from "@/components/pwa/service-worker-registration"
import { restoreOfflineEvidenceFile } from "@/lib/offline-v2/evidence-upload"
import {
  preservePendingOptimisticDomains,
  submitJobEverywhere,
  updateJobEverywhere,
} from "@/lib/offline-v2/optimistic"
import { applyOfflineV2Patch } from "@/lib/offline-v2/patch"
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/browser"
import type {
  OfflineConflict,
  OfflineMembership,
  OfflineRepositoryState,
  OfflineRepositorySyncState,
  OfflineSyncStatus,
  OfflineV2Operation,
  OfflineV2Snapshot,
  OfflineSyncResult,
} from "@/lib/offline-v2/types"
import {
  isOfflineLeaseValid,
  OFFLINE_V2_SCHEMA_VERSION,
} from "@/lib/offline-v2/types"
import { selectDashboardViewSource } from "@/lib/offline-v2/view-mode"

type OfflineV2ContextValue = {
  canMutate: boolean
  canQueueOfflineMutation: boolean
  conflicts: OfflineConflict[]
  currentPath: string
  isOnline: boolean
  navigationMode: "history" | "next"
  networkReachability: "offline" | "online" | "unreachable"
  navigate: (href: string, options?: { replace?: boolean }) => void
  operations: OfflineV2Operation[]
  queueOperation: (
    operation: OfflineV2Operation,
    options?: {
      blob?: Blob
      optimistic?: (snapshot: OfflineV2Snapshot) => OfflineV2Snapshot
    }
  ) => Promise<boolean>
  refresh: () => Promise<void>
  repositoryState: OfflineRepositoryState
  snapshot: OfflineV2Snapshot | null
  status: OfflineSyncStatus
  syncState: OfflineRepositorySyncState
  usesLocalRepository: boolean
  viewSource: "cache" | "server"
  workspaceRecoveryRequired: boolean
  recoverWorkspace: () => Promise<void>
  updateSnapshot: (
    updater: (snapshot: OfflineV2Snapshot) => OfflineV2Snapshot
  ) => Promise<void>
}

const OfflineV2Context = createContext<OfflineV2ContextValue | null>(null)
const FOREGROUND_STALE_MS = 30_000
const REPOSITORY_PREPARATION_WAIT_MS = 10_000
const WORKSPACE_RECOVERY_WAIT_MS = 10_000

export function OfflineV2Provider({
  cachedShell = false,
  children,
  serverMembership,
}: {
  cachedShell?: boolean
  children: ReactNode
  serverMembership?: OfflineMembership
}) {
  const [snapshot, setSnapshot] = useState<OfflineV2Snapshot | null>(null)
  const [operations, setOperations] = useState<OfflineV2Operation[]>([])
  const [conflicts, setConflicts] = useState<OfflineConflict[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [networkReachability, setNetworkReachability] = useState<
    "offline" | "online" | "unreachable"
  >(cachedShell ? "offline" : "online")
  const [status, setStatus] = useState<OfflineSyncStatus>("preparing")
  const [repositoryState, setRepositoryState] =
    useState<OfflineRepositoryState>("preparing")
  const [syncState, setSyncState] = useState<OfflineRepositorySyncState>("idle")
  const [workspaceRecoveryRequired, setWorkspaceRecoveryRequired] =
    useState(false)
  const [currentPath, setCurrentPath] = useState("/dashboard")
  const snapshotStateRef = useRef<OfflineV2Snapshot | null>(null)
  const snapshotRevisionRef = useRef(0)
  const refreshInFlightRef = useRef<Promise<void> | null>(null)
  const refreshQueuedRef = useRef(false)
  const lastRefreshAtRef = useRef(0)
  const repositoryStateRef = useRef<OfflineRepositoryState>("preparing")
  const repositoryWaitersRef = useRef(new Set<(ready: boolean) => void>())

  useEffect(() => {
    repositoryStateRef.current = repositoryState
    const current = snapshotStateRef.current
    const writable =
      repositoryState === "ready" &&
      Boolean(current && isOfflineLeaseValid(current.leaseExpiresAt))
    const terminal =
      repositoryState === "locked" ||
      (repositoryState === "unavailable" && !navigator.onLine)
    if (!writable && !terminal) return
    for (const resolve of repositoryWaitersRef.current) resolve(writable)
    repositoryWaitersRef.current.clear()
  }, [repositoryState, snapshot])

  useEffect(
    () => () => {
      for (const resolve of repositoryWaitersRef.current) resolve(false)
      repositoryWaitersRef.current.clear()
    },
    []
  )

  const waitForWritableRepository = useCallback(() => {
    const current = snapshotStateRef.current
    if (
      repositoryStateRef.current === "ready" &&
      current &&
      isOfflineLeaseValid(current.leaseExpiresAt)
    ) {
      return Promise.resolve(true)
    }
    if (
      repositoryStateRef.current === "locked" ||
      (repositoryStateRef.current === "unavailable" && !navigator.onLine)
    ) {
      return Promise.resolve(false)
    }
    return new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (ready: boolean) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        repositoryWaitersRef.current.delete(finish)
        resolve(ready)
      }
      const timeout = window.setTimeout(
        () => finish(false),
        REPOSITORY_PREPARATION_WAIT_MS
      )
      repositoryWaitersRef.current.add(finish)
      const latest = snapshotStateRef.current
      if (
        repositoryStateRef.current === "ready" &&
        latest &&
        isOfflineLeaseValid(latest.leaseExpiresAt)
      ) {
        finish(true)
      }
    })
  }, [])

  const reloadLocalState = useCallback(async () => {
    const [storedSnapshot, storedOperations, storedConflicts, prepared] =
      await Promise.all([
        getOfflineV2Snapshot(),
        getOfflineV2Operations(),
        getOfflineConflicts(),
        isOfflineRepositoryPrepared(window.caches),
      ])
    const schemaMatches =
      !storedSnapshot ||
      storedSnapshot.schemaVersion === OFFLINE_V2_SCHEMA_VERSION
    const identityMatches =
      schemaMatches &&
      (!serverMembership ||
        !storedSnapshot ||
        (storedSnapshot.membership.membershipId ===
          serverMembership.membershipId &&
          storedSnapshot.membership.organisationId ===
            serverMembership.organisationId))
    if (!identityMatches) {
      await Promise.all([
        purgeOfflineV2Data(),
        clearOfflineRepositoryPrepared(navigator.serviceWorker, window.caches),
      ])
    }
    const storedOperationsForIdentity = identityMatches ? storedOperations : []
    const hydratedSnapshot =
      identityMatches && prepared && storedSnapshot
        ? await hydrateOfflineSnapshotMedia(storedSnapshot)
        : null
    const usableSnapshot = hydratedSnapshot
      ? await applyPendingOptimisticState(
          hydratedSnapshot,
          storedOperationsForIdentity
        )
      : null
    snapshotRevisionRef.current = usableSnapshot?.revision ?? 0
    lastRefreshAtRef.current = usableSnapshot
      ? Date.parse(usableSnapshot.refreshedAt)
      : 0
    snapshotStateRef.current = usableSnapshot
    setSnapshot(usableSnapshot)
    setOperations(storedOperationsForIdentity)
    setConflicts(identityMatches ? storedConflicts : [])
    if (!usableSnapshot) {
      await clearOfflineRepositoryPrepared(
        navigator.serviceWorker,
        window.caches
      )
      setRepositoryState("unavailable")
      setStatus("cold")
    } else if (!isOfflineLeaseValid(usableSnapshot.leaseExpiresAt)) {
      setRepositoryState("locked")
      setStatus("lease_expired")
    } else if (
      storedConflicts.length ||
      storedOperationsForIdentity.some(
        (operation) => operation.state === "needs_attention"
      )
    ) {
      setRepositoryState("ready")
      setSyncState("needs_attention")
      setStatus("needs_attention")
    } else if (storedOperationsForIdentity.length) {
      setRepositoryState("ready")
      setSyncState("pending")
      setStatus("changes_pending")
    } else {
      setRepositoryState("ready")
      setSyncState("idle")
      setStatus(navigator.onLine ? "offline_ready" : "offline")
    }
  }, [serverMembership])

  const performRefresh = useCallback(async () => {
    if (!navigator.onLine) {
      await reloadLocalState()
      return
    }
    setSyncState("syncing")
    if (!snapshotStateRef.current) {
      setRepositoryState("preparing")
      setStatus("preparing")
    }
    try {
      const queuedOperations = await getOfflineV2Operations()
      const { readyOperations } = await preparePendingUploads(queuedOperations)
      setStatus(
        readyOperations.length
          ? "syncing"
          : queuedOperations.length
            ? "changes_pending"
            : "preparing"
      )
      const hasSnapshot = Boolean(snapshotStateRef.current)
      const response = await fetch(
        hasSnapshot ? "/api/offline/sync" : "/api/offline/bootstrap",
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          method: hasSnapshot ? "POST" : "GET",
          ...(hasSnapshot
            ? {
                body: JSON.stringify({
                  operations: readyOperations,
                  revision: snapshotRevisionRef.current,
                  schemaVersion: snapshotStateRef.current?.schemaVersion,
                }),
              }
            : {}),
        }
      )
      if (response.status === 401 || response.status === 403) {
        await Promise.all([
          purgeOfflineV2Data(),
          clearOfflineRepositoryPrepared(
            navigator.serviceWorker,
            window.caches
          ),
        ])
        snapshotStateRef.current = null
        setSnapshot(null)
        setOperations([])
        setConflicts([])
        setRepositoryState("unavailable")
        setSyncState("idle")
        setStatus("cold")
        await logoutAction()
        return
      }
      if (!response.ok) throw new Error(`Bootstrap failed: ${response.status}`)
      const payload = (await response.json()) as
        OfflineV2Snapshot | OfflineSyncResult
      const syncResult = "operationResults" in payload ? payload : null
      const currentSnapshot = snapshotStateRef.current
      const nextSnapshot = syncResult
        ? (syncResult.fullSnapshot ??
          (syncResult.patch && currentSnapshot
            ? applyOfflineV2Patch(currentSnapshot, syncResult.patch)
            : currentSnapshot))
        : (payload as OfflineV2Snapshot)
      if (!nextSnapshot) {
        throw new Error("Synchronisation did not return repository data")
      }
      snapshotRevisionRef.current = nextSnapshot.revision
      lastRefreshAtRef.current = Date.now()
      const structuredBytes = new Blob([JSON.stringify(nextSnapshot)]).size
      const capacity = await estimateOfflineCapacity(structuredBytes)
      if (!capacity.sufficient) {
        setSyncState("storage_warning")
        setStatus("storage_warning")
        return
      }
      const storedOperations = await getOfflineV2Operations()
      const replayedById = new Map(
        readyOperations.map((operation) => [
          operation.clientOperationId,
          operation,
        ])
      )
      const resultById = new Map(
        syncResult?.operationResults.map((result) => [
          result.clientOperationId,
          result,
        ]) ?? []
      )
      const nextOperations = storedOperations.flatMap((operation) => {
        const result = resultById.get(operation.clientOperationId)
        if (!result) return [operation]
        if (result.status === "acknowledged") return []
        const replayed =
          replayedById.get(operation.clientOperationId) ?? operation
        return [
          {
            ...replayed,
            lastError:
              result.error ?? "The queued change could not be applied.",
            state:
              result.status === "conflict" ||
              result.status === "needs_attention"
                ? ("needs_attention" as const)
                : ("pending" as const),
          },
        ]
      })
      const existingConflicts = await getOfflineConflicts()
      const nextConflicts = Array.from(
        new Map(
          [...existingConflicts, ...(syncResult?.conflicts ?? [])].map(
            (conflict) => [conflict.clientOperationId, conflict]
          )
        ).values()
      )
      const reconciledSnapshot = currentSnapshot
        ? preservePendingOptimisticDomains(
            nextSnapshot,
            currentSnapshot,
            nextOperations
          )
        : nextSnapshot
      const optimisticSnapshot = await applyPendingOptimisticState(
        reconciledSnapshot,
        nextOperations
      )
      const committedSnapshot = syncResult
        ? await commitOfflineV2Sync({
            conflicts: nextConflicts,
            idMappings: syncResult.idMappings,
            operations: nextOperations,
            snapshot: optimisticSnapshot,
          })
        : optimisticSnapshot
      if (!syncResult) await persistOfflineV2Snapshot(committedSnapshot)
      const detailPatch = syncResult?.patch?.jobDetails
      const mediaComplete = detailPatch
        ? await cacheOfflineSnapshotMedia(
            committedSnapshot,
            detailPatch.reset
              ? undefined
              : Object.keys(detailPatch.upsert).map(Number)
          )
        : syncResult
          ? true
          : await cacheOfflineSnapshotMedia(committedSnapshot)
      const shellReady = await ensureOfflineShellReady(
        navigator.serviceWorker,
        window.caches
      )
      if (mediaComplete && shellReady) {
        await markOfflineRepositoryPrepared(
          navigator.serviceWorker,
          window.caches
        )
      }
      const hydratedSnapshot =
        await hydrateOfflineSnapshotMedia(committedSnapshot)
      snapshotStateRef.current = hydratedSnapshot
      setSnapshot(hydratedSnapshot)
      setOperations(nextOperations)
      setConflicts(nextConflicts)
      setRepositoryState(
        isOfflineLeaseValid(hydratedSnapshot.leaseExpiresAt)
          ? "ready"
          : "locked"
      )
      setSyncState(
        !mediaComplete || !shellReady
          ? "storage_warning"
          : nextConflicts.length ||
              nextOperations.some(
                (operation) => operation.state === "needs_attention"
              )
            ? "needs_attention"
            : nextOperations.length
              ? "pending"
              : "idle"
      )
      setStatus(
        !mediaComplete || !shellReady
          ? "storage_warning"
          : nextConflicts.length ||
              nextOperations.some(
                (operation) => operation.state === "needs_attention"
              )
            ? "needs_attention"
            : nextOperations.length
              ? "changes_pending"
              : "offline_ready"
      )
      setIsOnline(true)
      setNetworkReachability("online")
    } catch (error) {
      console.warn("Offline synchronisation will retry.", error)
      setIsOnline(false)
      setNetworkReachability(navigator.onLine ? "unreachable" : "offline")
      await reloadLocalState()
    }
  }, [reloadLocalState])

  const refresh = useCallback(() => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true
      return refreshInFlightRef.current
    }
    const refreshPromise = runTrailingRefreshLoop(
      refreshQueuedRef,
      performRefresh,
      () => navigator.onLine
    ).finally(() => {
      if (refreshInFlightRef.current === refreshPromise) {
        refreshInFlightRef.current = null
      }
    })
    refreshInFlightRef.current = refreshPromise
    return refreshPromise
  }, [performRefresh])

  const recoverWorkspace = useCallback(async () => {
    await Promise.all([
      deleteOfflineV2Database(),
      clearOfflineRepositoryPrepared(navigator.serviceWorker, window.caches),
    ])
    window.location.reload()
  }, [])

  useEffect(() => {
    let cancelled = false
    const recoveryTimeout = window.setTimeout(() => {
      if (!cancelled && repositoryStateRef.current === "preparing") {
        setWorkspaceRecoveryRequired(true)
      }
    }, WORKSPACE_RECOVERY_WAIT_MS)
    void (async () => {
      try {
        setIsOnline(navigator.onLine)
        setNetworkReachability(navigator.onLine ? "online" : "offline")
        setCurrentPath(`${window.location.pathname}${window.location.search}`)
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
          setRepositoryState("unavailable")
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
      } catch (error) {
        console.error("Unable to open the offline workspace.", error)
        if (!cancelled) setWorkspaceRecoveryRequired(true)
      } finally {
        window.clearTimeout(recoveryTimeout)
      }
    })()
    return () => {
      cancelled = true
      window.clearTimeout(recoveryTimeout)
    }
  }, [refresh, reloadLocalState])

  useEffect(() => {
    const onOnline = () => {
      void refresh()
    }
    const onOffline = () => {
      setIsOnline(false)
      setNetworkReachability("offline")
      void reloadLocalState()
    }
    const onVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        Date.now() - lastRefreshAtRef.current >= FOREGROUND_STALE_MS
      ) {
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

  useEffect(() => {
    if (
      networkReachability === "offline" ||
      !operations.some((operation) => operation.state !== "needs_attention")
    ) {
      return
    }
    const retry = window.setTimeout(() => void refresh(), 5_000)
    return () => window.clearTimeout(retry)
  }, [networkReachability, operations, refresh])

  useEffect(() => {
    if (networkReachability !== "unreachable" || !navigator.onLine) return
    const retry = window.setTimeout(() => void refresh(), 5_000)
    return () => window.clearTimeout(retry)
  }, [networkReachability, refresh])

  const viewSource = selectDashboardViewSource({
    cachedShell,
    repositoryState,
    snapshotAvailable: Boolean(snapshot),
  })

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
    if (
      repositoryState !== "ready" ||
      !navigator.onLine ||
      Date.now() - lastRefreshAtRef.current < FOREGROUND_STALE_MS
    ) {
      return
    }
    void refresh()
  }, [currentPath, refresh, repositoryState])

  useEffect(() => {
    if (viewSource !== "cache") return
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
      navigate(`${url.pathname}${url.search}`)
    }
    document.addEventListener("click", interceptDashboardLink, true)
    return () =>
      document.removeEventListener("click", interceptDashboardLink, true)
  }, [navigate, viewSource])

  const queueOperation = useCallback(
    async (
      operation: OfflineV2Operation,
      options?: {
        blob?: Blob
        optimistic?: (snapshot: OfflineV2Snapshot) => OfflineV2Snapshot
      }
    ) => {
      if (!(await waitForWritableRepository())) return false
      const current = snapshotStateRef.current
      if (
        repositoryStateRef.current !== "ready" ||
        !current ||
        !isOfflineLeaseValid(current.leaseExpiresAt)
      ) {
        return false
      }
      const next = options?.optimistic ? options.optimistic(current) : current
      await commitOfflineV2Operation({
        ...(options?.blob ? { blob: options.blob } : {}),
        operation,
        snapshot: next,
      })
      snapshotStateRef.current = next
      setSnapshot(next)
      setOperations((existing) =>
        [
          ...existing.filter(
            (item) => item.clientOperationId !== operation.clientOperationId
          ),
          operation,
        ].toSorted((left, right) =>
          left.createdAt.localeCompare(right.createdAt)
        )
      )
      setSyncState("pending")
      setStatus("changes_pending")
      if (navigator.onLine) window.setTimeout(() => void refresh(), 0)
      return true
    },
    [refresh, waitForWritableRepository]
  )

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

  const canQueueOfflineMutation =
    viewSource === "cache" &&
    repositoryState === "ready" &&
    Boolean(snapshot && isOfflineLeaseValid(snapshot.leaseExpiresAt))

  const value = useMemo<OfflineV2ContextValue>(
    () => ({
      canMutate: canQueueOfflineMutation,
      canQueueOfflineMutation,
      conflicts,
      currentPath,
      isOnline,
      navigationMode: viewSource === "cache" ? "history" : "next",
      networkReachability,
      navigate,
      operations,
      queueOperation,
      recoverWorkspace,
      refresh,
      repositoryState,
      snapshot,
      status,
      syncState,
      usesLocalRepository: viewSource === "cache",
      updateSnapshot,
      viewSource,
      workspaceRecoveryRequired,
    }),
    [
      canQueueOfflineMutation,
      conflicts,
      currentPath,
      isOnline,
      navigate,
      operations,
      networkReachability,
      queueOperation,
      recoverWorkspace,
      refresh,
      repositoryState,
      snapshot,
      status,
      syncState,
      updateSnapshot,
      viewSource,
      workspaceRecoveryRequired,
    ]
  )

  return (
    <OfflineV2Context.Provider value={value}>
      <div
        className="contents"
        data-offline-provider={status}
        data-offline-repository={viewSource}
        data-network-reachability={networkReachability}
        data-repository-state={repositoryState}
        data-sync-state={syncState}
        data-view-source={viewSource}
      >
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

export async function runTrailingRefreshLoop(
  queued: { current: boolean },
  performRefresh: () => Promise<void>,
  canRepeat: () => boolean
) {
  do {
    queued.current = false
    await performRefresh()
  } while (queued.current && canRepeat())
}

async function preparePendingUploads(operations: OfflineV2Operation[]) {
  const blockedOperationIds = new Set<string>()
  const readyOperations: OfflineV2Operation[] = []
  for (const operation of operations) {
    if (
      operation.dependsOn.some((dependency) =>
        blockedOperationIds.has(dependency)
      )
    ) {
      blockedOperationIds.add(operation.clientOperationId)
      continue
    }
    if (
      operation.kind === "membership.create" ||
      operation.kind === "membership.update" ||
      operation.kind === "profile.update"
    ) {
      const avatar = await getOfflineV2Blob(operation.clientOperationId)
      if (avatar) {
        readyOperations.push({
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
      readyOperations.push(operation)
      continue
    }
    const blob = await getOfflineV2Blob(operation.clientOperationId)
    if (!blob) {
      await putOfflineV2Operation({
        ...operation,
        lastError: "The queued photo is missing from this device.",
        state: "needs_attention",
      })
      blockedOperationIds.add(operation.clientOperationId)
      continue
    }
    const uploadInput = {
      clientOperationId: operation.clientOperationId,
      extension: String(operation.payload.extension ?? ""),
      jobId: operation.entity.id,
      mimeType: String(operation.payload.mimeType ?? blob.type),
    }
    if (operation.lastError) {
      try {
        const existing = await verifyOfflineEvidenceUploadAction(uploadInput)
        if (existing.ok) {
          const next: OfflineV2Operation = {
            ...operation,
            lastError: undefined,
            payload: {
              ...operation.payload,
              storagePath: existing.objectName,
            },
            state: "pending",
          }
          await putOfflineV2Operation(next)
          readyOperations.push(next)
          continue
        }
      } catch {
        // A failed verification is ambiguous, so retry the deterministic upload.
      }
    }
    const prepared = await prepareOfflineEvidenceUploadAction(uploadInput)
    if (!prepared.ok) {
      await putOfflineV2Operation({
        ...operation,
        lastError: prepared.message,
        state: prepared.retryable ? "pending" : "needs_attention",
      })
      blockedOperationIds.add(operation.clientOperationId)
      continue
    }
    const uploadFile = restoreOfflineEvidenceFile(blob, {
      clientOperationId: operation.clientOperationId,
      extension: uploadInput.extension,
      mimeType: prepared.contentType,
    })
    if (!uploadFile) {
      await putOfflineV2Operation({
        ...operation,
        lastError: "The queued photo metadata is invalid.",
        state: "needs_attention",
      })
      blockedOperationIds.add(operation.clientOperationId)
      continue
    }
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.storage
      .from(prepared.bucketName)
      .uploadToSignedUrl(prepared.objectName, prepared.signature, uploadFile, {
        contentType: prepared.contentType,
      })
    if (error) {
      const verified = await verifyOfflineUploadAfterError(uploadInput)
      if (!verified.ok) {
        await putOfflineV2Operation({
          ...operation,
          lastError: storageUploadErrorMessage(error),
          state: "pending",
        })
        blockedOperationIds.add(operation.clientOperationId)
        continue
      }
    }
    const next: OfflineV2Operation = {
      ...operation,
      lastError: undefined,
      payload: {
        ...operation.payload,
        storagePath: prepared.objectName,
      },
      state: "pending",
    }
    await putOfflineV2Operation(next)
    readyOperations.push(next)
  }
  return { readyOperations }
}

async function applyPendingOptimisticState(
  snapshot: OfflineV2Snapshot,
  operations: OfflineV2Operation[]
) {
  let optimistic = snapshot
  for (const operation of operations) {
    if (
      operation.entityType !== "job" ||
      operation.entity.source !== "server"
    ) {
      continue
    }
    const jobId = operation.entity.id
    if (operation.kind === "job.start") {
      optimistic = updateJobEverywhere(optimistic, jobId, (job) => ({
        ...job,
        startedAt:
          typeof job.startedAt === "string"
            ? job.startedAt
            : operation.createdAt,
        status: "in_progress",
      }))
      continue
    }
    if (operation.kind === "job.note") {
      optimistic = updateJobEverywhere(optimistic, jobId, (job) => ({
        ...job,
        noteCount: Number(job.noteCount ?? 0) + 1,
        completionNoteCount: Number(job.completionNoteCount ?? 0) + 1,
      }))
      continue
    }
    if (operation.kind === "job.submit") {
      optimistic = submitJobEverywhere(
        optimistic,
        jobId,
        typeof operation.payload.submittedAt === "string"
          ? operation.payload.submittedAt
          : operation.createdAt
      )
      continue
    }
    if (operation.kind !== "job.evidence.add") continue
    const temporaryAssetId = operation.payload.temporaryAssetId
    if (typeof temporaryAssetId !== "number") continue
    const blob = await getOfflineV2Blob(operation.clientOperationId)
    if (!blob) continue
    optimistic = updateJobEverywhere(optimistic, jobId, (job) => {
      const evidence = job.evidence ?? []
      if (evidence.some((asset) => asset.id === temporaryAssetId)) return job
      return {
        ...job,
        evidence: [
          ...evidence,
          {
            createdAt: operation.createdAt,
            id: temporaryAssetId,
            mimeType: String(operation.payload.mimeType ?? blob.type),
            removable: true,
            signedUrl: URL.createObjectURL(blob),
            sizeBytes: blob.size,
            uploadedByMembershipId: optimistic.membership.membershipId,
          },
        ],
        pendingEvidenceCount: Number(job.pendingEvidenceCount ?? 0) + 1,
        completionPhotoCount: Number(job.completionPhotoCount ?? 0) + 1,
      }
    })
  }
  return optimistic
}

function storageUploadErrorMessage(error: {
  message?: string
  statusCode?: string
}) {
  const detail = [error.statusCode, error.message]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(": ")
  return detail
    ? `The queued photo could not upload (${detail}). It will retry automatically.`
    : "The queued photo could not upload. It will retry automatically."
}

async function verifyOfflineUploadAfterError(input: {
  clientOperationId: string
  extension: string
  jobId: number
  mimeType: string
}) {
  try {
    return await verifyOfflineEvidenceUploadAction(input)
  } catch {
    return {
      message: "The queued photo upload could not be verified yet.",
      ok: false,
    } as const
  }
}

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}
