"use client"

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/browser"
import {
  parseRealtimeInvalidation,
  realtimeTopic,
  type RealtimeConnectionStatus,
  type RealtimeDomain,
  type RealtimeInvalidation,
} from "@/lib/realtime/events"

const REFRESH_DEBOUNCE_MS = 150
const DEGRADED_DELAY_MS = 5_000
const STALE_TAB_MS = 30_000

type InvalidationListener = (event: RealtimeInvalidation) => void

type RealtimeContextValue = {
  status: RealtimeConnectionStatus
  subscribe: (
    domains: readonly RealtimeDomain[],
    listener: InvalidationListener
  ) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function DashboardRealtimeProvider({
  children,
  membership,
}: {
  children: ReactNode
  membership: {
    membershipId: number
    organisationId: number
    role: "employee" | "manager" | "owner"
  }
}) {
  const router = useRouter()
  const { membershipId, organisationId, role } = membership
  const [supabase] = useState(createClient)
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  )
  const [status, setStatus] = useState<RealtimeConnectionStatus>("connecting")
  const listenersRef = useRef(
    new Map<InvalidationListener, ReadonlySet<RealtimeDomain>>()
  )
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const degradedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hiddenAtRef = useRef<number | null>(null)
  const subscribedOnceRef = useRef(false)

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      window.dispatchEvent(new Event("pph:offline-invalidate"))
      startTransition(() => router.refresh())
    }, REFRESH_DEBOUNCE_MS)
  }, [router])

  const markDisconnected = useCallback(() => {
    setStatus("connecting")
    if (degradedTimerRef.current) clearTimeout(degradedTimerRef.current)
    degradedTimerRef.current = setTimeout(() => {
      degradedTimerRef.current = null
      setStatus("degraded")
    }, DEGRADED_DELAY_MS)
  }, [])

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true)
    const handleOffline = () => {
      if (degradedTimerRef.current) {
        clearTimeout(degradedTimerRef.current)
        degradedTimerRef.current = null
      }
      setStatus("connecting")
      setBrowserOnline(false)
    }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!browserOnline) return

    let active = true
    const topic = realtimeTopic({ membershipId, organisationId, role })
    const channel = supabase
      .channel(topic, { config: { private: true } })
      .on<RealtimeInvalidation>(
        "broadcast",
        { event: "invalidate" },
        ({ payload }) => {
          const event = parseRealtimeInvalidation(payload)
          if (!event) return

          for (const [listener, domains] of listenersRef.current) {
            if (domains.has(event.domain)) listener(event)
          }
          scheduleRefresh()
        }
      )

    void supabase.realtime
      .setAuth()
      .then(() => {
        if (!active) return
        channel.subscribe((nextStatus) => {
          if (!active) return
          if (nextStatus === "SUBSCRIBED") {
            if (degradedTimerRef.current) {
              clearTimeout(degradedTimerRef.current)
              degradedTimerRef.current = null
            }
            setStatus("connected")
            if (subscribedOnceRef.current) scheduleRefresh()
            subscribedOnceRef.current = true
          } else {
            markDisconnected()
          }
        })
      })
      .catch(markDisconnected)

    return () => {
      active = false
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      if (degradedTimerRef.current) clearTimeout(degradedTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [
    markDisconnected,
    browserOnline,
    membershipId,
    organisationId,
    role,
    scheduleRefresh,
    supabase,
  ])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now()
        return
      }

      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      if (
        browserOnline &&
        (status !== "connected" ||
          (hiddenAt !== null && Date.now() - hiddenAt >= STALE_TAB_MS))
      ) {
        scheduleRefresh()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [browserOnline, scheduleRefresh, status])

  const subscribe = useCallback(
    (domains: readonly RealtimeDomain[], listener: InvalidationListener) => {
      listenersRef.current.set(listener, new Set(domains))
      return () => listenersRef.current.delete(listener)
    },
    []
  )
  const context = useMemo(() => ({ status, subscribe }), [status, subscribe])

  return (
    <RealtimeContext.Provider value={context}>
      {children}
      <span
        aria-hidden="true"
        className="sr-only"
        data-realtime-status={status}
      />
    </RealtimeContext.Provider>
  )
}

export function useRealtimeConnectionStatus() {
  return useRealtimeContext().status
}

export function useRealtimeInvalidations(
  domains: readonly RealtimeDomain[],
  listener: InvalidationListener
) {
  const { subscribe } = useRealtimeContext()
  const domainKey = domains.join("|")

  useEffect(
    () =>
      subscribe(
        domainKey ? (domainKey.split("|") as RealtimeDomain[]) : [],
        listener
      ),
    [domainKey, listener, subscribe]
  )
}

function useRealtimeContext() {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error("Realtime hooks require DashboardRealtimeProvider")
  }
  return context
}
