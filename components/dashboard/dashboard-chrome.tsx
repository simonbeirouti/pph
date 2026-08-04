"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import { setSidebarOpenAction } from "@/app/dashboard/actions"
import { AppSidebar } from "@/components/navigation/app-sidebar"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { OfflineDashboardBoundary } from "@/components/offline/offline-dashboard-router"
import { useOfflineV2 } from "@/components/offline/offline-v2-provider"
import { DashboardRealtimeProvider } from "@/components/dashboard/dashboard-realtime-provider"
import { PushNotificationPrompt } from "@/components/notifications/push-notification-prompt"
import { PwaInstallCard } from "@/components/pwa/pwa-install-card"
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration"
import { ViewerTimezoneSync } from "@/components/providers/viewer-timezone-sync"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarMobileTrigger,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import type { OfflineMembership } from "@/lib/offline-v2/types"
import {
  readSidebarOpenCookie,
  readSidebarOpenValue,
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
} from "@/lib/sidebar"

const SIDEBAR_STATE_EVENT = "pph:sidebar-state"

function subscribeToSidebarState(onStoreChange: () => void) {
  window.addEventListener(SIDEBAR_STATE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(SIDEBAR_STATE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

export function DashboardChrome({
  avatarUrl,
  children,
  defaultSidebarOpen,
  membership,
}: {
  avatarUrl: string | null
  children: ReactNode
  defaultSidebarOpen: boolean
  membership: OfflineMembership
}) {
  const offline = useOfflineV2()
  const sidebarOpen = useSyncExternalStore(
    subscribeToSidebarState,
    () =>
      readSidebarOpenValue(localStorage.getItem(SIDEBAR_COOKIE_NAME)) ??
      readSidebarOpenCookie(document.cookie) ??
      defaultSidebarOpen,
    () => defaultSidebarOpen
  )

  return (
    <SidebarProvider
      className="h-svh overflow-hidden overscroll-none"
      open={sidebarOpen}
      onOpenChange={(open) => {
        localStorage.setItem(SIDEBAR_COOKIE_NAME, String(open))
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${String(open)}; Path=/; Max-Age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`
        window.dispatchEvent(new Event(SIDEBAR_STATE_EVENT))
        void setSidebarOpenAction(open).catch(() => {})
      }}
    >
      <DashboardRealtimeProvider
        membership={{
          membershipId: membership.membershipId,
          organisationId: membership.organisationId,
          role: membership.role,
        }}
      >
        {offline.viewSource === "server" ? (
          <ViewerTimezoneSync timezone={membership.timezone} />
        ) : null}
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
            <PushNotificationPrompt />
            <OfflineDashboardBoundary>{children}</OfflineDashboardBoundary>
          </main>
        </SidebarInset>
      </DashboardRealtimeProvider>
    </SidebarProvider>
  )
}
