import { notFound } from "next/navigation"

import { EmployeeProfileScreen } from "@/components/employees/employee-profile-screen"
import { requirePeopleManager } from "@/lib/auth/membership"
import { getEmployee } from "@/lib/employees/data"
import { getEmployeeJobSummary } from "@/lib/jobs/data"
import { getEmployeeShiftSummary } from "@/lib/roster/data"

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ membershipId: string }>
  searchParams: Promise<{ access?: string }>
}) {
  const { membershipId: rawMembershipId } = await params
  const { access } = await searchParams
  const membershipId = Number(rawMembershipId)
  if (!Number.isSafeInteger(membershipId)) notFound()
  const [employee, jobSummary, shiftSummary, actor] = await Promise.all([
    getEmployee(membershipId),
    getEmployeeJobSummary(membershipId),
    getEmployeeShiftSummary(membershipId),
    requirePeopleManager(),
  ])
  if (!employee) notFound()

  return (
    <EmployeeProfileScreen
      access={access}
      actorRole={actor.role}
      employee={employee}
      jobSummary={jobSummary}
      shiftSummary={shiftSummary}
      timezone={actor.timezone}
    />
  )
}
