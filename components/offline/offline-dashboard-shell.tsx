"use client"
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome"
import { CachedDashboardRoutes } from "@/components/offline/offline-dashboard-router"
import {
  OfflineV2Provider,
  useOfflineV2,
} from "@/components/offline/offline-v2-provider"
import { PushNotificationProvider } from "@/components/notifications/push-notification-provider"
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration"

export function OfflineDashboardShell() {
  return (
    <PushNotificationProvider
      publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
    >
      <OfflineV2Provider cachedShell>
        <OfflineShellContent />
      </OfflineV2Provider>
    </PushNotificationProvider>
  )
}

function OfflineShellContent() {
  const { snapshot } = useOfflineV2()
  if (!snapshot) {
    return (
      <>
        <ServiceWorkerRegistration />
        <main className="min-h-svh bg-background p-4 md:p-6">
          <CachedDashboardRoutes />
        </main>
      </>
    )
  }

  return (
    <DashboardChrome
      avatarUrl={snapshot.profile.avatarUrl}
      defaultSidebarOpen
      membership={snapshot.membership}
    >
      {null}
    </DashboardChrome>
  )
}
