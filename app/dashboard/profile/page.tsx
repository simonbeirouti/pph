import { updateOwnProfileAction } from "@/app/dashboard/profile/actions"
import { EmployeeAvatar } from "@/components/employee-avatar"
import { EmployeeForm } from "@/components/employee-form"
import { OfflineAwareLogoutButton } from "@/components/offline-storage-settings"
import { PushNotificationSettings } from "@/components/push-notification-settings"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCurrentProfile } from "@/lib/employees/data"

export default async function Page() {
  const profile = await getCurrentProfile()

  return (
    <div className="grid w-full max-w-7xl gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <EmployeeAvatar
            className="size-16"
            name={profile.displayName}
            url={profile.avatarUrl}
          />
          <h1 className="truncate text-2xl font-semibold">
            {profile.displayName}
          </h1>
        </div>
        <OfflineAwareLogoutButton />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profile information</CardTitle>
          <CardDescription>
            Update the details shown to your organisation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeForm
            action={updateOwnProfileAction}
            employee={profile}
            returnHref="/dashboard"
            returnLabel="Back to dashboard"
          />
        </CardContent>
      </Card>
      <PushNotificationSettings />
    </div>
  )
}
