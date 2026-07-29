import type { NextConfig } from "next"
import { networkInterfaces } from "node:os"

const isPlaywrightServer = process.env.PPH_PLAYWRIGHT_SERVER === "1"
const allowedDevOrigins = Object.values(networkInterfaces())
  .flatMap((interfaces) => interfaces ?? [])
  .filter((network) => !network.internal)
  .map((network) => network.address)

const nextConfig: NextConfig = {
  allowedDevOrigins,
  distDir: isPlaywrightServer ? ".next-playwright" : ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  typescript: {
    tsconfigPath: isPlaywrightServer
      ? "tsconfig.playwright.json"
      : "tsconfig.json",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(), microphone=()",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ]
  },
}

export default nextConfig
