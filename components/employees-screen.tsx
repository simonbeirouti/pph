"use client"

import { useEffect, type FormEvent } from "react"
import { useRouter } from "next/navigation"

import { EmployeeCreateDialog } from "@/components/employee-create-dialog"
import { EmployeeDirectoryTable } from "@/components/employee-directory-table"
import {
  EmployeeStatusFilter,
  type EmployeeStatusFilterValue,
} from "@/components/employee-status-filter"
import { useOfflineV2Actions } from "@/components/offline-v2-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { EmployeeSummary } from "@/lib/employees/data"
import type { EmployeeJobSummary } from "@/lib/jobs/types"
import type { EmployeeShiftSummary } from "@/lib/roster/types"

export function EmployeesScreen({
  actorRole,
  employees,
  jobSummaries,
  openCreate = false,
  query,
  shiftSummaries,
  status,
  timezone,
}: {
  actorRole: "manager" | "owner"
  employees: EmployeeSummary[]
  jobSummaries: Record<number, EmployeeJobSummary>
  openCreate?: boolean
  query?: string
  shiftSummaries: Record<number, EmployeeShiftSummary>
  status: EmployeeStatusFilterValue
  timezone: string
}) {
  const offline = useOfflineV2Actions()
  const router = useRouter()

  useEffect(() => {
    if (!openCreate) return
    const url = new URL(window.location.href)
    url.searchParams.delete("create")
    window.history.replaceState(null, "", `${url.pathname}${url.search}`)
  }, [openCreate])

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const params = new URLSearchParams()
    const nextQuery = String(form.get("q") ?? "").trim()
    const nextStatus = String(form.get("status") ?? "all")
    if (nextQuery) params.set("q", nextQuery)
    if (nextStatus !== "all") params.set("status", nextStatus)
    const href = `/dashboard/employees${params.size ? `?${params}` : ""}`
    if (offline.navigationMode === "history") offline.navigate?.(href)
    else router.push(href)
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            Manage profiles, invitations, and application access.
          </p>
        </div>
        <EmployeeCreateDialog
          canChooseRole={actorRole === "owner"}
          initialOpen={openCreate}
        />
      </div>
      <Card>
        <CardContent className="grid gap-4">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]"
            onSubmit={applyFilters}
          >
            <Input
              aria-label="Search employees"
              defaultValue={query}
              name="q"
              placeholder="Search name or email"
            />
            <EmployeeStatusFilter status={status} />
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
          {employees.length ? (
            <EmployeeDirectoryTable
              actorRole={actorRole}
              employees={employees}
              jobSummaries={jobSummaries}
              shiftSummaries={shiftSummaries}
              timezone={timezone}
            />
          ) : (
            <div className="grid justify-items-center gap-3 py-12 text-center">
              <h2 className="font-medium">No employees found</h2>
              <p className="text-sm text-muted-foreground">
                Adjust the search or add your first employee.
              </p>
              <EmployeeCreateDialog canChooseRole={actorRole === "owner"} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
