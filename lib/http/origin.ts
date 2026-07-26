import "server-only"

import { headers } from "next/headers"

export async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers()
  const origin = requestHeaders.get("origin")
  if (origin) return origin

  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http"
  if (!host) throw new Error("Request origin is unavailable")
  return `${protocol}://${host}`
}
