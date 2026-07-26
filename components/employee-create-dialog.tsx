"use client"

import { createEmployeeAction } from "@/app/dashboard/employees/actions"
import { EmployeeForm } from "@/components/employee-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function EmployeeCreateDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" />}>Add employee</DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Create the employee profile and send their secure invitation.
          </DialogDescription>
        </DialogHeader>
        <EmployeeForm
          action={createEmployeeAction}
          showDestinationLink={false}
          showReturn={false}
        />
      </DialogContent>
    </Dialog>
  )
}
