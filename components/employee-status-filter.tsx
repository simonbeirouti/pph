"use client"

import { useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type EmployeeStatusFilterValue =
  | "all"
  | "invited"
  | "active"
  | "inactive"

const STATUS_LABELS: Record<EmployeeStatusFilterValue, string> = {
  active: "Active",
  all: "All statuses",
  inactive: "Inactive",
  invited: "Invited",
}

export function EmployeeStatusFilter({
  status,
}: {
  status: EmployeeStatusFilterValue
}) {
  const [value, setValue] = useState(status)

  return (
    <Select
      name="status"
      onValueChange={(nextValue) => {
        if (nextValue) setValue(nextValue as EmployeeStatusFilterValue)
      }}
      value={value}
    >
      <SelectTrigger aria-label="Filter by status" className="h-8 w-full">
        <SelectValue>{STATUS_LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectItem value="invited">Invited</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem>
      </SelectContent>
    </Select>
  )
}
