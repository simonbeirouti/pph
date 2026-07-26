"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
} from "@/lib/sidebar"
import { createClient } from "@/lib/supabase/server"

export async function setSidebarOpenAction(open: boolean): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.set(SIDEBAR_COOKIE_NAME, String(open), {
    httpOnly: true,
    maxAge: SIDEBAR_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  })
}

export async function logoutAction(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
