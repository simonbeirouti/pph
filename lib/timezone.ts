export const VIEWER_TIMEZONE_COOKIE = "pph_viewer_timezone"

export function detectBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
