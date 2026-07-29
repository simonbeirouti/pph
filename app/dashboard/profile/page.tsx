import { updateOwnProfileAction } from "@/app/dashboard/profile/actions"
import { EmployeeAvatar } from "@/components/employee-avatar"
import { EmployeeForm } from "@/components/employee-form"
import {
  OfflineAwareLogoutButton,
  OfflineStorageSettings,
} from "@/components/offline-storage-settings"
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
    <div className="grid w-full gap-6">
      <div className="flex items-center justify-between gap-4">
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
      <PushNotificationSettings
        publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      />
      <OfflineStorageSettings />
    </div>
  )
}
