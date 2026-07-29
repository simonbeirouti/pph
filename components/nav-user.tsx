"use client"

import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser({
  isActive = false,
  user,
}: {
  isActive?: boolean
  user: {
    avatar: string | null
    name: string
  }
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-current={isActive ? "page" : undefined}
          isActive={isActive}
          render={
            <Link
              href="/dashboard/profile"
              onNavigate={() => {
                if (isMobile) setOpenMobile(false)
              }}
            />
          }
          size="lg"
          tooltip="Profile"
        >
          <Avatar>
            {user.avatar ? (
              <AvatarImage src={user.avatar} alt={user.name} />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="truncate font-medium">{user.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
