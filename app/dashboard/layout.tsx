import type { ReactNode } from "react"
import { cookies } from "next/headers"

import { setSidebarOpenAction } from "@/app/dashboard/actions"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb"
import { DashboardRealtimeProvider } from "@/components/dashboard-realtime-provider"
import { PwaInstallCard } from "@/components/pwa-install-card"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"
import { ViewerTimezoneSync } from "@/components/viewer-timezone-sync"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
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
    <SidebarProvider
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
        <SidebarInset>
          <ServiceWorkerRegistration />
          {membership.role === "employee" ? <PwaInstallCard /> : null}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger
                className="-ml-1"
                aria-label="Toggle navigation"
              />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <DashboardBreadcrumb />
            </div>
          </header>
          <main className="flex min-w-0 flex-1 flex-col p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </DashboardRealtimeProvider>
    </SidebarProvider>
  )
}
