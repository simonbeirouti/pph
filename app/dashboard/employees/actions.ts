"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import type { ActionState } from "@/lib/forms/action-state"
import {
  requireOwner,
  type MembershipContext,
} from "@/lib/auth/membership"
import { getEmployee } from "@/lib/employees/data"
import {
  employeeProfileSchema,
  employeeSchema,
  validateAvatar,
  type ValidAvatar,
} from "@/lib/employees/validation"
import { getRequestOrigin } from "@/lib/http/origin"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

async function setInvitationDelivery(
  organisationId: number,
  membershipId: number,
  status: "pending" | "sent" | "failed",
  admin = createAdminClient()
) {
  const { error } = await admin
    .from("memberships")
    .update({
      invite_delivery_status: status,
      invite_last_attempted_at: new Date().toISOString(),
    })
    .eq("id", membershipId)
    .eq("organisation_id", organisationId)
    .eq("role", "employee")
  if (error) throw new Error("Unable to update invitation state")
}

async function sendInvitation(input: {
  email: string
  membershipId: number
}): Promise<"sent" | "failed"> {
  const owner = await requireOwner()
  const admin = createAdminClient()
  await setInvitationDelivery(
    owner.organisationId,
    input.membershipId,
    "pending",
    admin
  )
  const redirectTo = `${await getRequestOrigin()}/auth/confirm`

  try {
    const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
      redirectTo,
    })
    if (error) throw error
    await setInvitationDelivery(
      owner.organisationId,
      input.membershipId,
      "sent",
      admin
    )
    return "sent"
  } catch {
    await setInvitationDelivery(
      owner.organisationId,
      input.membershipId,
      "failed",
      admin
    )
    return "failed"
  }
}

export async function uploadAvatar(input: {
  actor: MembershipContext
  avatar: ValidAvatar
  membershipId: number
  oldPath?: string | null
  profileId: number
}): Promise<string | null> {
  const supabase = await createClient()
  const path = `${input.actor.organisationId}/${input.membershipId}/${randomUUID()}.${input.avatar.extension}`
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, input.avatar.bytes, {
      contentType: input.avatar.mimeType,
      upsert: false,
    })
  if (uploadError) return null

  const { error: profileError } = await supabase
    .from("employee_profiles")
    .update({ avatar_path: path })
    .eq("id", input.profileId)
    .eq("organisation_id", input.actor.organisationId)
  if (profileError) {
    await supabase.storage.from("avatars").remove([path])
    return null
  }

  if (input.oldPath) {
    await supabase.storage.from("avatars").remove([input.oldPath])
  }
  return path
}

export async function createEmployeeAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner()
  const values = {
    email: formData.get("email"),
    firstName: formData.get("firstName"),
    jobTitle: formData.get("jobTitle"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
  }
  const parsed = employeeSchema.safeParse(values)
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
  const { data, error } = await supabase.rpc("create_employee", {
    p_email: parsed.data.email,
    p_first_name: parsed.data.firstName,
    p_job_title: parsed.data.jobTitle,
    p_last_name: parsed.data.lastName,
    p_phone: parsed.data.phone,
  })
  const result = data?.[0]
  if (error || !result) {
    return { message: "Unable to create the employee.", ok: false }
  }
  if (!result.created) {
    return {
      destinationId: result.membership_id,
      message: "An employee already uses this email address.",
      ok: false,
    }
  }

  const warnings: string[] = []
  if (result.created && avatarResult.avatar) {
    const owner = await requireOwner()
    const uploaded = await uploadAvatar({
      actor: owner,
      avatar: avatarResult.avatar,
      membershipId: result.membership_id,
      profileId: result.profile_id,
    })
    if (!uploaded) warnings.push("The employee was created without the avatar.")
  }

  const invitation = await sendInvitation({
    email: parsed.data.email,
    membershipId: result.membership_id,
  })
  revalidatePath("/dashboard/employees")

  return {
    destinationId: result.membership_id,
    invitation,
    message:
      invitation === "sent"
        ? result.created
          ? "Employee created and invitation sent."
          : "Employee already existed; a new invitation was sent."
        : "Employee saved, but the invitation could not be sent.",
    ok: invitation === "sent",
    warnings,
  }
}

export async function updateEmployeeAction(
  membershipId: number,
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const employee = await getEmployee(membershipId)
  if (!employee) return { message: "Employee not found.", ok: false }

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

  const owner = await requireOwner()
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
    .eq("organisation_id", owner.organisationId)
  if (error) return { message: "Unable to update the employee.", ok: false }

  const warnings: string[] = []
  if (avatarResult.avatar) {
    const uploaded = await uploadAvatar({
      actor: owner,
      avatar: avatarResult.avatar,
      membershipId,
      oldPath: employee.avatarPath,
      profileId: employee.profileId,
    })
    if (!uploaded)
      warnings.push("Profile saved, but the avatar was not updated.")
  }

  revalidatePath(`/dashboard/employees/${membershipId}`)
  revalidatePath("/dashboard/employees")
  return { message: "Employee profile updated.", ok: true, warnings }
}

export async function setEmployeeActiveAction(
  membershipId: number,
  active: boolean
): Promise<ActionState> {
  const employee = await getEmployee(membershipId)
  if (!employee) return { message: "Employee not found.", ok: false }
  if (active ? employee.status !== "inactive" : employee.status !== "active") {
    return { message: "The employee state has already changed.", ok: false }
  }

  const owner = await requireOwner()
  const supabase = await createClient()
  const { error } = await supabase
    .from("memberships")
    .update(
      active
        ? { deactivated_at: null, status: "active" }
        : { deactivated_at: new Date().toISOString(), status: "inactive" }
    )
    .eq("id", membershipId)
    .eq("organisation_id", owner.organisationId)
    .eq("role", "employee")
  if (error) {
    return { message: "Unable to change employee access.", ok: false }
  }

  return {
    membershipStatus: active ? "active" : "inactive",
    message: active
      ? "Employee access reactivated."
      : "Employee access deactivated.",
    ok: true,
  }
}

export async function employeeAccessAction(
  membershipId: number,
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await setEmployeeActiveAction(
    membershipId,
    formData.get("active") === "true"
  )
  revalidatePath(`/dashboard/employees/${membershipId}`)
  revalidatePath("/dashboard/employees")
  return result
}

export async function deleteInvitedEmployeeAction(
  membershipId: number
): Promise<ActionState> {
  const employee = await getEmployee(membershipId)
  if (!employee) return { message: "Employee not found.", ok: false }
  if (employee.status !== "invited" || employee.userId) {
    return {
      message: "Only an employee who has not activated can be deleted.",
      ok: false,
    }
  }

  const supabase = await createClient()
  const { data: deleted, error } = await supabase.rpc(
    "delete_invited_employee",
    { p_membership_id: membershipId }
  )
  if (error || !deleted) {
    return { message: "Unable to delete the employee.", ok: false }
  }

  if (employee.avatarPath) {
    await createAdminClient().storage
      .from("avatars")
      .remove([employee.avatarPath])
  }

  revalidatePath("/dashboard/employees")
  return { message: "Employee deleted.", ok: true }
}

export async function resendEmployeeInvitationAction(
  membershipId: number,
  _state: ActionState,
  _formData: FormData
): Promise<ActionState> {
  void _formData
  const employee = await getEmployee(membershipId)
  if (!employee) return { message: "Employee not found.", ok: false }
  if (employee.status !== "invited") {
    return {
      message: "This employee has already activated their account.",
      ok: false,
    }
  }

  const invitation = await sendInvitation({
    email: employee.email,
    membershipId,
  })
  revalidatePath(`/dashboard/employees/${membershipId}`)
  revalidatePath("/dashboard/employees")

  return {
    invitation,
    message:
      invitation === "sent"
        ? "Invitation sent."
        : "The invitation could not be sent. Try again.",
    ok: invitation === "sent",
  }
}
