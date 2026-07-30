import Link from "next/link"

import {
  EmployeeOperationalDashboard,
  OwnerOperationalDashboard,
} from "@/components/operational-dashboard"
import { requireActiveMembership } from "@/lib/auth/membership"
import {
  getEmployeeDashboardData,
  getOwnerDashboardData,
} from "@/lib/dashboard/data"
import { Button } from "@/components/ui/button"

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
    <div className="grid gap-4">
      {membership.role === "manager" ? (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Your assigned work</p>
            <p className="text-sm text-muted-foreground">
              Managers can manage team operations and complete their own jobs.
            </p>
          </div>
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/jobs?mode=my-work" />}
          >
            View my work
          </Button>
        </div>
      ) : null}
      <OwnerOperationalDashboard
        data={data}
        name={membership.displayName}
        timezone={membership.timezone}
      />
    </div>
  )
}
