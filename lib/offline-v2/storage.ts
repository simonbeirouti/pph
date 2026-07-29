"use client"

import {
  getOperations as getLegacyOperations,
  getPhoto as getLegacyPhoto,
} from "@/lib/offline/storage"
import type {
  OfflineConflict,
  OfflineV2Operation,
  OfflineV2Snapshot,
} from "@/lib/offline-v2/types"

const DATABASE_NAME = "pph-offline-v2"
const DATABASE_VERSION = 1

const STORES = {
  blobs: "blobs",
  conflicts: "conflicts",
  entities: "entities",
  mappings: "mappings",
  media: "media",
  metadata: "metadata",
  outbox: "outbox",
  snapshots: "snapshots",
} as const

const ACTIVE_IDENTITY_KEY = "active-identity"
const ACTIVE_SNAPSHOT_KEY = "active"
const LEGACY_MIGRATED_KEY = "legacy-migrated"
const LOGOUT_PENDING_KEY = "logout-pending"

type StoreName = (typeof STORES)[keyof typeof STORES]

type OfflineIdentityKey = {
  membershipId: number
  organisationId: number
}

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase() {
  if (databasePromise) return databasePromise
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      for (const store of Object.values(STORES)) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store)
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error("Offline storage upgrade is blocked by another tab"))
  })
  return databasePromise
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Offline storage transaction aborted"))
  })
}

async function getValue<T>(storeName: StoreName, key: IDBValidKey) {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, "readonly")
  return requestResult(
    transaction.objectStore(storeName).get(key) as IDBRequest<T | undefined>
  )
}

async function putValue(
  storeName: StoreName,
  key: IDBValidKey,
  value: unknown
) {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, "readwrite")
  transaction.objectStore(storeName).put(value, key)
  await transactionDone(transaction)
}

async function getAllValues<T>(storeName: StoreName) {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, "readonly")
  return requestResult(
    transaction.objectStore(storeName).getAll() as IDBRequest<T[]>
  )
}

export async function persistOfflineV2Snapshot(snapshot: OfflineV2Snapshot) {
  const database = await openDatabase()
  const identity: OfflineIdentityKey = {
    membershipId: snapshot.membership.membershipId,
    organisationId: snapshot.membership.organisationId,
  }
  const current = await getValue<OfflineIdentityKey>(
    STORES.metadata,
    ACTIVE_IDENTITY_KEY
  )
  if (
    current &&
    (current.membershipId !== identity.membershipId ||
      current.organisationId !== identity.organisationId)
  ) {
    await purgeOfflineV2Data()
  }

  const transaction = database.transaction(
    [STORES.metadata, STORES.snapshots, STORES.entities],
    "readwrite"
  )
  transaction.objectStore(STORES.metadata).put(identity, ACTIVE_IDENTITY_KEY)
  transaction.objectStore(STORES.snapshots).put(snapshot, ACTIVE_SNAPSHOT_KEY)
  const entities = transaction.objectStore(STORES.entities)
  entities.clear()
  for (const [key, value] of normaliseSnapshot(snapshot)) {
    entities.put(value, key)
  }
  await transactionDone(transaction)
  await requestPersistentStorage()
}

export async function getOfflineV2Snapshot() {
  return (
    (await getValue<OfflineV2Snapshot>(
      STORES.snapshots,
      ACTIVE_SNAPSHOT_KEY
    )) ?? null
  )
}

export async function getOfflineV2Identity() {
  return (
    (await getValue<OfflineIdentityKey>(
      STORES.metadata,
      ACTIVE_IDENTITY_KEY
    )) ?? null
  )
}

export async function putOfflineV2Operation(operation: OfflineV2Operation) {
  await putValue(
    STORES.outbox,
    operation.clientOperationId,
    operation
  )
}

export async function getOfflineV2Operations() {
  const operations = await getAllValues<OfflineV2Operation>(STORES.outbox)
  return operations.toSorted((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  )
}

export async function removeOfflineV2Operation(clientOperationId: string) {
  const database = await openDatabase()
  const transaction = database.transaction(
    [STORES.outbox, STORES.blobs],
    "readwrite"
  )
  transaction.objectStore(STORES.outbox).delete(clientOperationId)
  transaction.objectStore(STORES.blobs).delete(clientOperationId)
  await transactionDone(transaction)
}

export async function putOfflineV2Blob(
  clientOperationId: string,
  blob: Blob
) {
  await putValue(STORES.blobs, clientOperationId, blob)
}

export async function getOfflineV2Blob(clientOperationId: string) {
  return (
    (await getValue<Blob>(STORES.blobs, clientOperationId)) ?? null
  )
}

export async function putOfflineConflict(conflict: OfflineConflict) {
  await putValue(
    STORES.conflicts,
    conflict.clientOperationId,
    conflict
  )
}

export async function getOfflineConflicts() {
  return getAllValues<OfflineConflict>(STORES.conflicts)
}

export async function removeOfflineConflict(clientOperationId: string) {
  const database = await openDatabase()
  const transaction = database.transaction(STORES.conflicts, "readwrite")
  transaction.objectStore(STORES.conflicts).delete(clientOperationId)
  await transactionDone(transaction)
}

export async function putOfflineIdMapping(localId: string, serverId: number) {
  await putValue(STORES.mappings, localId, serverId)
}

export async function applyOfflineIdMappings(
  mappings: Record<string, number>
) {
  if (!Object.keys(mappings).length) return
  const [operations, snapshot] = await Promise.all([
    getOfflineV2Operations(),
    getOfflineV2Snapshot(),
  ])
  const database = await openDatabase()
  const transaction = database.transaction(
    [STORES.mappings, STORES.outbox, STORES.snapshots],
    "readwrite"
  )
  const mappingStore = transaction.objectStore(STORES.mappings)
  for (const [localId, serverId] of Object.entries(mappings)) {
    mappingStore.put(serverId, localId)
  }
  const outbox = transaction.objectStore(STORES.outbox)
  for (const operation of operations) {
    outbox.put(
      rewriteMappedValues(operation, mappings),
      operation.clientOperationId
    )
  }
  if (snapshot) {
    transaction
      .objectStore(STORES.snapshots)
      .put(rewriteMappedValues(snapshot, mappings), ACTIVE_SNAPSHOT_KEY)
  }
  await transactionDone(transaction)
}

export async function putOfflineMedia(key: string, blob: Blob) {
  await putValue(STORES.media, key, blob)
}

export async function getOfflineMedia(key: string) {
  return (await getValue<Blob>(STORES.media, key)) ?? null
}

export async function cacheOfflineSnapshotMedia(snapshot: OfflineV2Snapshot) {
  const urls = snapshotMediaUrls(snapshot)
  for (const url of urls) {
    const key = mediaKey(url)
    if (await getOfflineMedia(key)) continue
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
    }).catch(() => null)
    if (!response?.ok) return false
    const blob = await response.blob()
    const capacity = await estimateOfflineCapacity(blob.size)
    if (!capacity.sufficient) return false
    await putOfflineMedia(key, blob)
  }
  return true
}

export async function hydrateOfflineSnapshotMedia(
  snapshot: OfflineV2Snapshot
) {
  const hydrated = structuredClone(snapshot)
  const replacements = new Map<string, string>()
  for (const url of snapshotMediaUrls(hydrated)) {
    const blob = await getOfflineMedia(mediaKey(url))
    if (blob) replacements.set(url, URL.createObjectURL(blob))
  }
  hydrated.profile.avatarUrl =
    replaceMediaUrl(hydrated.profile.avatarUrl, replacements)
  if (hydrated.people) {
    hydrated.people.employees = hydrated.people.employees.map((employee) => ({
      ...employee,
      avatarUrl: replaceMediaUrl(employee.avatarUrl, replacements),
    }))
  }
  for (const detail of Object.values(hydrated.jobDetails)) {
    detail.evidence = detail.evidence.map((asset) => ({
      ...asset,
      signedUrl: replacements.get(asset.signedUrl) ?? asset.signedUrl,
    }))
  }
  return hydrated
}

export async function setOfflineLogoutPending(pending: boolean) {
  if (pending) {
    await putValue(STORES.metadata, LOGOUT_PENDING_KEY, true)
    return
  }
  const database = await openDatabase()
  const transaction = database.transaction(STORES.metadata, "readwrite")
  transaction.objectStore(STORES.metadata).delete(LOGOUT_PENDING_KEY)
  await transactionDone(transaction)
}

export async function isOfflineLogoutPending() {
  return (
    (await getValue<boolean>(STORES.metadata, LOGOUT_PENDING_KEY)) === true
  )
}

export async function purgeOfflineV2Data(options?: {
  preserveLogoutMarker?: boolean
}) {
  const logoutPending = options?.preserveLogoutMarker
    ? await getValue<boolean>(STORES.metadata, LOGOUT_PENDING_KEY)
    : false
  const database = await openDatabase()
  const transaction = database.transaction(
    Object.values(STORES),
    "readwrite"
  )
  for (const storeName of Object.values(STORES)) {
    transaction.objectStore(storeName).clear()
  }
  if (logoutPending) {
    transaction
      .objectStore(STORES.metadata)
      .put(true, LOGOUT_PENDING_KEY)
  }
  await transactionDone(transaction)
}

export async function migrateLegacyOfflineData() {
  if (
    (await getValue<boolean>(STORES.metadata, LEGACY_MIGRATED_KEY)) === true
  ) {
    return
  }
  const legacyOperations = await getLegacyOperations()
  for (const operation of legacyOperations) {
    const migrated: OfflineV2Operation = {
      clientOperationId: operation.clientOperationId,
      createdAt: operation.createdAt,
      dependsOn: operation.dependsOn,
      entity: { id: operation.jobId, source: "server" },
      entityType: "job",
      expectedVersion: operation.expectedVersion,
      kind:
        operation.kind === "photo"
          ? "job.evidence.add"
          : operation.kind === "start"
            ? "job.start"
            : operation.kind === "note"
              ? "job.note"
              : "job.submit",
      lastError: operation.lastError,
      payload: operation.payload,
      state: operation.state,
    }
    await putOfflineV2Operation(migrated)
    if (operation.kind === "photo") {
      const photo = await getLegacyPhoto(operation.clientOperationId)
      if (photo) await putOfflineV2Blob(operation.clientOperationId, photo)
    }
  }
  await putValue(STORES.metadata, LEGACY_MIGRATED_KEY, true)
}

export async function estimateOfflineCapacity(requiredBytes = 0) {
  if (!navigator.storage?.estimate) {
    return { availableBytes: null, sufficient: true }
  }
  const estimate = await navigator.storage.estimate()
  const availableBytes =
    estimate.quota === undefined || estimate.usage === undefined
      ? null
      : Math.max(0, estimate.quota - estimate.usage)
  return {
    availableBytes,
    sufficient: availableBytes === null || availableBytes >= requiredBytes,
  }
}

async function requestPersistentStorage() {
  if (navigator.storage?.persist) {
    await navigator.storage.persist().catch(() => false)
  }
}

function normaliseSnapshot(snapshot: OfflineV2Snapshot) {
  const entities = new Map<string, unknown>()
  for (const job of snapshot.jobs?.jobs ?? snapshot.employeeJobs) {
    entities.set(`job:${job.id}`, job)
  }
  for (const detail of Object.values(snapshot.jobDetails)) {
    entities.set(`job-detail:${detail.id}`, detail)
  }
  for (const shift of snapshot.roster.shifts) {
    entities.set(`roster-shift:${shift.id}`, shift)
  }
  for (const employee of snapshot.people?.employees ?? [snapshot.profile]) {
    entities.set(`membership:${employee.membershipId}`, employee)
  }
  for (const template of snapshot.templates?.templates ?? []) {
    entities.set(`job-template:${template.id}`, template)
  }
  for (const schedule of snapshot.templates?.schedules ?? []) {
    entities.set(`job-schedule:${schedule.id}`, schedule)
  }
  entities.set(
    `profile:${snapshot.profile.membershipId}`,
    snapshot.profile
  )
  return entities
}

function snapshotMediaUrls(snapshot: OfflineV2Snapshot) {
  const urls = new Set<string>()
  for (const detail of Object.values(snapshot.jobDetails)) {
    if (detail.status === "archived") continue
    for (const asset of detail.evidence) {
      if (asset.signedUrl) urls.add(asset.signedUrl)
    }
  }
  if (snapshot.profile.avatarUrl) urls.add(snapshot.profile.avatarUrl)
  for (const employee of snapshot.people?.employees ?? []) {
    if (employee.avatarUrl) urls.add(employee.avatarUrl)
  }
  return urls
}

function mediaKey(url: string) {
  const parsed = new URL(url, window.location.origin)
  return `${parsed.origin}${parsed.pathname}`
}

function replaceMediaUrl(
  value: string | null,
  replacements: Map<string, string>
) {
  return value ? replacements.get(value) ?? value : null
}

function rewriteMappedValues(
  value: unknown,
  mappings: Record<string, number>
): unknown {
  if (typeof value === "number" || typeof value === "string") {
    return mappings[String(value)] ?? value
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteMappedValues(item, mappings))
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        rewriteMappedValues(item, mappings),
      ])
    )
  }
  return value
}
