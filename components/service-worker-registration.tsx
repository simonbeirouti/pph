"use client"

import { useEffect } from "react"

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
        ?.filter((name) => name.startsWith("pph-shell-"))
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
