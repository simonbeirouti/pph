"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { resendEmployeeInvitationAction } from "@/app/dashboard/employees/actions"
import { Button } from "@/components/ui/button"
import { INITIAL_ACTION_STATE } from "@/lib/forms/action-state"

export function EmployeeInvitationAction({
  deliveryStatus,
  membershipId,
  status,
}: {
  deliveryStatus: "pending" | "sent" | "failed"
  membershipId: number
  status: "invited" | "active" | "inactive"
}) {
  const [currentDeliveryStatus, setCurrentDeliveryStatus] = useState(
    deliveryStatus
  )
  const [pending, startTransition] = useTransition()

  if (status !== "invited") return null

  const sendInvitation = () => {
    startTransition(async () => {
      const result = await resendEmployeeInvitationAction(
        membershipId,
        INITIAL_ACTION_STATE,
        new FormData()
      )
      if (result.invitation) setCurrentDeliveryStatus(result.invitation)
      if (result.ok) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    })
  }

  const label = pending
    ? "Sending invitation…"
    : currentDeliveryStatus === "sent"
      ? "Resend invitation"
      : currentDeliveryStatus === "failed"
        ? "Retry invitation"
        : "Send invitation"

  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={sendInvitation}
      type="button"
      variant="outline"
    >
      {label}
    </Button>
  )
}
