import type { ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { requireActiveMembership } from "@/lib/auth/membership"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const membership = await requireActiveMembership()

  return (
    <SidebarProvider>
      <AppSidebar membership={membership} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" aria-label="Toggle navigation" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <span className="text-sm font-medium">Dashboard</span>
          </div>
        </header>
        <main className="flex flex-1 flex-col p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
