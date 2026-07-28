"use client"

import { Button } from "@/components/ui/button"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="rounded-xl border bg-card p-8 text-center">
      <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your work is safe. Refresh the operational summary to try again.
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
