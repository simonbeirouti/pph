"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  permission: NotificationPermission | "unsupported"
  publicKey: string
  state: PushNotificationState
}

const PushNotificationContext =
  createContext<PushNotificationContextValue | null>(null)

const BLOCKED_MESSAGE =
  "Notifications are still blocked. Allow them in this site's browser settings, then try again."

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
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported")
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let active = true

    const checkPermission = async () => {
      if (!navigator.onLine) {
        if (active) setState("unsubscribed")
        return
      }
      if (!pushIsSupported(publicKey)) {
        if (active) {
          setPermission("unsupported")
          setState("unsupported")
        }
        return
      }
      const currentPermission = Notification.permission
      if (active) setPermission(currentPermission)
      if (currentPermission === "denied") {
        if (active) {
          setErrorMessage("")
          setState("denied")
        }
        return
      }
      if (currentPermission === "granted") {
        try {
          const registration = await navigator.serviceWorker.ready
          const subscription = await registration.pushManager.getSubscription()
          if (active) {
            setErrorMessage("")
            setState(subscription ? "subscribed" : "unsubscribed")
          }
        } catch {
          if (active) setState("unsupported")
        }
        return
      }

      if (active) {
        setErrorMessage("")
        setState("unsubscribed")
      }
    }

    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkPermission()
    }

    void checkPermission()
    window.addEventListener("focus", checkPermission)
    document.addEventListener("visibilitychange", checkWhenVisible)
    return () => {
      active = false
      window.removeEventListener("focus", checkPermission)
      document.removeEventListener("visibilitychange", checkWhenVisible)
    }
  }, [publicKey])

  const enable = useCallback(async () => {
    setBusy(true)
    setErrorMessage("")
    try {
      if (!navigator.onLine) {
        throw new Error("Reconnect to change push notification settings.")
      }
      if (!pushIsSupported(publicKey)) {
        setPermission("unsupported")
        setState("unsupported")
        return
      }
      const requestedPermission = await Notification.requestPermission()
      setPermission(requestedPermission)
      if (requestedPermission !== "granted") {
        setState(requestedPermission === "denied" ? "denied" : "unsubscribed")
        if (requestedPermission === "denied") {
          setErrorMessage(BLOCKED_MESSAGE)
          toast.error(BLOCKED_MESSAGE)
        }
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
      if (!navigator.onLine) {
        throw new Error("Reconnect to change push notification settings.")
      }
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
      permission,
      publicKey,
      state,
    }),
    [busy, disable, enable, errorMessage, permission, publicKey, state]
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
