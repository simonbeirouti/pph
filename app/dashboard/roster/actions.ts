"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { ActionState } from "@/lib/forms/action-state"
import { requireOperations } from "@/lib/auth/membership"
import {
  rosterShiftLocalValues,
  calendarRosterShiftSchema,
} from "@/lib/roster/validation"
import { zonedLocalDateTimeToUtc } from "@/lib/roster/time"
import { createClient } from "@/lib/supabase/server"

const calendarShiftUpdateSchema = z
  .object({
    employeeMembershipId: z.number().int().positive(),
    endsAt: z.string().datetime({ offset: true }),
    shiftId: z.number().int().positive(),
    startsAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .refine(
    (value) =>
      new Date(value.endsAt).getTime() - new Date(value.startsAt).getTime() >=
      15 * 60 * 1000,
    "A shift must be at least 15 minutes."
  )

const calendarShiftEditSchema = calendarRosterShiftSchema.omit({
  jobIds: true,
})

function safeValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => !Array.isArray(value))
      .map(([key, value]) => [key, String(value ?? "")])
  )
}

function creationError(error: { code?: string | null } | null) {
  if (error?.code === "23P01") {
    return "This shift overlaps another shift for the employee."
  }
  if (error?.code === "P0002") {
    return "One or more selected jobs changed. Review the jobs and try again."
  }
  if (error?.code === "22023" || error?.code === "23514") {
    return "Check the employee, shift times, and selected jobs."
  }
  if (error?.code === "42501") {
    return "You no longer have permission to change this roster."
  }
  return "Unable to create the shift."
}

export async function createCalendarRosterShiftAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOperations()
  const values = {
    date: formData.get("date"),
    employeeMembershipId: formData.get("employeeMembershipId"),
    endTime: formData.get("endTime"),
    jobIds: formData.getAll("jobIds"),
    notes: formData.get("notes"),
    startTime: formData.get("startTime"),
    timezone: formData.get("timezone"),
  }
  const parsed = calendarRosterShiftSchema.safeParse(values)
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Check the highlighted shift fields.",
      ok: false,
      values: safeValues(values),
    }
  }

  const local = rosterShiftLocalValues(parsed.data)
  let startsAt: string
  let endsAt: string
  try {
    startsAt = zonedLocalDateTimeToUtc(local.start, parsed.data.timezone)
    endsAt = zonedLocalDateTimeToUtc(local.end, parsed.data.timezone)
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

  const supabase = await createClient()
  const { error } = await supabase.rpc("create_roster_shift_with_jobs", {
    p_employee_membership_id: parsed.data.employeeMembershipId,
    p_ends_at: endsAt,
    p_job_ids: parsed.data.jobIds,
    p_notes: parsed.data.notes,
    p_starts_at: startsAt,
  })

  if (error) {
    return {
      message: creationError(error),
      ok: false,
      values: safeValues(values),
    }
  }

  revalidatePath("/dashboard/roster")
  revalidatePath("/dashboard/jobs")
  revalidatePath("/dashboard/employees")
  revalidatePath(`/dashboard/employees/${parsed.data.employeeMembershipId}`)
  revalidatePath("/dashboard")

  return {
    message: parsed.data.jobIds.length
      ? `Shift created and ${parsed.data.jobIds.length} job${
          parsed.data.jobIds.length === 1 ? "" : "s"
        } assigned.`
      : "Shift created.",
    ok: true,
  }
}

export async function updateCalendarRosterShiftAction(input: {
  employeeMembershipId: number
  endsAt: string
  shiftId: number
  startsAt: string
  updatedAt: string
}): Promise<{ message: string; ok: boolean; updatedAt?: string }> {
  const owner = await requireOperations()
  const parsed = calendarShiftUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      message: "Choose a valid shift time of at least 15 minutes.",
      ok: false,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("roster_shifts")
    .update({
      ends_at: parsed.data.endsAt,
      starts_at: parsed.data.startsAt,
    })
    .eq("id", parsed.data.shiftId)
    .eq("organisation_id", owner.organisationId)
    .eq("employee_membership_id", parsed.data.employeeMembershipId)
    .eq("updated_at", parsed.data.updatedAt)
    .is("archived_at", null)
    .is("locked_at", null)
    .select("updated_at")
    .maybeSingle()

  if (error) {
    return { message: creationError(error), ok: false }
  }
  if (!data) {
    return {
      message: "This shift changed in another session. Refresh and try again.",
      ok: false,
    }
  }

  revalidatePath("/dashboard/roster")
  revalidatePath("/dashboard/employees")
  revalidatePath(`/dashboard/employees/${parsed.data.employeeMembershipId}`)
  revalidatePath("/dashboard")
  return {
    message: "Shift updated.",
    ok: true,
    updatedAt: data.updated_at,
  }
}

export async function editCalendarRosterShiftAction(
  shiftId: number,
  originalEmployeeMembershipId: number,
  expectedUpdatedAt: string,
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const owner = await requireOperations()
  const values = {
    date: formData.get("date"),
    employeeMembershipId: formData.get("employeeMembershipId"),
    endTime: formData.get("endTime"),
    notes: formData.get("notes"),
    startTime: formData.get("startTime"),
    timezone: formData.get("timezone"),
  }
  const parsed = calendarShiftEditSchema.safeParse(values)
  if (
    !parsed.success ||
    !Number.isSafeInteger(shiftId) ||
    shiftId <= 0 ||
    !Number.isSafeInteger(originalEmployeeMembershipId) ||
    originalEmployeeMembershipId <= 0 ||
    !Number.isFinite(Date.parse(expectedUpdatedAt))
  ) {
    return {
      errors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
      message: "Check the highlighted shift fields.",
      ok: false,
      values: safeValues(values),
    }
  }

  const local = rosterShiftLocalValues(parsed.data)
  let startsAt: string
  let endsAt: string
  try {
    startsAt = zonedLocalDateTimeToUtc(local.start, parsed.data.timezone)
    endsAt = zonedLocalDateTimeToUtc(local.end, parsed.data.timezone)
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

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("roster_shifts")
    .update({
      employee_membership_id: parsed.data.employeeMembershipId,
      ends_at: endsAt,
      notes: parsed.data.notes,
      starts_at: startsAt,
    })
    .eq("id", shiftId)
    .eq("organisation_id", owner.organisationId)
    .eq("employee_membership_id", originalEmployeeMembershipId)
    .eq("updated_at", expectedUpdatedAt)
    .is("archived_at", null)
    .is("locked_at", null)
    .select("updated_at")
    .maybeSingle()

  if (error) {
    return {
      message: creationError(error),
      ok: false,
      values: safeValues(values),
    }
  }
  if (!data) {
    return {
      message: "This shift changed or is locked. Refresh and try again.",
      ok: false,
      values: safeValues(values),
    }
  }

  revalidatePath("/dashboard/roster")
  revalidatePath("/dashboard/employees")
  revalidatePath(`/dashboard/employees/${originalEmployeeMembershipId}`)
  revalidatePath(`/dashboard/employees/${parsed.data.employeeMembershipId}`)
  revalidatePath("/dashboard")
  return {
    message: "Shift updated.",
    ok: true,
    values: {
      employeeMembershipId: String(parsed.data.employeeMembershipId),
      endsAt,
      notes: parsed.data.notes,
      startsAt,
      updatedAt: data.updated_at,
    },
  }
}

export async function setCalendarRosterShiftLockAction(input: {
  employeeMembershipId: number
  locked: boolean
  shiftId: number
  updatedAt: string
}): Promise<{ message: string; ok: boolean }> {
  const owner = await requireOperations()
  const parsed = z
    .object({
      employeeMembershipId: z.number().int().positive(),
      locked: z.boolean(),
      shiftId: z.number().int().positive(),
      updatedAt: z.string().datetime({ offset: true }),
    })
    .safeParse(input)
  if (!parsed.success) {
    return { message: "Choose a valid shift.", ok: false }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("roster_shifts")
    .update({
      locked_at: parsed.data.locked ? new Date().toISOString() : null,
      locked_by: parsed.data.locked ? owner.membershipId : null,
    })
    .eq("id", parsed.data.shiftId)
    .eq("organisation_id", owner.organisationId)
    .eq("employee_membership_id", parsed.data.employeeMembershipId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle()

  if (error || !data) {
    return {
      message: "This shift changed in another session. Refresh and try again.",
      ok: false,
    }
  }

  revalidatePath("/dashboard/roster")
  revalidatePath("/dashboard/employees")
  revalidatePath(`/dashboard/employees/${parsed.data.employeeMembershipId}`)
  return {
    message: parsed.data.locked ? "Shift locked." : "Shift unlocked.",
    ok: true,
  }
}
