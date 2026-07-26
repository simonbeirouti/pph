"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

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
  } else if (pathname.startsWith("/dashboard/profile")) {
    entries.push({ label: "Profile" })
  }

  return entries
}

export function DashboardBreadcrumb() {
  const pathname = usePathname()
  const entries = getBreadcrumbEntries(pathname)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {entries.map((entry, index) => (
          <Fragment key={`${entry.label}-${index}`}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {entry.href ? (
                <BreadcrumbLink render={<Link href={entry.href} />}>
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
