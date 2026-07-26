"use server"

import { revalidatePath } from "next/cache"

import { uploadAvatar } from "@/app/dashboard/employees/actions"
import { requireActiveMembership } from "@/lib/auth/membership"
import { getCurrentProfile } from "@/lib/employees/data"
import {
  employeeProfileSchema,
  validateAvatar,
} from "@/lib/employees/validation"
import type { ActionState } from "@/lib/forms/action-state"
import { createClient } from "@/lib/supabase/server"

export async function updateOwnProfileAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requireActiveMembership()
  const employee = await getCurrentProfile()
  const values = {
    firstName: formData.get("firstName"),
    jobTitle: formData.get("jobTitle"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
  }
  const parsed = employeeProfileSchema.safeParse(values)
  const avatarResult = await validateAvatar(
    formData.get("avatar") as File | null
  )

  if (!parsed.success || avatarResult.error) {
    return {
      errors: {
        ...parsed.error?.flatten().fieldErrors,
        ...(avatarResult.error ? { avatar: [avatarResult.error] } : {}),
      },
      message: "Check the highlighted fields.",
      ok: false,
      values: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, String(value ?? "")])
      ),
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("employee_profiles")
    .update({
      first_name: parsed.data.firstName,
      job_title: parsed.data.jobTitle,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone,
    })
    .eq("id", employee.profileId)
    .eq("membership_id", actor.membershipId)
    .eq("organisation_id", actor.organisationId)
  if (error) return { message: "Unable to update your profile.", ok: false }

  const warnings: string[] = []
  if (avatarResult.avatar) {
    const uploaded = await uploadAvatar({
      actor,
      avatar: avatarResult.avatar,
      membershipId: actor.membershipId,
      oldPath: employee.avatarPath,
      profileId: employee.profileId,
    })
    if (!uploaded) warnings.push("Profile saved, but the avatar was not updated.")
  }

  revalidatePath("/dashboard/profile")
  revalidatePath("/dashboard")
  return { message: "Profile updated.", ok: true, warnings }
}
