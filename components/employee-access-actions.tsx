"use client"

import { useState, useTransition } from "react"
import { RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"

import {
  deleteInvitedEmployeeAction,
  employeeAccessAction,
  requestEmployeePasswordRecoveryAction,
} from "@/app/dashboard/employees/actions"
import { useOfflineV2Actions } from "@/components/offline-v2-actions"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  const offline = useOfflineV2Actions()
  const [currentStatus, setCurrentStatus] = useState(status)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [accessPending, startAccessTransition] = useTransition()
  const [resetPending, startResetTransition] = useTransition()
  const destructiveAction =
    currentStatus === "invited" ? "delete" : "deactivate"

  const changeAccess = (active: boolean) => {
    startAccessTransition(async () => {
      const formData = new FormData()
      formData.set("active", String(active))
      const queued = await offline.queue({
        entityId: membershipId,
        entityType: "membership",
        kind: "membership.access",
        payload: { active },
        optimistic: (snapshot) => ({
          ...snapshot,
          people: snapshot.people
            ? {
                ...snapshot.people,
                employees: snapshot.people.employees.map((employee) =>
                  employee.membershipId === membershipId
                    ? {
                        ...employee,
                        status: active ? "active" : "inactive",
                      }
                    : employee
                ),
              }
            : null,
        }),
      })
      const result = queued
        ? {
            membershipStatus: active
              ? ("active" as const)
              : ("inactive" as const),
            message: "Access change saved on this device.",
            ok: true,
          }
        : await employeeAccessAction(
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
    startAccessTransition(async () => {
      let result
      if (destructiveAction === "delete") {
        const queued = await offline.queue({
          entityId: membershipId,
          entityType: "membership",
          kind: "membership.delete_invited",
          optimistic: (snapshot) => ({
            ...snapshot,
            people: snapshot.people
              ? {
                  ...snapshot.people,
                  employees: snapshot.people.employees.filter(
                    (employee) => employee.membershipId !== membershipId
                  ),
                }
              : null,
          }),
        })
        result = queued
          ? { message: "Deletion saved on this device.", ok: true }
          : await deleteInvitedEmployeeAction(membershipId)
      } else {
        const formData = new FormData()
        formData.set("active", "false")
        const queued = await offline.queue({
          entityId: membershipId,
          entityType: "membership",
          kind: "membership.access",
          payload: { active: false },
          optimistic: (snapshot) => ({
            ...snapshot,
            people: snapshot.people
              ? {
                  ...snapshot.people,
                  employees: snapshot.people.employees.map((employee) =>
                    employee.membershipId === membershipId
                      ? { ...employee, status: "inactive" }
                      : employee
                  ),
                }
              : null,
          }),
        })
        result = queued
          ? {
              membershipStatus: "inactive" as const,
              message: "Access change saved on this device.",
              ok: true,
            }
          : await employeeAccessAction(
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

  const resetPassword = () => {
    startResetTransition(async () => {
      const result = await requestEmployeePasswordRecoveryAction(membershipId)
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    })
  }

  return (
    <>
      {currentStatus === "inactive" ? (
        <Button
          className="w-full"
          disabled={accessPending}
          onClick={() => changeAccess(true)}
          type="button"
        >
          {accessPending ? "Reactivating…" : "Reactivate access"}
        </Button>
      ) : currentStatus === "active" ? (
        <div className="grid grid-cols-5 gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={`Reset password for ${displayName}`}
                    disabled={resetPending}
                    onClick={resetPassword}
                    type="button"
                    variant="outline"
                  >
                    <RotateCcwIcon />
                  </Button>
                }
              />
              <TooltipContent>Reset password</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            className="col-span-4"
            disabled={accessPending}
            onClick={() => setConfirmOpen(true)}
            type="button"
            variant="destructive"
          >
            Deactivate access
          </Button>
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={accessPending}
          onClick={() => setConfirmOpen(true)}
          type="button"
          variant="destructive"
        >
          Delete employee
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
            <AlertDialogCancel disabled={accessPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={accessPending}
              onClick={confirmDestructiveAction}
              type="button"
              variant="destructive"
            >
              {accessPending
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
