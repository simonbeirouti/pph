import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmployeeShiftSummary } from "@/components/employee-shift-summary"
import { requireActiveMembership } from "@/lib/auth/membership"
import { getEmployeeShiftSummary } from "@/lib/roster/data"

export default async function Page() {
  const membership = await requireActiveMembership()
  const shiftSummary =
    membership.role === "employee"
      ? await getEmployeeShiftSummary(membership.membershipId)
      : null

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {membership.displayName}
        </h1>
        <p className="text-muted-foreground">
          Your operational dashboard is ready for the next feature step.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Platform foundation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Organisation</p>
            <p className="font-medium">{membership.organisationName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Timezone</p>
            <p className="font-medium">{membership.timezone}</p>
          </div>
        </CardContent>
      </Card>
      {shiftSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>Your roster</CardTitle>
          </CardHeader>
          <CardContent>
            <EmployeeShiftSummary
              summary={shiftSummary}
              timezone={membership.timezone}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
