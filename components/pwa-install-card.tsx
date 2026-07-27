"use client"

import { useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"

export const PWA_INSTALL_DISMISSAL_KEY =
  "employee-operations:pwa-install-guidance:v1"

type InstallChoice = {
  outcome: "accepted" | "dismissed"
  platform: string
}

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<InstallChoice>
}

declare global {
  interface Navigator {
    standalone?: boolean
  }

  interface WindowEventMap {
    appinstalled: Event
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

function readDismissed() {
  try {
    return localStorage.getItem(PWA_INSTALL_DISMISSAL_KEY) === "dismissed"
  } catch {
    return false
  }
}

function saveDismissed() {
  try {
    localStorage.setItem(PWA_INSTALL_DISMISSAL_KEY, "dismissed")
  } catch {
    // Installation guidance remains dismissible for the current page.
  }
}

export function PwaInstallCard() {
  const [ready, setReady] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [ios, setIos] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [reminding, setReminding] = useState(false)
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    let cancelled = false
    const displayMode = window.matchMedia("(display-mode: standalone)")
    const updateStandalone = () => {
      setStandalone(displayMode.matches || navigator.standalone === true)
    }
    const captureInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const handleInstalled = () => {
      setStandalone(true)
      setInstallPrompt(null)
    }

    displayMode.addEventListener("change", updateStandalone)
    window.addEventListener("beforeinstallprompt", captureInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)
    queueMicrotask(() => {
      if (cancelled) return
      setIos(isIosDevice())
      setDismissed(readDismissed())
      updateStandalone()
      setReady(true)
    })

    return () => {
      cancelled = true
      displayMode.removeEventListener("change", updateStandalone)
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

  useEffect(() => {
    if (!ready || standalone || dismissed) return

    let reminderTimeout: ReturnType<typeof setTimeout> | undefined
    const reminderInterval = setInterval(() => {
      setReminding(true)
      reminderTimeout = setTimeout(() => setReminding(false), 1_000)
    }, 30_000)

    return () => {
      clearInterval(reminderInterval)
      if (reminderTimeout) clearTimeout(reminderTimeout)
    }
  }, [dismissed, ready, standalone])

  if (!ready || standalone || dismissed) return null

  const dismiss = () => {
    saveDismissed()
    setDismissed(true)
  }

  const install = async () => {
    if (!installPrompt) return

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    if (choice.outcome === "accepted") setStandalone(true)
  }

  return (
    <Card
      aria-labelledby="install-app-title"
      className={`fixed inset-x-4 bottom-4 z-40 mx-auto w-auto max-w-md shadow-lg sm:left-auto sm:mx-0 sm:w-full ${
        reminding ? "motion-safe:animate-bounce" : ""
      }`}
      role="region"
    >
      <Button
        aria-label="Dismiss install guidance"
        className="absolute top-3 right-3"
        onClick={dismiss}
        size="icon-sm"
        variant="ghost"
      >
        <X aria-hidden="true" />
      </Button>
      <CardContent className="grid grid-cols-[auto_1fr] items-start gap-4 text-left text-sm">
        <Download
          aria-hidden="true"
          className="size-9 shrink-0 self-center text-foreground"
          strokeWidth={1.75}
        />
        <div className="flex min-w-0 flex-col items-start gap-2">
          <CardTitle className="pr-8 text-base" id="install-app-title">
            Install Employee Ops
          </CardTitle>
          {ios ? (
            <p className="text-muted-foreground">
              Tap Share <Share aria-hidden="true" className="inline size-4" />,
              then choose Add to Home Screen.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Install this dashboard from your browser menu for app-like access
              from this device.
            </p>
          )}
          {installPrompt ? (
            <Button className="mt-1" onClick={install} size="sm">
              Install app
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
