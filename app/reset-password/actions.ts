"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"

import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_COOKIE_VALUE,
} from "@/lib/auth/recovery"
import { setPasswordSchema } from "@/lib/auth/validation"
import type { ActionState } from "@/lib/forms/action-state"
import { createClient } from "@/lib/supabase/server"

export async function resetPasswordAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = setPasswordSchema.safeParse({
    confirmPassword: formData.get("confirmPassword"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Choose a password that meets every requirement.",
      ok: false,
    }
  }

  const supabase = await createClient()
  const cookieStore = await cookies()
  if (
    cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value !==
    PASSWORD_RECOVERY_COOKIE_VALUE
  ) {
    return { message: "Your password reset link has expired.", ok: false }
  }
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    return { message: "Your password reset link has expired.", ok: false }
  }
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })
  if (error)
    return { message: "Unable to reset your password. Try again.", ok: false }
  const { error: signOutError } = await supabase.auth.signOut({
    scope: "global",
  })
  if (signOutError) {
    return {
      message:
        "Your password was reset, but other sessions could not be signed out. Try again.",
      ok: false,
    }
  }
  cookieStore.delete(PASSWORD_RECOVERY_COOKIE)
  redirect("/login?reason=password-reset")
}
