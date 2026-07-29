"use client"

import { BellIcon, BellOffIcon, LoaderCircleIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "@/app/dashboard/profile/notification-actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type PushState =
  | "checking"
  | "denied"
  | "subscribed"
  | "unsubscribed"
  | "unsupported"

function decodeApplicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

function serialiseSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON()
  return {
    endpoint: subscription.endpoint,
    keys: {
      auth: json.keys?.auth ?? "",
      p256dh: json.keys?.p256dh ?? "",
    },
    userAgent: navigator.userAgent,
  }
}

export function PushNotificationSettings({
  publicKey,
}: {
  publicKey: string
}) {
  const [state, setState] = useState<PushState>(
    publicKey ? "checking" : "unsupported"
  )
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let active = true
    if (
      !publicKey ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      queueMicrotask(() => {
        if (active) setState("unsupported")
      })
      return
    }
    if (Notification.permission === "denied") {
      queueMicrotask(() => {
        if (active) setState("denied")
      })
      return
    }
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active) setState(subscription ? "subscribed" : "unsubscribed")
      })
      .catch(() => {
        if (active) setState("unsupported")
      })
    return () => {
      active = false
    }
  }, [publicKey])

  async function enable() {
    setBusy(true)
    setErrorMessage("")
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "unsubscribed")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          applicationServerKey: decodeApplicationServerKey(publicKey),
          userVisibleOnly: true,
        }))
      const result = await subscribeToPushAction(serialiseSubscription(subscription))
      if (!result.ok) throw new Error(result.message)
      setState("subscribed")
      toast.success("Push notifications enabled on this browser.")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Push notifications could not be enabled."
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setErrorMessage("")
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        const result = await unsubscribeFromPushAction(endpoint)
        if (!result.ok) throw new Error(result.message)
        await subscription.unsubscribe()
      }
      setState("unsubscribed")
      toast.success("Push notifications disabled on this browser.")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Push notifications could not be disabled."
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  const descriptions: Record<PushState, string> = {
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
          <Button disabled={busy} onClick={() => void disable()} variant="outline">
            {busy ? <LoaderCircleIcon className="animate-spin" /> : <BellOffIcon />}
            Disable on this browser
          </Button>
        ) : (
          <Button
            disabled={busy || state === "checking" || state === "denied" || state === "unsupported"}
            onClick={() => void enable()}
          >
            {busy ? <LoaderCircleIcon className="animate-spin" /> : <BellIcon />}
            Enable notifications
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
