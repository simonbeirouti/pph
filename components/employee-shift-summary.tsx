import { Badge } from "@/components/ui/badge"
import { formatShortWeekdayZonedDate } from "@/lib/date-format"
import {
  formatDuration,
  formatLocalTime,
  shiftDurationMinutes,
} from "@/lib/roster/time"
import type { EmployeeShiftSummary as EmployeeShiftSummaryModel } from "@/lib/roster/types"

export function EmployeeShiftSummary({
  summary,
  timezone,
}: {
  summary: EmployeeShiftSummaryModel
  timezone: string
}) {
  const shifts = [
    ...(summary.current ? [summary.current] : []),
    ...summary.upcoming,
  ]

  return shifts.length ? (
    <div className="grid gap-2">
      {shifts.map((shift) => (
        <div className="rounded-md border p-3" key={shift.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              {formatShortWeekdayZonedDate(shift.startsAt, timezone)}
            </p>
            {summary.current?.id === shift.id ? (
              <Badge>Working now</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatLocalTime(shift.startsAt, timezone)}–
            {formatLocalTime(shift.endsAt, timezone)} ·{" "}
            {formatDuration(shiftDurationMinutes(shift))}
          </p>
          {shift.notes ? <p className="mt-1 text-sm">{shift.notes}</p> : null}
        </div>
      ))}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">
      No current or upcoming shifts.
    </p>
  )
}
