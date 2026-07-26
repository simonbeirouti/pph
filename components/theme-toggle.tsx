"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label="Toggle theme"
          className="bg-sidebar"
          onClick={() => {
            const currentTheme =
              resolvedTheme ??
              (document.documentElement.classList.contains("dark")
                ? "dark"
                : "light")
            setTheme(currentTheme === "dark" ? "light" : "dark")
          }}
          title="Toggle theme"
          type="button"
          variant="outline"
        >
          <SunIcon className="hidden dark:block" />
          <MoonIcon className="dark:hidden" />
          <span>Theme</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
