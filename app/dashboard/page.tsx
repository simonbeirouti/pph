import { DashboardHomeScreen } from "@/components/dashboard/dashboard-home-screen"
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
      <DashboardHomeScreen
        displayName={membership.displayName}
        employeeData={data}
        operationsData={null}
        role={membership.role}
        timezone={membership.timezone}
      />
    )
  }
  const data = await getOwnerDashboardData()
  return (
    <DashboardHomeScreen
      displayName={membership.displayName}
      employeeData={null}
      operationsData={data}
      role={membership.role}
      timezone={membership.timezone}
    />
  )
}
