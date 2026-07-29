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

export function OfflineStorageSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    void hasOfflineConsent().then(setEnabled)
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
            ? "Assigned work and pending photos are stored in this browser for up to 24 hours."
            : "Offline work is not stored in this browser."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          disabled={!enabled}
          onClick={() => {
            void purgeOfflineData().then(() => setEnabled(false))
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
        void purgeOfflineData().finally(() => logoutAction())
      }}
      type="button"
      variant="outline"
    >
      <LogOutIcon />
      Log out
    </Button>
  )
}
