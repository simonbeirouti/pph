"use client"

import { clear, createStore, del, get, set, values } from "idb-keyval"
import type { PersistedClient } from "@tanstack/react-query-persist-client"

import {
  OFFLINE_CACHE_MAX_AGE,
  type OfflineIdentity,
  type OfflineOperation,
  type OfflineWorkPack,
} from "@/lib/offline/types"

const metadataStore = createStore("pph-offline-metadata-v1", "keyval")
const queryStore = createStore("pph-offline-query-v1", "keyval")
const outboxStore = createStore("pph-offline-outbox-v1", "keyval")
const photoStore = createStore("pph-offline-photos-v1", "keyval")

const IDENTITY_KEY = "active-identity"
const CONSENT_KEY = "offline-consent"
export const QUERY_CLIENT_KEY = "assigned-work"

export async function getOfflineIdentity() {
  return (await get<OfflineIdentity>(IDENTITY_KEY, metadataStore)) ?? null
}

export async function hasOfflineConsent() {
  return (await get<boolean>(CONSENT_KEY, metadataStore)) === true
}

export async function setOfflineConsent(consent: boolean) {
  if (!consent) {
    await purgeOfflineData()
    return
  }
  await set(CONSENT_KEY, true, metadataStore)
  if ("storage" in navigator && "persist" in navigator.storage) {
    await navigator.storage.persist().catch(() => false)
  }
}

export async function ensureOfflineIdentity(identity: OfflineIdentity) {
  const current = await getOfflineIdentity()
  if (
    current &&
    (current.membershipId !== identity.membershipId ||
      current.organisationId !== identity.organisationId)
  ) {
    await purgeOfflineData()
  }
  await set(IDENTITY_KEY, identity, metadataStore)
}

export async function persistQueryClient(client: PersistedClient) {
  if (!(await hasOfflineConsent())) return
  await set(QUERY_CLIENT_KEY, client, queryStore)
}

export async function restoreQueryClient() {
  return get<PersistedClient>(QUERY_CLIENT_KEY, queryStore)
}

export async function removeQueryClient() {
  await del(QUERY_CLIENT_KEY, queryStore)
}

export async function putOperation(operation: OfflineOperation) {
  await set(operation.clientOperationId, operation, outboxStore)
}

export async function getOperations() {
  const entries = await values<OfflineOperation>(outboxStore)
  return entries.toSorted((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  )
}

export async function removeOperation(clientOperationId: string) {
  await Promise.all([
    del(clientOperationId, outboxStore),
    del(clientOperationId, photoStore),
  ])
}

export async function putPhoto(clientOperationId: string, blob: Blob) {
  await set(clientOperationId, blob, photoStore)
}

export async function getPhoto(clientOperationId: string) {
  return (await get<Blob>(clientOperationId, photoStore)) ?? null
}

export async function canStorePhoto(sizeBytes: number) {
  if (!("storage" in navigator) || !navigator.storage.estimate) return true
  const estimate = await navigator.storage.estimate()
  if (estimate.quota === undefined || estimate.usage === undefined) return true
  return estimate.quota - estimate.usage >= sizeBytes
}

export async function getPersistedWorkPack() {
  const persisted = await restoreQueryClient()
  if (!persisted) {
    return null
  }
  for (const query of persisted.clientState.queries) {
    if (query.meta?.offlineWorkPack === true && query.state.data) {
      const pack = query.state.data as OfflineWorkPack
      if (
        Date.now() - new Date(pack.refreshedAt).getTime() >
        OFFLINE_CACHE_MAX_AGE
      ) {
        await removeQueryClient()
        return null
      }
      return pack
    }
  }
  if (Date.now() - persisted.timestamp > OFFLINE_CACHE_MAX_AGE) {
    await removeQueryClient()
  }
  return null
}

export async function purgeOfflineData() {
  await Promise.all([
    clear(queryStore),
    clear(outboxStore),
    clear(photoStore),
    clear(metadataStore),
  ])
}
