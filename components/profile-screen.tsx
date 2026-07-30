"use client"

import { useEffect, useRef, useState } from "react"
import { CameraIcon } from "lucide-react"

import { EmployeeAvatar } from "@/components/employee-avatar"
import { EmployeeForm } from "@/components/employee-form"
import { OfflineAwareLogoutButton } from "@/components/offline-storage-settings"
import { useOwnProfileFormAction } from "@/components/profile-form-action"
import { PushNotificationSettings } from "@/components/push-notification-settings"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { EmployeeSummary } from "@/lib/employees/data"

const PROFILE_FORM_ID = "own-profile-form"

export function ProfileScreen({ profile }: { profile: EmployeeSummary }) {
  const action = useOwnProfileFormAction(profile)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarDirty, setAvatarDirty] = useState(false)

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    },
    [avatarPreview]
  )

  return (
    <div className="grid w-full max-w-7xl gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <button
            aria-label="Change profile photo"
            className="group relative shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => avatarInputRef.current?.click()}
            type="button"
          >
            <EmployeeAvatar
              className="size-16"
              name={profile.displayName}
              url={avatarPreview ?? profile.avatarUrl}
            />
            <span className="absolute right-0 bottom-0 grid size-6 place-items-center rounded-full border bg-popover shadow-sm transition-colors group-hover:bg-muted">
              <CameraIcon className="size-3.5" />
            </span>
          </button>
          <Input
            accept="image/jpeg,image/png,image/webp"
            aria-label="Profile photo"
            className="sr-only"
            form={PROFILE_FORM_ID}
            name="avatar"
            onChange={(event) => {
              const file = event.target.files?.[0]
              setAvatarDirty(Boolean(file))
              setAvatarPreview((current) => {
                if (current) URL.revokeObjectURL(current)
                return file ? URL.createObjectURL(file) : null
              })
            }}
            ref={avatarInputRef}
            tabIndex={-1}
            type="file"
          />
          <h1 className="truncate text-2xl font-semibold">
            {profile.displayName}
          </h1>
        </div>
        <OfflineAwareLogoutButton />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profile information</CardTitle>
          <CardDescription>
            Update the details shown to your organisation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeForm
            action={action}
            employee={profile}
            externalDirty={avatarDirty}
            formId={PROFILE_FORM_ID}
            includeAvatar={false}
            onSuccess={() => {
              setAvatarDirty(false)
              if (avatarInputRef.current) avatarInputRef.current.value = ""
            }}
            showExternalAvatarErrors
            showReturn={false}
            showSubmitWhenDirty
          />
        </CardContent>
      </Card>
      <PushNotificationSettings />
    </div>
  )
}
