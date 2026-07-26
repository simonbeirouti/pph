import { cache } from "react"
import { notFound, redirect } from "next/navigation"

import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

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
    role: membership.role,
    status: membership.status,
    timezone: organisation.timezone,
    userId,
  }
}

export const getMembershipContext = cache(
  async (): Promise<MembershipContext | null> => {
    const supabase = await createClient()
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims()
    const userId = claimsData?.claims.sub

    if (claimsError || !userId) return null

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

    return data
      ? mapMembershipContext(userId, data as MembershipQueryRow)
      : null
  }
)

export async function requireActiveMembership(): Promise<MembershipContext> {
  const context = await getMembershipContext()

  if (!context) {
    redirect("/login?reason=inactive")
  }

  return context
}

export async function requireOwner(): Promise<MembershipContext> {
  const context = await requireActiveMembership()

  if (context.role !== "owner") notFound()

  return context
}

export async function requireEmployee(): Promise<MembershipContext> {
  const context = await requireActiveMembership()

  if (context.role !== "employee") notFound()

  return context
}
