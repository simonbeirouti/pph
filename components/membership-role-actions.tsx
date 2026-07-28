"use client"

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import { changeMembershipRoleAction } from "@/app/dashboard/employees/actions"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ActionState } from "@/lib/forms/action-state"

type MembershipRole = "owner" | "manager" | "employee"

const ROLE_LABELS: Record<MembershipRole, string> = {
  employee: "Employee",
  manager: "Manager",
  owner: "Owner",
}

type EmployeeEditContext = {
  displayName: string
  markProfileDirty: () => void
  pending: boolean
  profileDirty: boolean
  registerProfileSave: (
    saveProfile: (() => Promise<ActionState>) | null
  ) => void
  role: MembershipRole
  saveChanges: () => void
  savedRole: MembershipRole
  setRole: (role: MembershipRole) => void
}

const EditContext = createContext<EmployeeEditContext | null>(null)

export function useEmployeeEdit() {
  const context = useContext(EditContext)
  if (!context) throw new Error("Employee edit controls require EmployeeEditor.")
  return context
}

export function EmployeeEditor({
  children,
  currentRole,
  displayName,
  membershipId,
}: {
  children: ReactNode
  currentRole: MembershipRole
  displayName: string
  membershipId: number
}) {
  const [profileDirty, setProfileDirty] = useState(false)
  const [role, setRole] = useState<MembershipRole>(currentRole)
  const [savedRole, setSavedRole] = useState<MembershipRole>(currentRole)
  const [pending, startTransition] = useTransition()
  const profileSaveRef = useRef<(() => Promise<ActionState>) | null>(null)

  const markProfileDirty = useCallback(() => setProfileDirty(true), [])
  const registerProfileSave = useCallback(
    (saveProfile: (() => Promise<ActionState>) | null) => {
      profileSaveRef.current = saveProfile
    },
    []
  )

  const saveChanges = () => {
    if (pending || (!profileDirty && role === savedRole)) return

    startTransition(async () => {
      const savingProfile = profileDirty
      const savingRole = role !== savedRole
      let profileResult: ActionState | null = null
      let roleResult: ActionState | null = null

      if (savingProfile) {
        profileResult = profileSaveRef.current
          ? await profileSaveRef.current()
          : { message: "The employee form is unavailable.", ok: false }
        if (!profileResult.ok) {
          toast.error(profileResult.message ?? "Unable to save employee changes.")
          return
        }
        setProfileDirty(false)
      }

      if (savingRole) {
        roleResult = await changeMembershipRoleAction(membershipId, role)
        if (!roleResult.ok) {
          setRole(savedRole)
          toast.error(roleResult.message)
          return
        }
        setSavedRole(role)
      }

      profileResult?.warnings?.forEach((warning) => toast.warning(warning))
      toast.success(
        savingProfile && savingRole
          ? "Employee information and role updated."
          : (profileResult?.message ??
              roleResult?.message ??
              "Employee changes saved.")
      )
    })
  }

  return (
    <EditContext.Provider
      value={{
        displayName,
        markProfileDirty,
        pending,
        profileDirty,
        registerProfileSave,
        role,
        saveChanges,
        savedRole,
        setRole,
      }}
    >
      {children}
    </EditContext.Provider>
  )
}

export function MembershipRoleSelector() {
  const { displayName, pending, role, setRole } = useEmployeeEdit()

  return (
    <div className="w-full pt-3">
      <Select
        disabled={pending}
        onValueChange={(value) => setRole(value as MembershipRole)}
        value={role}
      >
        <SelectTrigger
          aria-label={`Role for ${displayName}`}
          className="w-full *:data-[slot=select-value]:justify-center *:data-[slot=select-value]:text-center"
        >
          <SelectValue>{ROLE_LABELS[role]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="employee">Employee</SelectItem>
          <SelectItem value="manager">Manager</SelectItem>
          <SelectItem value="owner">Owner</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export function EmployeeSaveAction() {
  const { pending, profileDirty, role, saveChanges, savedRole } =
    useEmployeeEdit()

  return profileDirty || role !== savedRole ? (
    <Button disabled={pending} onClick={saveChanges} type="button">
      {pending ? "Saving…" : "Save changes"}
    </Button>
  ) : null
}
