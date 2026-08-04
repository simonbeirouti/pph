export const SIDEBAR_COOKIE_NAME = "sidebar_state"
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export function readSidebarOpenValue(value: string | null): boolean | null {
  if (value === "true") return true
  if (value === "false") return false
  return null
}

export function readSidebarOpenCookie(cookieHeader: string): boolean | null {
  const value = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
    ?.slice(SIDEBAR_COOKIE_NAME.length + 1)

  return readSidebarOpenValue(value ?? null)
}
