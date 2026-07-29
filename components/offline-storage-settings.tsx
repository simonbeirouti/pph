"use client"

import { useEffect, useState } from "react"
import { DatabaseIcon, LogOutIcon, Trash2Icon } from "lucide-react"

import { logoutAction } from "@/app/dashboard/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  hasOfflineConsent,
  purgeOfflineData,
} from "@/lib/offline/storage"
import {
  getOfflineV2Identity,
  purgeOfflineV2Data,
  setOfflineLogoutPending,
} from "@/lib/offline-v2/storage"

export function OfflineStorageSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    void Promise.all([hasOfflineConsent(), getOfflineV2Identity()]).then(
      ([legacy, identity]) => setEnabled(legacy || Boolean(identity))
    )
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseIcon className="size-5" />
          Offline work
        </CardTitle>
        <CardDescription>
          {enabled
            ? "Your permitted dashboard data and pending work are stored on this device with a seven-day authorisation lease."
            : "Offline work is not stored in this browser."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          disabled={!enabled}
          onClick={() => {
            void Promise.all([
              purgeOfflineData(),
              purgeOfflineV2Data(),
            ]).then(() => setEnabled(false))
          }}
          variant="outline"
        >
          <Trash2Icon />
          Remove offline data
        </Button>
      </CardContent>
    </Card>
  )
}

export function OfflineAwareLogoutButton() {
  const [pending, setPending] = useState(false)
  return (
    <Button
      disabled={pending}
      onClick={() => {
        setPending(true)
        if (!navigator.onLine) {
          void (async () => {
            await setOfflineLogoutPending(true)
            await Promise.all([
              purgeOfflineData(),
              purgeOfflineV2Data({ preserveLogoutMarker: true }),
            ])
            window.location.replace("/offline?logged-out=1")
          })()
          return
        }
        void Promise.all([purgeOfflineData(), purgeOfflineV2Data()]).finally(
          () => logoutAction()
        )
      }}
      type="button"
      variant="outline"
    >
      <LogOutIcon />
      Log out
    </Button>
  )
}
