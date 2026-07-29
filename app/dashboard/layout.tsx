import type { ReactNode } from "react"
import { cookies } from "next/headers"

import { setSidebarOpenAction } from "@/app/dashboard/actions"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb"
import { DashboardRealtimeProvider } from "@/components/dashboard-realtime-provider"
import { OfflineDashboardBoundary } from "@/components/offline-dashboard-router"
import { OfflineV2Provider } from "@/components/offline-v2-provider"
import { PushNotificationProvider } from "@/components/push-notification-provider"
import { PwaInstallCard } from "@/components/pwa-install-card"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"
import { ViewerTimezoneSync } from "@/components/viewer-timezone-sync"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarMobileTrigger,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
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
        <SidebarProvider
          className="h-svh overflow-hidden overscroll-none"
          defaultOpen={sidebarOpen}
          onOpenChange={setSidebarOpenAction}
        >
          <DashboardRealtimeProvider
            membership={{
              membershipId: membership.membershipId,
              organisationId: membership.organisationId,
              role: membership.role,
            }}
          >
            <ViewerTimezoneSync timezone={membership.timezone} />
            <AppSidebar avatarUrl={avatarUrl} membership={membership} />
            <SidebarInset className="min-h-0 overflow-hidden">
              <ServiceWorkerRegistration />
              {membership.role !== "owner" ? <PwaInstallCard /> : null}
              <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <SidebarMobileTrigger
                    className="-ml-2 size-11"
                    aria-label="Toggle navigation"
                  />
                  <SidebarTrigger
                    className="-ml-1 hidden md:inline-flex"
                    aria-label="Toggle navigation"
                  />
                  <Separator
                    orientation="vertical"
                    className="mr-2 data-vertical:h-4 data-vertical:self-auto"
                  />
                  <DashboardBreadcrumb />
                </div>
              </header>
              <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto overscroll-contain p-4 md:p-6">
                <OfflineDashboardBoundary>{children}</OfflineDashboardBoundary>
              </main>
            </SidebarInset>
          </DashboardRealtimeProvider>
        </SidebarProvider>
      </OfflineV2Provider>
    </PushNotificationProvider>
  )
}
