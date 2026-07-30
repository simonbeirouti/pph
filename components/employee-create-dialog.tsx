"use client"

import { useState } from "react"
import { toast } from "sonner"

import { createEmployeeAction } from "@/app/dashboard/employees/actions"
import { EmployeeForm } from "@/components/employee-form"
import { useOfflineV2Actions } from "@/components/offline-v2-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"

export function EmployeeCreateDialog({
  canChooseRole = false,
}: {
  canChooseRole?: boolean
}) {
  const [open, setOpen] = useState(false)
  const mobile = useIsMobile()
  const offline = useOfflineV2Actions()
  const action = async (
    state: Parameters<typeof createEmployeeAction>[0],
    formData: FormData
  ) => {
    if (!offline.usesLocalRepository) return createEmployeeAction(state, formData)
    const localId = crypto.randomUUID()
    const temporaryId = -Date.now()
    const firstName = String(formData.get("firstName") ?? "")
    const lastName = String(formData.get("lastName") ?? "")
    const avatar = formData.get("avatar")
    const role = String(formData.get("role") ?? "employee") as
      | "employee"
      | "manager"
      | "owner"
    await offline.queue({
      ...(avatar instanceof File && avatar.size ? { blob: avatar } : {}),
      entityId: localId,
      entityType: "membership",
      kind: "membership.create",
      payload: {
        email: String(formData.get("email") ?? ""),
        firstName,
        jobTitle: String(formData.get("jobTitle") ?? ""),
        lastName,
        phone: String(formData.get("phone") ?? ""),
        role,
        temporaryId,
      },
      optimistic: (snapshot) => ({
        ...snapshot,
        people: snapshot.people
          ? {
              ...snapshot.people,
              employees: [
                {
                  avatarPath: null,
                  avatarUrl: null,
                  displayName: `${firstName} ${lastName}`.trim(),
                  email: String(formData.get("email") ?? ""),
                  firstName,
                  inviteDeliveryStatus: "pending",
                  inviteLastAttemptedAt: null,
                  jobTitle: String(formData.get("jobTitle") ?? ""),
                  lastName,
                  membershipId: temporaryId,
                  phone: String(formData.get("phone") ?? ""),
                  profileId: temporaryId,
                  role,
                  status: "invited",
                  userId: null,
                },
                ...snapshot.people.employees,
              ],
              jobSummaries: {
                ...snapshot.people.jobSummaries,
                [temporaryId]: { active: [], archived: [] },
              },
              shiftSummaries: {
                ...snapshot.people.shiftSummaries,
                [temporaryId]: { current: null, upcoming: [] },
              },
            }
          : null,
      }),
    })
    return {
      destinationId: temporaryId,
      message: "Team member saved; invitation queued.",
      ok: true,
    }
  }

  const form = (
    <EmployeeForm
      action={action}
      canChooseRole={canChooseRole}
      createLayout
      fullWidthSubmit
      onSuccess={(state) => {
        setOpen(false)
        toast.success(state.message)
        state.warnings?.forEach((warning) => toast.warning(warning))
      }}
      showDestinationLink={false}
      showReturn={false}
    />
  )

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Add employee
      </Button>
      {mobile ? (
        <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
          <DrawerContent className="[--drawer-content-max-height:calc(100dvh-1rem)]">
            <DrawerHeader>
              <DrawerTitle>Add employee</DrawerTitle>
              <DrawerDescription>
                Create the employee profile and send their secure invitation.
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4 pt-3">{form}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden sm:max-w-2xl">
            <DialogHeader className="shrink-0">
              <DialogTitle>Add employee</DialogTitle>
              <DialogDescription>
                Create the employee profile and send their secure invitation.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto pr-1">{form}</div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
