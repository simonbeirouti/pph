import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PwaInstallCard } from "@/components/pwa-install-card"
import { requireActiveMembership } from "@/lib/auth/membership"

export default async function Page() {
  const membership = await requireActiveMembership()

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Badge className="w-fit capitalize" variant="secondary">
          {membership.role}
        </Badge>
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
      {membership.role === "employee" ? <PwaInstallCard /> : null}
    </div>
  )
}
