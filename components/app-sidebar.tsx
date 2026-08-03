"use client"

import Link from "next/link"
import Image from "next/image"
import {
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  UsersIcon,
} from "lucide-react"
import { usePathname } from "next/navigation"

import { useOptionalOfflineV2 } from "@/components/offline-v2-provider"
import { NavUser } from "@/components/nav-user"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import type { OfflineMembership } from "@/lib/offline-v2/types"

export function AppSidebar({
  avatarUrl,
  membership,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  avatarUrl: string | null
  membership: OfflineMembership
}) {
  const nextPathname = usePathname()
  const offline = useOptionalOfflineV2()
  const pathname =
    offline?.viewSource === "cache"
      ? new URL(offline.currentPath, "https://offline.invalid").pathname
      : nextPathname
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false)
  }
  const isRouteActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <Link href="/dashboard" onClick={closeMobileSidebar} prefetch={false} />
              }
            >
              <div className="flex group-data-[state=collapsed]:-mr-2 aspect-square size-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary">
                <Image
                  alt=""
                  className="size-full object-cover"
                  height={32}
                  src="/logo.png"
                  width={32}
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {membership.organisationName}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                aria-current={pathname === "/dashboard" ? "page" : undefined}
                isActive={pathname === "/dashboard"}
                tooltip="Dashboard"
                render={
                  <Link href="/dashboard" onClick={closeMobileSidebar} prefetch={false} />
                }
              >
                <LayoutDashboardIcon />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                aria-current={
                  isRouteActive("/dashboard/jobs") ? "page" : undefined
                }
                isActive={isRouteActive("/dashboard/jobs")}
                tooltip="Jobs"
                render={
                  <Link
                    href="/dashboard/jobs"
                    onClick={closeMobileSidebar}
                    prefetch={false}
                  />
                }
              >
                <BriefcaseBusinessIcon />
                <span>Jobs</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {membership.role !== "employee" ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  aria-current={
                    isRouteActive("/dashboard/templates") ? "page" : undefined
                  }
                  isActive={isRouteActive("/dashboard/templates")}
                  tooltip="Templates"
                  render={
                    <Link
                      href="/dashboard/templates"
                      onClick={closeMobileSidebar}
                      prefetch={false}
                    />
                  }
                >
                  <ListChecksIcon />
                  <span>Templates</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
            {membership.role !== "employee" ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  aria-current={
                    isRouteActive("/dashboard/employees") ? "page" : undefined
                  }
                  isActive={isRouteActive("/dashboard/employees")}
                  tooltip="Employees"
                  render={
                    <Link
                      href="/dashboard/employees"
                      onClick={closeMobileSidebar}
                      prefetch={false}
                    />
                  }
                >
                  <UsersIcon />
                  <span>Employees</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
            <SidebarMenuItem>
              <SidebarMenuButton
                aria-current={
                  isRouteActive("/dashboard/roster") ? "page" : undefined
                }
                isActive={isRouteActive("/dashboard/roster")}
                tooltip="Roster"
                render={
                  <Link
                    href="/dashboard/roster"
                    onClick={closeMobileSidebar}
                    prefetch={false}
                  />
                }
              >
                <CalendarDaysIcon />
                <span>Roster</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
        <NavUser
          isActive={isRouteActive("/dashboard/profile")}
          user={{
            avatar: avatarUrl,
            name: membership.displayName,
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
