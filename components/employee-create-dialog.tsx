"use client"

import { useState } from "react"
import { toast } from "sonner"

import { createEmployeeAction } from "@/app/dashboard/employees/actions"
import { EmployeeForm } from "@/components/employee-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function EmployeeCreateDialog({
  canChooseRole = false,
}: {
  canChooseRole?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Add employee
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
            <DialogDescription>
              Create the employee profile and send their secure invitation.
            </DialogDescription>
          </DialogHeader>
          <EmployeeForm
            action={createEmployeeAction}
            canChooseRole={canChooseRole}
            onSuccess={(state) => {
              setOpen(false)
              toast.success(state.message)
              state.warnings?.forEach((warning) => toast.warning(warning))
            }}
            showDestinationLink={false}
            showReturn={false}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
