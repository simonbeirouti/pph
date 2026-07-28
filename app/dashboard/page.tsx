import {
  EmployeeOperationalDashboard,
  OwnerOperationalDashboard,
} from "@/components/operational-dashboard"
import { requireActiveMembership } from "@/lib/auth/membership"
import {
  getEmployeeDashboardData,
  getOwnerDashboardData,
} from "@/lib/dashboard/data"

export default async function Page() {
  const membership = await requireActiveMembership()
  if (membership.role === "employee") {
    const data = await getEmployeeDashboardData()
    return (
      <EmployeeOperationalDashboard
        data={data}
        name={membership.displayName}
        timezone={membership.timezone}
      />
    )
  }
  const data = await getOwnerDashboardData()
  return (
    <OwnerOperationalDashboard
      data={data}
      name={membership.displayName}
      timezone={membership.timezone}
    />
  )
}
