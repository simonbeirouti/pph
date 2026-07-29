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
    logDashboardPayload({
      jobs: data.jobs.length,
      nextActionable: Boolean(data.nextActionable),
      role: membership.role,
      shiftCurrent: Boolean(data.shifts.current),
      shiftUpcoming: data.shifts.upcoming.length,
      timezone: membership.timezone,
    })
    return (
      <EmployeeOperationalDashboard
        data={data}
        name={membership.displayName}
        timezone={membership.timezone}
      />
    )
  }
  const data = await getOwnerDashboardData()
  logDashboardPayload({
    awaitingReview: data.awaitingReview,
    outstanding: data.outstanding,
    recentlySubmitted: data.recentlySubmitted.length,
    role: membership.role,
    rosterToday: data.todayRoster.length,
    timezone: membership.timezone,
    urgent: data.urgent.length,
    urgentCount: data.urgentCount,
    workingNow: data.workingNow,
  })
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

function logDashboardPayload(
  payload: Record<string, boolean | number | string>
) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[dashboard-debug] shared payload ${JSON.stringify(payload)}`)
  }
}
