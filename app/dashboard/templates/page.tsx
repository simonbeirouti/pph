import { notFound } from "next/navigation"

import { TemplateScheduleWorkspace } from "@/components/template-schedule-workspace"
import { getTemplateScheduleData } from "@/lib/templates/data"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>
}) {
  const rawView = (await searchParams).view
  if (
    rawView !== undefined &&
    rawView !== "templates" &&
    rawView !== "schedules"
  ) {
    notFound()
  }

  const data = await getTemplateScheduleData()
  return (
    <TemplateScheduleWorkspace
      {...data}
      initialView={rawView === "schedules" ? "schedules" : "templates"}
    />
  )
}
