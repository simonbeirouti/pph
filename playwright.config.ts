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
    throw new Error("Local Supabase is running but did not return test credentials")
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
const baseURL = "http://127.0.0.1:3100"

process.env.PLAYWRIGHT_BASE_URL = baseURL

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3100",
    env: {
      ...localSupabaseEnvironment,
      PPH_PLAYWRIGHT_SERVER: "1",
    },
    reuseExistingServer: !process.env.CI,
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
  ],
})
