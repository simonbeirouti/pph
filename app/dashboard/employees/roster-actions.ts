"use server"

import { revalidatePath } from "next/cache"

import type { ActionState } from "@/lib/forms/action-state"
import { requireOwner } from "@/lib/auth/membership"
import { zonedLocalDateTimeToUtc } from "@/lib/roster/time"
import {
  employeeRosterShiftSchema,
  rosterShiftLocalValues,
} from "@/lib/roster/validation"
import { createClient } from "@/lib/supabase/server"

function safeValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value ?? "")])
  )
}

function mutationError(error: { code?: string | null } | null) {
  if (error?.code === "23P01") {
    return "This shift overlaps another shift for the employee."
  }
  if (error?.code === "23514") {
    return "The shift end must be after its start."
  }
  if (error?.code === "42501") {
    return "You no longer have permission to change this roster."
  }
  return "Unable to save the shift."
}

export async function saveEmployeeRosterShiftAction(
  employeeMembershipId: number,
  shiftId: number | null,
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const owner = await requireOwner()
  const values = {
    date: formData.get("date"),
    endTime: formData.get("endTime"),
    notes: formData.get("notes"),
    startTime: formData.get("startTime"),
    updatedAt: formData.get("updatedAt") || undefined,
  }
  const parsed = employeeRosterShiftSchema.safeParse(values)
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Check the highlighted shift fields.",
      ok: false,
      values: safeValues(values),
    }
  }

  const supabase = await createClient()
  const { data: employee, error: employeeError } = await supabase
    .from("memberships")
    .select("id")
    .eq("id", employeeMembershipId)
    .eq("organisation_id", owner.organisationId)
    .eq("role", "employee")
    .eq("status", "active")
    .maybeSingle()
  if (employeeError || !employee) {
    return {
      message: "Choose an active employee in your organisation.",
      ok: false,
    }
  }

  const local = rosterShiftLocalValues(parsed.data)
  let startsAt: string
  let endsAt: string
  try {
    startsAt = zonedLocalDateTimeToUtc(local.start, owner.timezone)
    endsAt = zonedLocalDateTimeToUtc(local.end, owner.timezone)
  } catch (error) {
    return {
      errors: {
        startTime: [
          error instanceof Error
            ? error.message
            : "Choose a valid local date and time.",
        ],
      },
      message: "Check the highlighted shift fields.",
      ok: false,
      values: safeValues(values),
    }
  }

  const patch = {
    employee_membership_id: employeeMembershipId,
    ends_at: endsAt,
    notes: parsed.data.notes,
    starts_at: startsAt,
  }
  let result
  if (shiftId) {
    let query = supabase
      .from("roster_shifts")
      .update(patch)
      .eq("id", shiftId)
      .eq("organisation_id", owner.organisationId)
      .eq("employee_membership_id", employeeMembershipId)
      .is("archived_at", null)
    if (parsed.data.updatedAt) {
      query = query.eq("updated_at", parsed.data.updatedAt)
    }
    result = await query.select("*").maybeSingle()
    if (!result.error && !result.data) {
      return {
        message:
          "This shift changed in another session. Refresh and try again.",
        ok: false,
      }
    }
  } else {
    result = await supabase
      .from("roster_shifts")
      .insert({
        ...patch,
        created_by: owner.membershipId,
        organisation_id: owner.organisationId,
      })
      .select("*")
      .single()
  }

  if (result.error || !result.data) {
    return {
      message: mutationError(result.error),
      ok: false,
      values: safeValues(values),
    }
  }

  revalidatePath("/dashboard/roster")
  revalidatePath("/dashboard/employees")
  revalidatePath(`/dashboard/employees/${employeeMembershipId}`)
  revalidatePath("/dashboard")

  return {
    message: shiftId ? "Shift updated." : "Shift created.",
    ok: true,
  }
}
