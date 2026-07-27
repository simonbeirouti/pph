"use client"

import Link from "next/link"
import {
  BriefcaseBusinessIcon,
  Building2Icon,
  LayoutDashboardIcon,
  UsersIcon,
} from "lucide-react"
import { usePathname } from "next/navigation"

import type { MembershipContext } from "@/lib/auth/membership"
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar({
  avatarUrl,
  membership,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  avatarUrl: string | null
  membership: MembershipContext
}) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false)
  }
  const isRouteActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="relative">
        <SidebarTrigger
          aria-label="Close navigation"
          className="absolute top-2 right-2 z-10 md:hidden"
        />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={closeMobileSidebar}
              render={<Link href="/dashboard" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2Icon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {membership.organisationName}
                </span>
                <span className="truncate text-xs capitalize">
                  {membership.role}
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
                onClick={closeMobileSidebar}
                render={<Link href="/dashboard" />}
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
                onClick={closeMobileSidebar}
                render={<Link href="/dashboard/jobs" />}
              >
                <BriefcaseBusinessIcon />
                <span>Jobs</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {membership.role === "owner" ? (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    aria-current={
                      isRouteActive("/dashboard/employees") ? "page" : undefined
                    }
                    isActive={isRouteActive("/dashboard/employees")}
                    tooltip="Employees"
                    onClick={closeMobileSidebar}
                    render={<Link href="/dashboard/employees" />}
                  >
                    <UsersIcon />
                    <span>Employees</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            ) : null}
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
