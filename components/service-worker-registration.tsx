"use client"

import { useEffect } from "react"

const OFFLINE_SHELL_VERSION = "pph-dashboard-shell-v7"

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
    const shouldRegister =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_PPH_PLAYWRIGHT_SERVER === "1"

    if (shouldRegister) {
      void registerServiceWorker(navigator.serviceWorker)
    } else {
      void resetDevelopmentServiceWorker(navigator.serviceWorker, window.caches)
    }
  }, [])

  return null
}
