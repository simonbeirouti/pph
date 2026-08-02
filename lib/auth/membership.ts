import { cache } from "react"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { assertIanaTimezone } from "@/lib/roster/time"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { VIEWER_TIMEZONE_COOKIE } from "@/lib/timezone"

type MembershipRole = Database["public"]["Enums"]["membership_role"]
type MembershipStatus = Database["public"]["Enums"]["membership_status"]

type MembershipQueryRow = {
  email: string
  employee_profiles:
    | {
        avatar_path: string | null
        first_name: string
        last_name: string
      }[]
    | null
  id: number
  organisation_id: number
  organisations:
    | {
        id: number
        name: string
        timezone: string
      }
    | {
        id: number
        name: string
        timezone: string
      }[]
  role: MembershipRole
  status: MembershipStatus
}

export type MembershipContext = {
  avatarPath: string | null
  displayName: string
  email: string
  membershipId: number
  organisationId: number
  organisationName: string
  organisationTimezone: string
  role: MembershipRole
  status: MembershipStatus
  timezone: string
  userId: string
}

export function mapMembershipContext(
  userId: string,
  membership: MembershipQueryRow
): MembershipContext {
  const organisation = Array.isArray(membership.organisations)
    ? membership.organisations[0]
    : membership.organisations
  const profile = membership.employee_profiles?.[0]

  if (!organisation) {
    throw new Error("Active membership is missing its organisation")
  }

  return {
    avatarPath: profile?.avatar_path ?? null,
    displayName: profile
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : membership.email.split("@")[0],
    email: membership.email,
    membershipId: membership.id,
    organisationId: membership.organisation_id,
    organisationName: organisation.name,
    organisationTimezone: organisation.timezone,
    role: membership.role,
    status: membership.status,
    timezone: organisation.timezone,
    userId,
  }
}

export const getMembershipContext = cache(
  async (): Promise<MembershipContext | null> => {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const userId = userData.user?.id

    if (userError || !userId) return null

    const { data, error } = await supabase
      .from("memberships")
      .select(
        `
          id,
          organisation_id,
          email,
          role,
          status,
          organisations!inner(id, name, timezone),
          employee_profiles(first_name, last_name, avatar_path)
        `
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle()

    if (error) {
      throw new Error("Unable to resolve the active membership")
    }

    if (!data) return null

    const context = mapMembershipContext(userId, data as MembershipQueryRow)
    const timezoneCookie = (await cookies()).get(VIEWER_TIMEZONE_COOKIE)?.value
    if (!timezoneCookie) return context

    try {
      return {
        ...context,
        timezone: assertIanaTimezone(decodeURIComponent(timezoneCookie)),
      }
    } catch {
      return context
    }
  }
)

export async function requireActiveMembership(): Promise<MembershipContext> {
  const context = await getMembershipContext()

  if (!context) {
    redirect("/login?reason=inactive")
  }

  return context
}

export async function requireOwner(): Promise<
  MembershipContext & { role: "owner" }
> {
  const context = await requireActiveMembership()

  if (context.role !== "owner") notFound()

  return context as MembershipContext & { role: "owner" }
}

export async function requireOperations(): Promise<
  MembershipContext & { role: "owner" | "manager" }
> {
  const context = await requireActiveMembership()

  if (context.role !== "owner" && context.role !== "manager") notFound()

  return context as MembershipContext & { role: "owner" | "manager" }
}

export async function requirePeopleManager(): Promise<
  MembershipContext & { role: "owner" | "manager" }
> {
  return requireOperations()
}

export async function requireAssignedWorker(): Promise<
  MembershipContext & { role: "employee" | "manager" }
> {
  const context = await requireActiveMembership()

  if (context.role !== "employee" && context.role !== "manager") notFound()

  return context as MembershipContext & { role: "employee" | "manager" }
}

export const requireEmployee = requireAssignedWorker
