import type { NextConfig } from "next"

const isPlaywrightServer = process.env.PPH_PLAYWRIGHT_SERVER === "1"

const nextConfig: NextConfig = {
  distDir: isPlaywrightServer ? ".next-playwright" : ".next",
  typescript: {
    tsconfigPath: isPlaywrightServer
      ? "tsconfig.playwright.json"
      : "tsconfig.json",
  },
}

export default nextConfig
