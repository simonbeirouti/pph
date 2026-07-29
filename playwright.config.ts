import { execFileSync } from "node:child_process"

import { defineConfig, devices } from "@playwright/test"

function readLocalSupabaseEnvironment() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY
  ) {
    return {
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    }
  }

  const commandEnvironment = { ...process.env }
  delete commandEnvironment.FORCE_COLOR
  delete commandEnvironment.NO_COLOR
  const output = execFileSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "env"],
    { encoding: "utf8", env: commandEnvironment }
  )
  const values = new Map<string, string>()

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="(.*)"$/)
    if (match) values.set(match[1], match[2])
  }

  const url = values.get("API_URL")
  const publishableKey = values.get("PUBLISHABLE_KEY")
  const secretKey = values.get("SECRET_KEY")

  if (!url || !publishableKey || !secretKey) {
    throw new Error(
      "Local Supabase is running but did not return test credentials"
    )
  }

  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishableKey
  process.env.SUPABASE_SECRET_KEY = secretKey

  return {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_SUPABASE_URL: url,
    SUPABASE_SECRET_KEY: secretKey,
  }
}

const localSupabaseEnvironment = readLocalSupabaseEnvironment()
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4000"
const productionServer = process.env.PPH_PLAYWRIGHT_PRODUCTION === "1"
const playwrightPort = new URL(baseURL).port || "80"

if (!/^\d+$/.test(playwrightPort)) {
  throw new Error("PLAYWRIGHT_BASE_URL must contain a numeric port")
}

process.env.PLAYWRIGHT_BASE_URL = baseURL

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The local suite intentionally shares one seeded organisation and its
  // owner/employee accounts. Keep those database-backed journeys serial until
  // worker-scoped organisations are introduced in the S11 fixture consolidation.
  workers: 1,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    command: productionServer
      ? `pnpm build && pnpm start --hostname 127.0.0.1 --port ${playwrightPort}`
      : `pnpm dev --hostname 127.0.0.1 --port ${playwrightPort}`,
    env: {
      ...localSupabaseEnvironment,
      NEXT_PUBLIC_PPH_PLAYWRIGHT_SERVER: "1",
      PPH_PLAYWRIGHT_SERVER: "1",
    },
    reuseExistingServer: !process.env.CI && !productionServer,
    timeout: 120_000,
    url: `${baseURL}/login`,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 15"], browserName: "webkit" },
    },
  ],
})
