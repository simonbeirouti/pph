"use client"

import { BellIcon, LoaderCircleIcon } from "lucide-react"

import { useOptionalOfflineV2 } from "@/components/offline/offline-v2-provider"
import { usePushNotifications } from "@/components/notifications/push-notification-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"

export function PushNotificationPrompt() {
  const offline = useOptionalOfflineV2()
  const { busy, enable, permission, state } = usePushNotifications()
  const connected =
    offline?.networkReachability !== "offline" &&
    offline?.networkReachability !== "unreachable"

  if (state !== "unsubscribed" || permission !== "default" || !connected) {
    return null
  }

  return (
    <Card
      aria-labelledby="notification-prompt-title"
      className="mb-4 shrink-0"
      role="region"
    >
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <BellIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="grid gap-1">
            <CardTitle className="text-base" id="notification-prompt-title">
              Turn on notifications
            </CardTitle>
            <CardDescription>
              Get updates when work, rosters, or reviews need your attention.
            </CardDescription>
          </div>
        </div>
        <Button
          className="shrink-0 sm:self-center"
          disabled={busy}
          onClick={() => void enable()}
        >
          {busy ? <LoaderCircleIcon className="animate-spin" /> : <BellIcon />}
          Enable notifications
        </Button>
      </CardContent>
    </Card>
  )
}
