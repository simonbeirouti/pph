"use client"

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CloudOffIcon,
  CloudUploadIcon,
  LoaderCircleIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useOptionalOfflineV2 } from "@/components/offline-v2-provider"
import type { OfflineSyncStatus } from "@/lib/offline-v2/types"

const LABELS: Record<OfflineSyncStatus, string> = {
  changes_pending: "Changes pending",
  cold: "Connect once to prepare",
  lease_expired: "Reconnect to verify access",
  needs_attention: "Needs attention",
  offline: "Offline",
  offline_ready: "Offline ready",
  preparing: "Preparing offline use",
  storage_warning: "Offline storage incomplete",
  syncing: "Syncing",
}

export function OfflineSyncStatus() {
  const offline = useOptionalOfflineV2()
  if (!offline) return null
  const { conflicts, operations, status } = offline
  const operationsWithErrors = operations.filter(
    (operation) => operation.lastError
  )
  const Icon =
    status === "offline_ready"
      ? CheckCircle2Icon
      : status === "preparing" || status === "syncing"
        ? LoaderCircleIcon
        : status === "changes_pending"
          ? CloudUploadIcon
          : status === "offline"
            ? CloudOffIcon
            : AlertTriangleIcon

  const badge = (
    <Badge
      aria-live="polite"
      className="gap-1.5"
      data-offline-status={status}
      variant={
        status === "needs_attention" ||
        status === "storage_warning" ||
        status === "lease_expired"
          ? "destructive"
          : "outline"
      }
    >
      <Icon
        aria-hidden="true"
        className={
          status === "preparing" || status === "syncing"
            ? "size-3.5 animate-spin"
            : "size-3.5"
        }
      />
      {LABELS[status]}
    </Badge>
  )

  if (
    status !== "needs_attention" &&
    status !== "storage_warning" &&
    status !== "lease_expired" &&
    status !== "cold" &&
    !(status === "changes_pending" && operationsWithErrors.length)
  ) {
    return badge
  }

  const title =
    status === "needs_attention"
      ? "Changes need attention"
      : status === "changes_pending"
        ? "Changes are retrying"
        : status === "storage_warning"
          ? "Offline storage is incomplete"
          : status === "lease_expired"
            ? "Access must be revalidated"
            : "This device is not prepared"
  const description =
    status === "needs_attention"
      ? "A server record changed while this device had pending work. Both versions are preserved below."
      : status === "changes_pending"
        ? "A queued upload or change has not reached the server yet. It remains stored on this device and will retry automatically."
        : status === "storage_warning"
          ? "The full permitted dataset or required media could not be stored. Stay connected until storage is available."
          : status === "lease_expired"
            ? "Pending work is retained, but organisational data remains locked until a successful online authorisation refresh."
            : "Connect and sign in once. The dashboard will prepare offline access automatically."

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={`${LABELS[status]}. View details`}
            className="h-auto rounded-full p-0"
            type="button"
            variant="ghost"
          />
        }
      >
        {badge}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[70dvh] w-96 max-w-[90vw] overflow-auto"
      >
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverHeader>
        {conflicts.map((conflict) => (
          <section
            className="grid gap-2 rounded-md border p-2"
            key={conflict.clientOperationId}
          >
            <p className="font-medium">
              {conflict.entityType} · {conflict.reason}
            </p>
            <div className="grid gap-1">
              <p className="text-xs font-medium">Your pending version</p>
              <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
                {JSON.stringify(conflict.local, null, 2)}
              </pre>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-medium">Current server version</p>
              <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
                {JSON.stringify(conflict.remote, null, 2)}
              </pre>
            </div>
          </section>
        ))}
        {operationsWithErrors.map((operation) => (
          <p
            className="rounded-md border p-2 text-xs"
            key={operation.clientOperationId}
          >
            {operation.kind}: {operation.lastError ?? "Sync failed"}
          </p>
        ))}
      </PopoverContent>
    </Popover>
  )
}
