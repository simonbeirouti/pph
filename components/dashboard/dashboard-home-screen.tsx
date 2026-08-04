"use client"

import Link from "next/link"

import {
  EmployeeOperationalDashboard,
  OwnerOperationalDashboard,
} from "@/components/dashboard/operational-dashboard"
import { Button } from "@/components/ui/button"
import type {
  EmployeeDashboardData,
  OwnerDashboardData,
} from "@/lib/dashboard/data"

export function DashboardHomeScreen({
  displayName,
  employeeData,
  operationsData,
  role,
  timezone,
}: {
  displayName: string
  employeeData: EmployeeDashboardData | null
  operationsData: OwnerDashboardData | null
  role: "employee" | "manager" | "owner"
  timezone: string
}) {
  if (role === "employee") {
    return employeeData ? (
      <EmployeeOperationalDashboard
        data={employeeData}
        name={displayName}
        timezone={timezone}
      />
    ) : null
  }

  return operationsData ? (
    <div className="grid gap-4">
      {role === "manager" ? (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Your assigned work</p>
            <p className="text-sm text-muted-foreground">
              Managers can manage team operations and complete their own jobs.
            </p>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link href="/dashboard/jobs?mode=my-work" prefetch={false} />
            }
          >
            View my work
          </Button>
        </div>
      ) : null}
      <OwnerOperationalDashboard
        data={operationsData}
        name={displayName}
        timezone={timezone}
      />
    </div>
  ) : null
}
