"use client"

import { useState } from "react"
import { LogOutIcon } from "lucide-react"

import { logoutAction } from "@/app/dashboard/actions"
import { Button } from "@/components/ui/button"
import { useOptionalOfflineV2 } from "@/components/offline-v2-provider"
import { purgeOfflineData } from "@/lib/offline/storage"
import {
  purgeOfflineV2Data,
  setOfflineLogoutPending,
} from "@/lib/offline-v2/storage"

export function OfflineAwareLogoutButton() {
  const offline = useOptionalOfflineV2()
  const [pending, setPending] = useState(false)
  return (
    <Button
      disabled={pending}
      onClick={() => {
        setPending(true)
        if (
          !navigator.onLine ||
          offline?.networkReachability === "offline" ||
          offline?.networkReachability === "unreachable"
        ) {
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
