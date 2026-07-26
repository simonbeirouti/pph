"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  deleteInvitedEmployeeAction,
  employeeAccessAction,
} from "@/app/dashboard/employees/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { INITIAL_ACTION_STATE } from "@/lib/forms/action-state"

export function EmployeeAccessActions({
  displayName,
  membershipId,
  onDeleted,
  status,
}: {
  displayName: string
  membershipId: number
  onDeleted?: () => void
  status: "invited" | "active" | "inactive"
}) {
  const [currentStatus, setCurrentStatus] = useState(status)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const destructiveAction =
    currentStatus === "invited" ? "delete" : "deactivate"

  const changeAccess = (active: boolean) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("active", String(active))
      const result = await employeeAccessAction(
        membershipId,
        INITIAL_ACTION_STATE,
        formData
      )
      if (result.membershipStatus) {
        setCurrentStatus(result.membershipStatus)
      }
      if (result.ok) {
        setConfirmOpen(false)
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    })
  }

  const confirmDestructiveAction = () => {
    startTransition(async () => {
      let result
      if (destructiveAction === "delete") {
        result = await deleteInvitedEmployeeAction(membershipId)
      } else {
        const formData = new FormData()
        formData.set("active", "false")
        result = await employeeAccessAction(
          membershipId,
          INITIAL_ACTION_STATE,
          formData
        )
      }

      if (result.ok) {
        setConfirmOpen(false)
        toast.success(result.message)
        if (destructiveAction === "delete") {
          onDeleted?.()
        } else if (result.membershipStatus) {
          setCurrentStatus(result.membershipStatus)
        }
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <>
      {currentStatus === "inactive" ? (
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => changeAccess(true)}
          type="button"
        >
          {pending ? "Reactivating…" : "Reactivate access"}
        </Button>
      ) : (
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
          type="button"
          variant="destructive"
        >
          {currentStatus === "invited"
            ? "Delete employee"
            : "Deactivate access"}
        </Button>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {destructiveAction === "delete"
                ? `Delete ${displayName}?`
                : `Deactivate ${displayName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {destructiveAction === "delete"
                ? "This permanently removes the employee profile and cancels their access before activation."
                : "This employee will no longer be able to access the application. You can reactivate them later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={confirmDestructiveAction}
              type="button"
              variant="destructive"
            >
              {pending
                ? destructiveAction === "delete"
                  ? "Deleting…"
                  : "Deactivating…"
                : destructiveAction === "delete"
                  ? "Delete employee"
                  : "Deactivate access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
