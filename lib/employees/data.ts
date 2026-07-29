import "server-only"

import { cache } from "react"

import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import {
  requireActiveMembership,
  requireAssignedWorker,
  requirePeopleManager,
} from "@/lib/auth/membership"

type MembershipStatus = Database["public"]["Enums"]["membership_status"]
type MembershipRole = Database["public"]["Enums"]["membership_role"]
type InviteStatus = Database["public"]["Enums"]["invite_delivery_status"]

type EmployeeQueryRow = {
  email: string
  employee_profiles: {
    avatar_path: string | null
    first_name: string
    id: number
    job_title: string
    last_name: string
    phone: string
    version: number
  }[]
  id: number
  invite_delivery_status: InviteStatus
  invite_last_attempted_at: string | null
  role: MembershipRole
  status: MembershipStatus
  user_id: string | null
  version: number
}

export type EmployeeSummary = {
  avatarPath: string | null
  avatarUrl: string | null
  displayName: string
  email: string
  firstName: string
  inviteDeliveryStatus: InviteStatus
  inviteLastAttemptedAt: string | null
  jobTitle: string
  lastName: string
  membershipId: number
  membershipVersion?: number
  phone: string
  profileId: number
  profileVersion?: number
  role: MembershipRole
  status: MembershipStatus
  userId: string | null
}

export type ActiveEmployeeOption = Pick<
  EmployeeSummary,
  "avatarPath" | "displayName" | "jobTitle"
> & {
  employeeMembershipId: number
}

export function toActiveEmployeeOption(
  employee: Pick<
    EmployeeSummary,
    "avatarPath" | "displayName" | "jobTitle" | "membershipId"
  >
): ActiveEmployeeOption {
  return {
    avatarPath: employee.avatarPath,
    displayName: employee.displayName,
    employeeMembershipId: employee.membershipId,
    jobTitle: employee.jobTitle,
  }
}

export async function createSignedAvatarUrl(
  avatarPath: string | null
): Promise<string | null> {
  if (!avatarPath) return null
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(avatarPath, 300)
  return error ? null : data.signedUrl
}

async function mapEmployee(row: EmployeeQueryRow): Promise<EmployeeSummary> {
  const profile = row.employee_profiles[0]
  if (!profile) throw new Error("Employee is missing its profile")
  return {
    avatarPath: profile.avatar_path,
    avatarUrl: await createSignedAvatarUrl(profile.avatar_path),
    displayName: `${profile.first_name} ${profile.last_name}`.trim(),
    email: row.email,
    firstName: profile.first_name,
    inviteDeliveryStatus: row.invite_delivery_status,
    inviteLastAttemptedAt: row.invite_last_attempted_at,
    jobTitle: profile.job_title,
    lastName: profile.last_name,
    membershipId: row.id,
    membershipVersion: row.version,
    phone: profile.phone,
    profileId: profile.id,
    profileVersion: profile.version,
    role: row.role,
    status: row.status,
    userId: row.user_id,
  }
}

const EMPLOYEE_FIELDS = `
  id,
  version,
  user_id,
  email,
  status,
  invite_delivery_status,
  invite_last_attempted_at,
  role,
  employee_profiles!inner(
    id,
    first_name,
    last_name,
    phone,
    job_title,
    avatar_path,
    version
  )
`

export async function listEmployees(
  input: {
    search?: string
    status?: MembershipStatus | "all"
  } = {}
): Promise<EmployeeSummary[]> {
  const owner = await requirePeopleManager()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select(EMPLOYEE_FIELDS)
    .eq("organisation_id", owner.organisationId)
    .order("email")

  if (error) throw new Error("Unable to load employees")

  const rows = await Promise.all(
    ((data ?? []) as unknown as EmployeeQueryRow[]).map(mapEmployee)
  )
  const search = input.search?.trim().toLocaleLowerCase()

  return rows
    .filter(
      (employee) =>
        input.status === "all" ||
        !input.status ||
        employee.status === input.status
    )
    .filter((employee) => {
      if (!search) return true
      return `${employee.displayName} ${employee.email}`
        .toLocaleLowerCase()
        .includes(search)
    })
    .toSorted((left, right) =>
      left.displayName.localeCompare(right.displayName)
    )
}

export const getEmployee = cache(
  async (membershipId: number): Promise<EmployeeSummary | null> => {
    const owner = await requirePeopleManager()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("memberships")
      .select(EMPLOYEE_FIELDS)
      .eq("organisation_id", owner.organisationId)
      .eq("id", membershipId)
      .maybeSingle()

    if (error) throw new Error("Unable to load employee")
    return data ? mapEmployee(data as unknown as EmployeeQueryRow) : null
  }
)

export const getCurrentEmployee = cache(async (): Promise<EmployeeSummary> => {
  const membership = await requireAssignedWorker()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select(EMPLOYEE_FIELDS)
    .eq("organisation_id", membership.organisationId)
    .eq("id", membership.membershipId)
    .in("role", ["employee", "manager"])
    .single()

  if (error) throw new Error("Unable to load your profile")
  return mapEmployee(data as unknown as EmployeeQueryRow)
})

export const getCurrentProfile = cache(async (): Promise<EmployeeSummary> => {
  const membership = await requireActiveMembership()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select(EMPLOYEE_FIELDS)
    .eq("organisation_id", membership.organisationId)
    .eq("id", membership.membershipId)
    .single()

  if (error) throw new Error("Unable to load your profile")
  return mapEmployee(data as unknown as EmployeeQueryRow)
})

export async function listActiveEmployeeOptions(): Promise<
  ActiveEmployeeOption[]
> {
  const employees = await listEmployees({ status: "active" })
  return employees
    .filter((employee) => employee.role !== "owner")
    .map(toActiveEmployeeOption)
}
