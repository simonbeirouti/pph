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
import {
  prepareOfflineEvidenceUploadAction,
  verifyOfflineEvidenceUploadAction,
} from "@/app/dashboard/jobs/offline-actions"
import { ensureOfflineShellReady } from "@/components/service-worker-registration"
import { restoreOfflineEvidenceFile } from "@/lib/offline-v2/evidence-upload"
import { updateJobEverywhere } from "@/lib/offline-v2/optimistic"
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
  usesLocalRepository: boolean
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
  const [usesLocalRepository, setUsesLocalRepository] = useState(false)
  const [currentPath, setCurrentPath] = useState("/dashboard")
  const snapshotStateRef = useRef<OfflineV2Snapshot | null>(null)
  const snapshotRevisionRef = useRef(0)
  const refreshInFlightRef = useRef<Promise<void> | null>(null)

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
    const storedOperationsForIdentity = identityMatches ? storedOperations : []
    const hydratedSnapshot =
      identityMatches && storedSnapshot
        ? await hydrateOfflineSnapshotMedia(storedSnapshot)
        : null
    const usableSnapshot = hydratedSnapshot
      ? await applyPendingOptimisticState(
          hydratedSnapshot,
          storedOperationsForIdentity
        )
      : null
    snapshotRevisionRef.current = usableSnapshot?.revision ?? 0
    snapshotStateRef.current = usableSnapshot
    setSnapshot(usableSnapshot)
    setOperations(storedOperationsForIdentity)
    setConflicts(identityMatches ? storedConflicts : [])
    if (
      usableSnapshot &&
      (!navigator.onLine ||
        storedOperationsForIdentity.length > 0 ||
        storedConflicts.length > 0)
    ) {
      setUsesLocalRepository(true)
    }
    if (!usableSnapshot) {
      setStatus("cold")
    } else if (!isOfflineLeaseValid(usableSnapshot.leaseExpiresAt)) {
      setStatus("lease_expired")
    } else if (
      storedConflicts.length ||
      storedOperationsForIdentity.some(
        (operation) => operation.state === "needs_attention"
      )
    ) {
      setStatus("needs_attention")
    } else if (storedOperationsForIdentity.length) {
      setStatus("changes_pending")
    } else {
      setStatus(navigator.onLine ? "offline_ready" : "offline")
    }
  }, [serverMembership])

  const performRefresh = useCallback(async () => {
    if (!navigator.onLine) {
      await reloadLocalState()
      return
    }
    setStatus("preparing")
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
      const response = await fetch(
        readyOperations.length ? "/api/offline/sync" : "/api/offline/bootstrap",
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          method: readyOperations.length ? "POST" : "GET",
          ...(readyOperations.length
            ? {
                body: JSON.stringify({
                  operations: readyOperations,
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
        setUsesLocalRepository(false)
        setStatus("cold")
        return
      }
      if (!response.ok) throw new Error(`Bootstrap failed: ${response.status}`)
      const payload = (await response.json()) as
        OfflineV2Snapshot | OfflineSyncResult
      const syncResult = "operationResults" in payload ? payload : null
      if (syncResult) {
        const replayedById = new Map(
          readyOperations.map((operation) => [
            operation.clientOperationId,
            operation,
          ])
        )
        for (const result of syncResult.operationResults) {
          if (result.status === "acknowledged") {
            await removeOfflineV2Operation(result.clientOperationId)
            continue
          }
          const replayed = replayedById.get(result.clientOperationId)
          if (replayed) {
            await putOfflineV2Operation({
              ...replayed,
              lastError:
                result.error ?? "The queued change could not be applied.",
              state:
                result.status === "conflict" ||
                result.status === "needs_attention"
                  ? "needs_attention"
                  : "pending",
            })
          }
        }
        for (const conflict of syncResult.conflicts) {
          await putOfflineConflict(conflict)
        }
        await applyOfflineIdMappings(syncResult.idMappings)
      }
      const nextSnapshot =
        syncResult?.snapshot ?? (payload as OfflineV2Snapshot)
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
      const [nextOperations, nextConflicts] = await Promise.all([
        getOfflineV2Operations(),
        getOfflineConflicts(),
      ])
      const hydratedSnapshot = await hydrateOfflineSnapshotMedia(nextSnapshot)
      const optimisticSnapshot = await applyPendingOptimisticState(
        hydratedSnapshot,
        nextOperations
      )
      snapshotStateRef.current = optimisticSnapshot
      setSnapshot(optimisticSnapshot)
      setOperations(nextOperations)
      setConflicts(nextConflicts)
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
    } catch (error) {
      console.warn("Offline synchronisation will retry.", error)
      await reloadLocalState()
    }
  }, [reloadLocalState])

  const refresh = useCallback(() => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current
    const refreshPromise = performRefresh().finally(() => {
      if (refreshInFlightRef.current === refreshPromise) {
        refreshInFlightRef.current = null
      }
    })
    refreshInFlightRef.current = refreshPromise
    return refreshPromise
  }, [performRefresh])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsOnline(navigator.onLine)
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
        setUsesLocalRepository(false)
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
      setUsesLocalRepository(true)
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

  useEffect(() => {
    if (
      !isOnline ||
      !operations.some((operation) => operation.state !== "needs_attention")
    ) {
      return
    }
    const retry = window.setTimeout(() => void refresh(), 5_000)
    return () => window.clearTimeout(retry)
  }, [isOnline, operations, refresh])

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
    if (!usesLocalRepository) return
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
  }, [navigate, usesLocalRepository])

  const queueOperation = useCallback(async (operation: OfflineV2Operation) => {
    await putOfflineV2Operation(operation)
    setUsesLocalRepository(true)
    setOperations((current) =>
      [
        ...current.filter(
          (item) => item.clientOperationId !== operation.clientOperationId
        ),
        operation,
      ].toSorted((left, right) => left.createdAt.localeCompare(right.createdAt))
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
      usesLocalRepository,
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
      usesLocalRepository,
      updateSnapshot,
    ]
  )

  return (
    <OfflineV2Context.Provider value={value}>
      <div
        className="contents"
        data-offline-provider={status}
        data-offline-repository={usesLocalRepository ? "local" : "server"}
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
      optimistic = updateJobEverywhere(optimistic, jobId, (job) => ({
        ...job,
        status: "in_review",
        submittedAt:
          typeof operation.payload.submittedAt === "string"
            ? operation.payload.submittedAt
            : operation.createdAt,
      }))
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
