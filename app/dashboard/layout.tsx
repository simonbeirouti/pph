import type { ReactNode } from "react"
import { cookies } from "next/headers"

import { DashboardChrome } from "@/components/dashboard-chrome"
import { OfflineV2Provider } from "@/components/offline-v2-provider"
import { PushNotificationProvider } from "@/components/push-notification-provider"
import { requireActiveMembership } from "@/lib/auth/membership"
import { createSignedAvatarUrl } from "@/lib/employees/data"
import { SIDEBAR_COOKIE_NAME } from "@/lib/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const membership = await requireActiveMembership()
  const avatarUrl = await createSignedAvatarUrl(membership.avatarPath)
  const sidebarOpen =
    (await cookies()).get(SIDEBAR_COOKIE_NAME)?.value !== "false"

  return (
    <PushNotificationProvider
      publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
    >
      <OfflineV2Provider
        serverMembership={{
          avatarPath: membership.avatarPath,
          displayName: membership.displayName,
          email: membership.email,
          membershipId: membership.membershipId,
          organisationId: membership.organisationId,
          organisationName: membership.organisationName,
          organisationTimezone: membership.organisationTimezone,
          role: membership.role,
          timezone: membership.timezone,
        }}
      >
        <DashboardChrome
          avatarUrl={avatarUrl}
          defaultSidebarOpen={sidebarOpen}
          membership={{
            avatarPath: membership.avatarPath,
            displayName: membership.displayName,
            email: membership.email,
            membershipId: membership.membershipId,
            organisationId: membership.organisationId,
            organisationName: membership.organisationName,
            organisationTimezone: membership.organisationTimezone,
            role: membership.role,
            timezone: membership.timezone,
          }}
        >
          {children}
        </DashboardChrome>
      </OfflineV2Provider>
    </PushNotificationProvider>
  )
}
