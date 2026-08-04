"use client"

import { useRef, useState } from "react"
import { CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function parseDatePart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : undefined
}

function formatDatePart(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function RosterDatePicker({
  "aria-invalid": ariaInvalid,
  id,
  name,
  onChange,
  value,
}: {
  "aria-invalid"?: boolean
  id: string
  name: string
  onChange: (value: string) => void
  value: string
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const selected = parseDatePart(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative" ref={anchorRef}>
        <Input
          aria-invalid={ariaInvalid}
          aria-label="Date"
          autoComplete="off"
          className="pr-9 tabular-nums"
          id={id}
          inputMode="numeric"
          name={name}
          onChange={(event) => onChange(event.currentTarget.value)}
          onClick={() => setOpen(true)}
          pattern="\d{4}-\d{2}-\d{2}"
          placeholder="YYYY-MM-DD"
          required
          value={value}
        />
        <PopoverTrigger
          render={
            <Button
              aria-label="Choose date"
              className="absolute top-1/2 right-0.5 -translate-y-1/2"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <CalendarIcon />
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="start"
        anchor={anchorRef}
        className="w-auto"
        collisionAvoidance={{
          align: "shift",
          fallbackAxisSide: "none",
          side: "none",
        }}
        side="bottom"
      >
        <Calendar
          defaultMonth={selected}
          mode="single"
          onSelect={(date) => {
            if (!date) return
            onChange(formatDatePart(date))
            setOpen(false)
          }}
          selected={selected}
        />
      </PopoverContent>
    </Popover>
  )
}
