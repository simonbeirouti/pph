"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useOptionalOfflineV2 } from "@/components/offline/offline-v2-provider"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type BreadcrumbEntry = {
  href?: string
  label: string
}

function getBreadcrumbEntries(pathname: string): BreadcrumbEntry[] {
  const entries: BreadcrumbEntry[] = [
    {
      href: pathname === "/dashboard" ? undefined : "/dashboard",
      label: "Dashboard",
    },
  ]

  if (pathname.startsWith("/dashboard/employees")) {
    entries.push({
      href:
        pathname === "/dashboard/employees"
          ? undefined
          : "/dashboard/employees",
      label: "Employees",
    })

    if (pathname === "/dashboard/employees/new") {
      entries.push({ label: "New employee" })
    } else if (pathname !== "/dashboard/employees") {
      entries.push({ label: "Employee" })
    }
  } else if (pathname.startsWith("/dashboard/jobs")) {
    entries.push({ label: "Jobs" })
  } else if (pathname.startsWith("/dashboard/templates")) {
    entries.push({ label: "Templates & schedules" })
  } else if (pathname.startsWith("/dashboard/roster")) {
    entries.push({ label: "Roster" })
  } else if (pathname.startsWith("/dashboard/profile")) {
    entries.push({ label: "Profile" })
  }

  return entries
}

export function DashboardBreadcrumb() {
  const nextPathname = usePathname()
  const offline = useOptionalOfflineV2()
  const pathname =
    offline?.viewSource === "cache"
      ? new URL(offline.currentPath, "https://offline.invalid").pathname
      : nextPathname
  const entries = getBreadcrumbEntries(pathname)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {entries.map((entry, index) => (
          <Fragment key={`${entry.label}-${index}`}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {entry.href ? (
                <BreadcrumbLink render={<Link href={entry.href} prefetch={false} />}>
                  {entry.label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{entry.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
