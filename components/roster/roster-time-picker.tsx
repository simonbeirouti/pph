"use client"

import { useRef, useState } from "react"
import { Clock3Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const HOURS = Array.from({ length: 24 }, (_, value) => value)
const MINUTES = [0, 15, 30, 45]

function formatPart(value: number) {
  return String(value).padStart(2, "0")
}

function parseClockTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour < 24 && minute < 60 ? { hour, minute } : null
}

export function RosterTimePicker({
  "aria-invalid": ariaInvalid,
  id,
  label,
  name,
  onChange,
  value,
}: {
  "aria-invalid"?: boolean
  id: string
  label: string
  name: string
  onChange: (value: string) => void
  value: string
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = parseClockTime(value) ?? { hour: 9, minute: 0 }
  const choiceLabel = label.toLocaleLowerCase().endsWith("time")
    ? label
    : `${label} time`

  const updateHour = (hour: number) => {
    onChange(`${formatPart(hour)}:${formatPart(selected.minute)}`)
  }
  const updateMinute = (minute: number) => {
    onChange(`${formatPart(selected.hour)}:${formatPart(minute)}`)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative" ref={anchorRef}>
        <Input
          aria-invalid={ariaInvalid}
          aria-label={label}
          autoComplete="off"
          className="pr-9 tabular-nums"
          id={id}
          inputMode="numeric"
          name={name}
          onChange={(event) => onChange(event.currentTarget.value)}
          onClick={() => setOpen(true)}
          pattern="[0-2][0-9]:[0-5][0-9]"
          placeholder="HH:MM"
          required
          value={value}
        />
        <PopoverTrigger
          render={
            <Button
              aria-label={`Choose ${choiceLabel.toLocaleLowerCase()}`}
              className="absolute top-1/2 right-0.5 -translate-y-1/2"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <Clock3Icon />
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="start"
        anchor={anchorRef}
        className="w-56 p-2"
        side="bottom"
      >
        <div className="grid grid-cols-2 gap-2" data-roster-time-picker>
          <TimeColumn
            label="Hour"
            onSelect={updateHour}
            selected={selected.hour}
            values={HOURS}
          />
          <TimeColumn
            label="Minute"
            onSelect={updateMinute}
            selected={selected.minute}
            values={MINUTES}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TimeColumn({
  label,
  onSelect,
  selected,
  values,
}: {
  label: string
  onSelect: (value: number) => void
  selected: number
  values: number[]
}) {
  return (
    <div className="grid gap-1">
      <p className="px-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="grid max-h-52 grid-cols-1 gap-1 overflow-y-auto pr-1">
        {values.map((value) => (
          <Button
            aria-label={`Set ${label.toLocaleLowerCase()} to ${formatPart(value)}`}
            className="w-full justify-center tabular-nums"
            key={value}
            onClick={() => onSelect(value)}
            size="sm"
            type="button"
            variant={value === selected ? "secondary" : "ghost"}
          >
            {formatPart(value)}
          </Button>
        ))}
      </div>
    </div>
  )
}
