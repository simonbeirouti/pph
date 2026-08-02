"use server"

import { redirect } from "next/navigation"

import type { ActionState } from "@/lib/forms/action-state"
import { loginSchema } from "@/lib/auth/validation"
import { recoveryEmailSchema } from "@/lib/auth/validation"
import { getRequestOrigin } from "@/lib/http/origin"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function loginAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Check the highlighted fields.",
      ok: false,
      values: {
        email: String(formData.get("email") ?? ""),
      },
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error || !data.user) {
    return {
      message: "Unable to sign in with those credentials.",
      ok: false,
      values: { email: parsed.data.email },
    }
  }

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from("memberships")
    .select("status")
    .eq("user_id", data.user.id)
    .maybeSingle()

  if (membership?.status !== "active") {
    await supabase.auth.signOut()
    return {
      message:
        membership?.status === "inactive"
          ? "Your access is unavailable. Contact your organisation owner."
          : "Your account setup is not complete. Use your invitation link.",
      ok: false,
      values: { email: parsed.data.email },
    }
  }

  redirect("/dashboard")
}

export async function requestPasswordRecoveryAction(
  formData: FormData
): Promise<ActionState> {
  const parsed = recoveryEmailSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Enter a valid email address.",
      ok: false,
    }
  }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await getRequestOrigin()}/auth/confirm`,
  })

  return {
    message:
      "If an account uses that email, a password reset link is on its way.",
    ok: true,
  }
}
