"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { detectBrowserTimezone, VIEWER_TIMEZONE_COOKIE } from "@/lib/timezone"

export function ViewerTimezoneSync({ timezone }: { timezone: string }) {
  const router = useRouter()

  useEffect(() => {
    const browserTimezone = detectBrowserTimezone()
    if (!browserTimezone || browserTimezone === timezone) return

    document.cookie = `${VIEWER_TIMEZONE_COOKIE}=${encodeURIComponent(
      browserTimezone
    )}; Path=/; Max-Age=31536000; SameSite=Lax`
    router.refresh()
  }, [router, timezone])

  return null
}
