import { test, expect } from "./fixtures"

const iconContract = [
  { height: 192, path: "/icons/icon-192.png", width: 192 },
  { height: 512, path: "/icons/icon-512.png", width: 512 },
  { height: 512, path: "/icons/icon-maskable-512.png", width: 512 },
  { height: 180, path: "/icons/apple-touch-icon.png", width: 180 },
]

function pngDimensions(body: Buffer) {
  expect(body.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  )

  return {
    height: body.readUInt32BE(20),
    width: body.readUInt32BE(16),
  }
}

test("publishes signed-out install metadata and valid PNG icons", async ({
  request,
}) => {
  const manifestResponse = await request.get("/manifest.webmanifest")
  expect(manifestResponse.ok()).toBeTruthy()
  expect(manifestResponse.headers()["content-type"]).toContain(
    "application/manifest+json"
  )
  await expect(manifestResponse.json()).resolves.toMatchObject({
    background_color: "#ffffff",
    categories: ["business", "productivity"],
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: "/icons/icon-192.png",
        type: "image/png",
      },
      {
        sizes: "512x512",
        src: "/icons/icon-512.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icons/icon-maskable-512.png",
        type: "image/png",
      },
    ],
    name: "Pure Peninsula Honey",
    orientation: "portrait-primary",
    short_name: "Pure Peninsula Honey",
    start_url: "/dashboard",
    theme_color: "#facc15",
  })

  for (const icon of iconContract) {
    const response = await request.get(icon.path)
    expect(response.ok(), icon.path).toBeTruthy()
    expect(response.headers()["content-type"]).toContain("image/png")
    expect(pngDimensions(await response.body())).toEqual({
      height: icon.height,
      width: icon.width,
    })
  }
})

test("serves an offline-shell service worker with strict headers", async ({
  request,
}) => {
  const response = await request.get("/sw.js")
  expect(response.ok()).toBeTruthy()
  const headers = response.headers()
  expect(headers["content-type"]).toBe("application/javascript; charset=utf-8")
  expect(headers["cache-control"]).toBe("no-cache, no-store, must-revalidate")
  expect(headers["content-security-policy"]).toBe(
    "default-src 'self'; script-src 'self'"
  )
  expect(headers["x-content-type-options"]).toBe("nosniff")
  expect(headers["x-frame-options"]).toBe("DENY")
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")

  const worker = await response.text()
  expect(worker).toContain('addEventListener("install"')
  expect(worker).toContain("skipWaiting()")
  expect(worker).toContain('addEventListener("activate"')
  expect(worker).toContain("clients.claim()")
  expect(worker).toContain('addEventListener("fetch"')
  expect(worker).toContain('addEventListener("push"')
  expect(worker).toContain('addEventListener("notificationclick"')
  expect(worker).toContain('const OFFLINE_URL = "/offline"')
  expect(worker).toContain('url.pathname.startsWith("/_next/static/")')
  expect(worker).not.toMatch(/addEventListener\(["']sync/)
  expect(worker).not.toContain("job.title")
  expect(worker).not.toContain("signedUrl")
  expect(worker).not.toContain("supabase")
})

test("registers the root service worker with only the public shell cache", async ({
  employeePage,
}) => {
  await employeePage.goto("/login")
  await employeePage.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations.map((registration) => registration.unregister())
    )
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
  })

  await employeePage.goto("/dashboard")
  const result = await employeePage.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return {
      caches: await caches.keys(),
      scriptUrl: registration.active?.scriptURL,
      scope: registration.scope,
    }
  })

  expect(result.scope).toBe(`${new URL(employeePage.url()).origin}/`)
  expect(result.scriptUrl).toBe(`${new URL(employeePage.url()).origin}/sw.js`)
  expect(result.caches).toEqual(["pph-shell-v5"])
})

test("revalidates Next.js assets instead of serving stale PWA code", async ({
  employeePage,
}) => {
  await employeePage.goto("/dashboard")
  const assetUrl = await employeePage
    .locator('script[src^="/_next/static/"]')
    .first()
    .getAttribute("src")
  expect(assetUrl).toBeTruthy()

  const result = await employeePage.evaluate(async (url) => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true }
        )
      )
    }

    const cache = await caches.open("pph-shell-v5")
    await cache.put(
      url,
      new Response("stale-static-asset", {
        headers: { "content-type": "application/javascript" },
      })
    )

    const response = await fetch(url)
    const body = await response.text()
    const refreshed = await cache.match(url)
    const refreshedBody = await refreshed?.text()

    return { body, refreshedBody }
  }, assetUrl!)

  expect(result.body).not.toBe("stale-static-asset")
  expect(result.refreshedBody).toBe(result.body)
})

test("keeps Auth and the application usable without service-worker support", async ({
  employeePage,
}) => {
  await employeePage.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "serviceWorker", {
      configurable: true,
      get: () => undefined,
    })
  })

  await employeePage.goto("/dashboard")

  await expect(
    employeePage.getByRole("heading", { name: /^Hi, Alex/ })
  ).toBeVisible()
  await expect(
    employeePage.getByRole("region", { name: "Install Pure Peninsula Honey" })
  ).toBeVisible()
})

test("contains registration failures without blocking employee work", async ({
  employeePage,
}) => {
  await employeePage.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "serviceWorker", {
      configurable: true,
      get: () => ({
        register: () => Promise.reject(new Error("registration unavailable")),
      }),
    })
  })

  await employeePage.goto("/dashboard")

  await expect(
    employeePage.getByRole("heading", { name: /^Hi, Alex/ })
  ).toBeVisible()
})

test("shows employee guidance and remembers dismissal", async ({
  employeePage,
}) => {
  await employeePage.goto("/dashboard")
  const guidance = employeePage.getByRole("region", {
    name: "Install Pure Peninsula Honey",
  })
  await expect(guidance).toBeVisible()
  await guidance
    .getByRole("button", { name: "Dismiss install guidance" })
    .click()
  await expect(guidance).toBeHidden()

  await employeePage.reload()
  await expect(
    employeePage.getByRole("region", { name: "Install Pure Peninsula Honey" })
  ).toHaveCount(0)
})

test("does not show employee install guidance to owners", async ({
  ownerPage,
}) => {
  await ownerPage.goto("/dashboard")
  await expect(
    ownerPage.getByRole("region", { name: "Install Pure Peninsula Honey" })
  ).toHaveCount(0)
})

test("shows iOS installation instructions", async ({ employeePage }) => {
  await employeePage.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "userAgent", {
      configurable: true,
      get: () =>
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
    })
  })

  await employeePage.goto("/dashboard")

  await expect(employeePage.getByText(/tap share/i)).toContainText(
    "Add to Home Screen"
  )
})

test("hides guidance in standalone mode and preserves signed-out routing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query: string) => {
      if (query !== "(display-mode: standalone)") {
        return originalMatchMedia(query)
      }

      return {
        addEventListener() {},
        addListener() {},
        dispatchEvent: () => true,
        matches: true,
        media: query,
        onchange: null,
        removeEventListener() {},
        removeListener() {},
      }
    }
  })

  await page.goto("/dashboard")

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Install Pure Peninsula Honey" })
  ).toHaveCount(0)
})
