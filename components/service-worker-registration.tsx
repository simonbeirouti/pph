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

export function ServiceWorkerRegistration() {
  useEffect(() => {
    void registerServiceWorker(navigator.serviceWorker)
  }, [])

  return null
}
