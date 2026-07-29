"use client"

import { BellIcon, BellOffIcon, LoaderCircleIcon } from "lucide-react"

import { usePushNotifications } from "@/components/push-notification-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function PushNotificationSettings() {
  const { busy, disable, enable, errorMessage, publicKey, state } =
    usePushNotifications()

  const descriptions = {
    checking: "Checking this browser…",
    denied: "Notifications are blocked in this browser's site settings.",
    subscribed: "This browser can notify you about work that affects you.",
    unsubscribed: "Enable notifications when you want updates on this device.",
    unsupported: publicKey
      ? "Push notifications are not supported by this browser."
      : "Push notifications are not configured for this environment.",
  }

  return (
    <Card aria-label="Push notifications" role="region">
      <CardHeader>
        <CardTitle>Push notifications</CardTitle>
        <CardDescription>{descriptions[state]}</CardDescription>
      </CardHeader>
      <CardContent>
        {errorMessage ? (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {state === "subscribed" ? (
          <Button
            disabled={busy}
            onClick={() => void disable()}
            variant="outline"
          >
            {busy ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <BellOffIcon />
            )}
            Disable on this browser
          </Button>
        ) : (
          <Button
            disabled={
              busy ||
              state === "checking" ||
              state === "denied" ||
              state === "unsupported"
            }
            onClick={() => void enable()}
          >
            {busy ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <BellIcon />
            )}
            Enable notifications
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
