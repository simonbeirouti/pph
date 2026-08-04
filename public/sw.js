const SHELL_CACHE = "pph-dashboard-shell-v11"
const DASHBOARD_SHELL_URL = "/offline"
const REPOSITORY_READY_URL = "/offline-repository-ready"
const PUBLIC_ASSETS = [
  DASHBOARD_SHELL_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
]

async function refreshDashboardShell(cache) {
  const shellResponse = await fetch(DASHBOARD_SHELL_URL, { cache: "no-store" })
  if (!shellResponse.ok) {
    throw new Error("Unable to refresh the offline dashboard shell")
  }

  const html = await shellResponse.clone().text()
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith("/_next/static/"))

  await Promise.all(
    [...new Set(assetPaths)].map(async (path) => {
      const response = await fetch(path)
      if (!response.ok) {
        throw new Error(`Unable to refresh dashboard asset: ${path}`)
      }
      await cache.put(path, response)
    })
  )
  await cache.put(DASHBOARD_SHELL_URL, shellResponse)
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "PPH_OFFLINE_SHELL_VERSION") {
    event.ports[0]?.postMessage({ version: SHELL_CACHE })
    return
  }
  if (event.data?.type === "PPH_OFFLINE_REPOSITORY_READY") {
    event.waitUntil(
      caches
        .open(SHELL_CACHE)
        .then((cache) =>
          cache.put(
            REPOSITORY_READY_URL,
            new Response("ready", {
              headers: { "Content-Type": "text/plain" },
            })
          )
        )
        .then(() => event.ports[0]?.postMessage({ ok: true }))
    )
    return
  }
  if (event.data?.type === "PPH_OFFLINE_REPOSITORY_CLEAR") {
    event.waitUntil(
      caches
        .open(SHELL_CACHE)
        .then((cache) => cache.delete(REPOSITORY_READY_URL))
        .then(() => event.ports[0]?.postMessage({ ok: true }))
    )
  }
})

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(async (cache) => {
        await cache.addAll(PUBLIC_ASSETS.slice(1))
        await refreshDashboardShell(cache)
      })
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                (name.startsWith("pph-shell-") ||
                  name.startsWith("pph-dashboard-shell-")) &&
                name !== SHELL_CACHE
            )
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    const isDashboardNavigation =
      url.pathname === DASHBOARD_SHELL_URL ||
      url.pathname === "/dashboard" ||
      url.pathname.startsWith("/dashboard/")
    if (!isDashboardNavigation) return
    if (url.pathname !== DASHBOARD_SHELL_URL) {
      event.waitUntil(
        caches
          .open(SHELL_CACHE)
          .then((cache) => refreshDashboardShell(cache))
          .catch(() => {})
      )
    }
    event.respondWith(
      url.pathname === DASHBOARD_SHELL_URL
        ? fetch(request, { cache: "no-store" }).catch(async () => {
            const cache = await caches.open(SHELL_CACHE)
            return cache.match(DASHBOARD_SHELL_URL, { ignoreSearch: true })
          })
        : caches.open(SHELL_CACHE).then(async (cache) => {
            const prepared = await cache.match(REPOSITORY_READY_URL, {
              ignoreSearch: true,
            })
            const shell = await cache.match(DASHBOARD_SHELL_URL, {
              ignoreSearch: true,
            })
            if (prepared && shell) return shell
            return fetch(request, { cache: "no-store" }).catch(
              () => shell || Response.error()
            )
          })
    )
    return
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const cache = await caches.open(SHELL_CACHE)
          if (response.ok) {
            await cache.put(request, response.clone())
            return response
          }
          return (
            (await cache.match(request, { ignoreSearch: true })) || response
          )
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true })
          return cached || Response.error()
        })
    )
    return
  }

  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              void caches
                .open(SHELL_CACHE)
                .then((cache) => cache.put(request, copy))
            }
            return response
          })
      )
    )
  }
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }
  const allowedLabels = new Set([
    "Job assigned",
    "Job assignment changed",
    "Job submitted for review",
    "Job approved or archived",
    "Job reopened with feedback",
    "Roster assigned",
    "Roster changed",
    "Roster archived",
  ])
  const label = allowedLabels.has(payload.label)
    ? payload.label
    : "Work updated"
  const candidateUrl =
    typeof payload.url === "string"
      ? new URL(payload.url, self.location.origin)
      : null
  const url =
    candidateUrl &&
    candidateUrl.origin === self.location.origin &&
    /^\/dashboard\/(jobs|roster)(?:\/|\?|$)/.test(
      `${candidateUrl.pathname}${candidateUrl.search}`
    )
      ? `${candidateUrl.pathname}${candidateUrl.search}`
      : "/dashboard"

  event.waitUntil(
    self.registration.showNotification(label, {
      body: "Open Pure Peninsula Honey to view the update.",
      data: { url },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: `${label}:${url}`,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(
    event.notification.data?.url || "/dashboard",
    self.location.origin
  ).href
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if (new URL(client.url).origin === self.location.origin) {
            await client.focus()
            if ("navigate" in client) await client.navigate(target)
            return
          }
        }
        await self.clients.openWindow(target)
      })
  )
})
