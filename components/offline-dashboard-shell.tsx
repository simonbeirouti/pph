"use client"

import Link from "next/link"

import { OfflineDashboardRouter } from "@/components/offline-dashboard-router"
import {
  OfflineV2Provider,
  useOfflineV2,
} from "@/components/offline-v2-provider"
import { Button } from "@/components/ui/button"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"

const NAVIGATION = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/jobs", label: "Jobs" },
  { href: "/dashboard/roster", label: "Roster" },
  { href: "/dashboard/employees", label: "People", operationsOnly: true },
  { href: "/dashboard/templates", label: "Templates", operationsOnly: true },
  { href: "/dashboard/profile", label: "Profile" },
] as const

export function OfflineDashboardShell() {
  return (
    <OfflineV2Provider>
      <OfflineShellContent />
    </OfflineV2Provider>
  )
}

function OfflineShellContent() {
  const { snapshot } = useOfflineV2()
  const canOperate =
    snapshot?.membership.role === "owner" ||
    snapshot?.membership.role === "manager"

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <ServiceWorkerRegistration />
      <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur md:px-6">
        <Link className="text-lg font-semibold" href="/dashboard" prefetch={false}>
          Employee Ops
        </Link>
      </header>
      {snapshot ? (
        <nav
          aria-label="Dashboard"
          className="flex gap-2 overflow-x-auto border-b px-4 py-2 md:px-6"
        >
          {NAVIGATION.filter(
            (item) =>
              !("operationsOnly" in item) || !item.operationsOnly || canOperate
          ).map((item) => (
            <Button
              key={item.href}
              nativeButton={false}
              render={<Link href={item.href} prefetch={false} />}
              size="sm"
              variant="ghost"
            >
              {item.label}
            </Button>
          ))}
        </nav>
      ) : null}
      <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
        <OfflineDashboardRouter />
      </main>
    </div>
  )
}
