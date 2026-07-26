"use client"

import { useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
      className="relative"
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
      <CardHeader className="pr-12">
        <CardTitle
          className="flex items-center gap-2 text-base"
          id="install-app-title"
        >
          <Download aria-hidden="true" className="size-4" />
          Install Employee Ops
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3 text-sm">
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
          <Button onClick={install} size="sm">
            Install app
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
