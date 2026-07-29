"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import {
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "@/app/dashboard/profile/notification-actions"

export type PushNotificationState =
  "checking" | "denied" | "subscribed" | "unsubscribed" | "unsupported"

type PushNotificationContextValue = {
  busy: boolean
  disable: () => Promise<void>
  enable: () => Promise<void>
  errorMessage: string
  publicKey: string
  state: PushNotificationState
}

const PushNotificationContext =
  createContext<PushNotificationContextValue | null>(null)

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

function pushIsSupported(publicKey: string) {
  return Boolean(
    publicKey &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

async function createAndPersistSubscription(publicKey: string) {
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      applicationServerKey: decodeApplicationServerKey(publicKey),
      userVisibleOnly: true,
    }))
  const result = await subscribeToPushAction(
    serialiseSubscription(subscription)
  )
  if (!result.ok) throw new Error(result.message)
}

export function PushNotificationProvider({
  children,
  publicKey,
}: {
  children: ReactNode
  publicKey: string
}) {
  const [state, setState] = useState<PushNotificationState>(
    publicKey ? "checking" : "unsupported"
  )
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const launchCheckStarted = useRef(false)

  useEffect(() => {
    if (launchCheckStarted.current) return
    launchCheckStarted.current = true
    let active = true

    const checkOnLaunch = async () => {
      if (!pushIsSupported(publicKey)) {
        if (active) setState("unsupported")
        return
      }
      if (Notification.permission === "denied") {
        if (active) setState("denied")
        return
      }
      if (Notification.permission === "granted") {
        try {
          const registration = await navigator.serviceWorker.ready
          const subscription = await registration.pushManager.getSubscription()
          if (active) setState(subscription ? "subscribed" : "unsubscribed")
        } catch {
          if (active) setState("unsupported")
        }
        return
      }

      if (active) setBusy(true)
      try {
        const permission = await Notification.requestPermission()
        if (!active) return
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "unsubscribed")
          return
        }
        await createAndPersistSubscription(publicKey)
        if (active) setState("subscribed")
      } catch (error) {
        if (!active) return
        setState("unsubscribed")
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Push notifications could not be enabled."
        )
      } finally {
        if (active) setBusy(false)
      }
    }

    void checkOnLaunch()
    return () => {
      active = false
    }
  }, [publicKey])

  const enable = useCallback(async () => {
    setBusy(true)
    setErrorMessage("")
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "unsubscribed")
        return
      }
      await createAndPersistSubscription(publicKey)
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
  }, [publicKey])

  const disable = useCallback(async () => {
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
  }, [])

  const value = useMemo<PushNotificationContextValue>(
    () => ({
      busy,
      disable,
      enable,
      errorMessage,
      publicKey,
      state,
    }),
    [busy, disable, enable, errorMessage, publicKey, state]
  )

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  )
}

export function usePushNotifications() {
  const context = useContext(PushNotificationContext)
  if (!context) {
    throw new Error(
      "usePushNotifications must be used inside PushNotificationProvider"
    )
  }
  return context
}
