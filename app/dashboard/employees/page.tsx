import { EmployeeCreateDialog } from "@/components/employee-create-dialog"
import { EmployeeDirectoryTable } from "@/components/employee-directory-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listEmployees } from "@/lib/employees/data"
import { listEmployeeJobSummaries } from "@/lib/jobs/data"

const STATUSES = new Set(["all", "invited", "active", "inactive"])

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const params = await searchParams
  const status = STATUSES.has(params.status ?? "")
    ? (params.status as "all" | "invited" | "active" | "inactive")
    : "all"
  const [employees, jobSummaries] = await Promise.all([
    listEmployees({ search: params.q, status }),
    listEmployeeJobSummaries(),
  ])

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            Manage profiles, invitations, and application access.
          </p>
        </div>
        <EmployeeCreateDialog />
      </div>
      <Card>
        <CardContent className="grid gap-4">
          <form className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
            <Input
              aria-label="Search employees"
              defaultValue={params.q}
              name="q"
              placeholder="Search name or email"
            />
            <Select defaultValue={status} name="status">
              <SelectTrigger
                aria-label="Filter by status"
                className="h-8 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
          {employees.length ? (
            <EmployeeDirectoryTable
              employees={employees}
              jobSummaries={jobSummaries}
            />
          ) : (
            <div className="grid justify-items-center gap-3 py-12 text-center">
              <h2 className="font-medium">No employees found</h2>
              <p className="text-sm text-muted-foreground">
                Adjust the search or add your first employee.
              </p>
              <EmployeeCreateDialog />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
