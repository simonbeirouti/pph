"use client"

import { useEffect } from "react"

export const OFFLINE_SHELL_VERSION = "pph-dashboard-shell-v11"
const OFFLINE_REPOSITORY_READY_URL = "/offline-repository-ready"

export function offlineShellIsEnabled() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_PPH_PLAYWRIGHT_SERVER === "1"
  )
}

async function getControlledShellVersion(
  serviceWorker: ServiceWorkerContainer
): Promise<string | null> {
  if (!serviceWorker.controller) return null

  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(() => resolve(null), 2_000)
    channel.port1.onmessage = (event: MessageEvent<{ version?: string }>) => {
      window.clearTimeout(timeout)
      resolve(event.data.version ?? null)
    }
    serviceWorker.controller?.postMessage(
      { type: "PPH_OFFLINE_SHELL_VERSION" },
      [channel.port2]
    )
  })
}

async function postShellMessage(
  serviceWorker: ServiceWorkerContainer | undefined,
  type: "PPH_OFFLINE_REPOSITORY_CLEAR" | "PPH_OFFLINE_REPOSITORY_READY"
) {
  if (!serviceWorker?.controller) return false
  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(() => resolve(false), 2_000)
    channel.port1.onmessage = (event: MessageEvent<{ ok?: boolean }>) => {
      window.clearTimeout(timeout)
      resolve(event.data.ok === true)
    }
    serviceWorker.controller?.postMessage({ type }, [channel.port2])
  })
}

export async function markOfflineRepositoryPrepared(
  serviceWorker: ServiceWorkerContainer | undefined,
  cacheStorage: CacheStorage | undefined
) {
  if (!offlineShellIsEnabled()) return true
  if (!serviceWorker || !cacheStorage) return false
  if (
    (await getControlledShellVersion(serviceWorker)) !== OFFLINE_SHELL_VERSION
  ) {
    return false
  }
  return postShellMessage(serviceWorker, "PPH_OFFLINE_REPOSITORY_READY")
}

export async function isOfflineRepositoryPrepared(
  cacheStorage: CacheStorage | undefined
) {
  if (!offlineShellIsEnabled()) return true
  if (!cacheStorage) return false
  try {
    const cache = await cacheStorage.open(OFFLINE_SHELL_VERSION)
    return Boolean(await cache.match(OFFLINE_REPOSITORY_READY_URL))
  } catch {
    return false
  }
}

export async function clearOfflineRepositoryPrepared(
  serviceWorker: ServiceWorkerContainer | undefined,
  cacheStorage: CacheStorage | undefined
) {
  if (!offlineShellIsEnabled()) return true
  const acknowledged = await postShellMessage(
    serviceWorker,
    "PPH_OFFLINE_REPOSITORY_CLEAR"
  )
  try {
    const cache = await cacheStorage?.open(OFFLINE_SHELL_VERSION)
    const deleted = await cache?.delete(OFFLINE_REPOSITORY_READY_URL)
    return acknowledged || Boolean(deleted) || !cache
  } catch {
    return acknowledged
  }
}

export async function registerServiceWorker(
  serviceWorker: ServiceWorkerContainer | undefined
): Promise<ServiceWorkerRegistration | null> {
  if (!serviceWorker) return null

  try {
    return await serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    })
  } catch {
    return null
  }
}

export async function ensureOfflineShellReady(
  serviceWorker: ServiceWorkerContainer | undefined,
  cacheStorage: CacheStorage | undefined
): Promise<boolean> {
  if (!offlineShellIsEnabled()) return true
  if (!serviceWorker || !cacheStorage) return false

  const registration = await registerServiceWorker(serviceWorker)
  if (!registration) return false
  await serviceWorker.ready

  if (
    !serviceWorker.controller ||
    (await getControlledShellVersion(serviceWorker)) !== OFFLINE_SHELL_VERSION
  ) {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 5_000)
      serviceWorker.addEventListener(
        "controllerchange",
        () => {
          window.clearTimeout(timeout)
          resolve()
        },
        { once: true }
      )
    })
  }

  const cacheNames = await cacheStorage.keys()
  return (
    Boolean(serviceWorker.controller) &&
    (await getControlledShellVersion(serviceWorker)) ===
      OFFLINE_SHELL_VERSION &&
    cacheNames.includes(OFFLINE_SHELL_VERSION)
  )
}

export async function resetDevelopmentServiceWorker(
  serviceWorker: ServiceWorkerContainer | undefined,
  cacheStorage: CacheStorage | undefined
) {
  try {
    const registrations = await serviceWorker?.getRegistrations()
    await Promise.all(
      registrations?.map((registration) => registration.unregister()) ?? []
    )
    const cacheNames = await cacheStorage?.keys()
    await Promise.all(
      cacheNames
        ?.filter(
          (name) =>
            name.startsWith("pph-shell-") ||
            name.startsWith("pph-dashboard-shell-")
        )
        .map((name) => cacheStorage?.delete(name)) ?? []
    )
  } catch {
    // Development cleanup must never block the application.
  }
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (offlineShellIsEnabled()) {
      void registerServiceWorker(navigator.serviceWorker)
    } else {
      void resetDevelopmentServiceWorker(navigator.serviceWorker, window.caches)
    }
  }, [])

  return null
}
