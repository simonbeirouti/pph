"use server"

import { redirect } from "next/navigation"

import { getInvitedMembershipForCurrentUser } from "@/lib/auth/invitation"
import { setPasswordSchema } from "@/lib/auth/validation"
import type { ActionState } from "@/lib/forms/action-state"
import { createClient } from "@/lib/supabase/server"

export async function setPasswordAction(
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
  const invitation = await getInvitedMembershipForCurrentUser()
  if (!invitation) {
    return {
      message:
        "Your invitation session has expired. Contact your organisation owner.",
      ok: false,
    }
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })
  if (passwordError) {
    return { message: "Unable to save your password. Try again.", ok: false }
  }

  const { error: activationError } = await supabase.rpc(
    "activate_invited_membership"
  )
  if (activationError) {
    return {
      message:
        "Your password was saved, but activation needs to be retried from this page.",
      ok: false,
    }
  }

  redirect("/dashboard")
}
