"use client"

import { useEffect, useRef, useState } from "react"
import { CameraIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
  const router = useRouter()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

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
            disabled={avatarUploading}
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
            disabled={avatarUploading}
            form={PROFILE_FORM_ID}
            name="avatar"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setAvatarPreview((current) => {
                if (current) URL.revokeObjectURL(current)
                return URL.createObjectURL(file)
              })
              const form = document.getElementById(PROFILE_FORM_ID)
              if (!(form instanceof HTMLFormElement)) return
              const formData = new FormData(form)
              formData.set("avatar", file)
              setAvatarUploading(true)
              try {
                const result = await action({ ok: false }, formData)
                if (result.ok) {
                  toast.success("Profile photo updated.")
                  setAvatarPreview((current) => {
                    if (current) URL.revokeObjectURL(current)
                    return null
                  })
                  router.refresh()
                } else {
                  toast.error(
                    result.errors?.avatar?.[0] ??
                      result.message ??
                      "Unable to update the profile photo."
                  )
                }
              } catch {
                toast.error("Unable to update the profile photo.")
              } finally {
                setAvatarUploading(false)
                if (avatarInputRef.current) avatarInputRef.current.value = ""
              }
            }}
            ref={avatarInputRef}
            tabIndex={-1}
            type="file"
          />
          <h1 className="truncate text-2xl font-semibold">
            {profile.displayName}
          </h1>
          {avatarUploading ? (
            <span className="text-sm text-muted-foreground" role="status">
              Uploading profile photo…
            </span>
          ) : null}
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
            formId={PROFILE_FORM_ID}
            includeAvatar={false}
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
