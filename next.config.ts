import type { NextConfig } from "next"

const isPlaywrightServer = process.env.PPH_PLAYWRIGHT_SERVER === "1"

const nextConfig: NextConfig = {
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
        ],
      },
    ]
  },
}

export default nextConfig
