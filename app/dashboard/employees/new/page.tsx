import { createEmployeeAction } from "@/app/dashboard/employees/actions"
import { EmployeeForm } from "@/components/employee-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requirePeopleManager } from "@/lib/auth/membership"

export default async function Page() {
  const actor = await requirePeopleManager()
  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Add employee</h1>
          </CardTitle>
          <CardDescription>
            Create the employee profile before sending their secure invitation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeForm
            action={createEmployeeAction}
            canChooseRole={actor.role === "owner"}
          />
        </CardContent>
      </Card>
    </div>
  )
}
