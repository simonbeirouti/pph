"use client"

import { useCallback } from "react"

import { updateEmployeeAction } from "@/app/dashboard/employees/actions"
import { updateOwnProfileAction } from "@/app/dashboard/profile/actions"
import { useOfflineV2Actions } from "@/components/offline/offline-v2-actions"
import type { EmployeeSummary } from "@/lib/employees/data"
import {
  employeeProfileSchema,
  validateAvatar,
} from "@/lib/employees/validation"
import type { ActionState } from "@/lib/forms/action-state"

export async function parseProfileForm(formData: FormData) {
  const values = {
    firstName: String(formData.get("firstName") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  }
  const parsed = employeeProfileSchema.safeParse(values)
  const avatar = formData.get("avatar")
  const avatarFile = avatar instanceof File ? avatar : null
  const avatarResult = await validateAvatar(avatarFile)
  if (!parsed.success || avatarResult.error) {
    return {
      state: {
        errors: {
          ...parsed.error?.flatten().fieldErrors,
          ...(avatarResult.error ? { avatar: [avatarResult.error] } : {}),
        },
        message: "Check the highlighted fields.",
        ok: false,
        values,
      } satisfies ActionState,
      success: false as const,
    }
  }
  return {
    avatar: avatarFile && avatarFile.size ? avatarFile : undefined,
    success: true as const,
    values: parsed.data,
  }
}

export function useOwnProfileFormAction(profile: EmployeeSummary) {
  const offline = useOfflineV2Actions()
  return useCallback(
    async (state: ActionState, formData: FormData): Promise<ActionState> => {
      if (offline.mutationTransport === "server") {
        return updateOwnProfileAction(state, formData)
      }
      if (offline.mutationTransport === "unavailable") {
        return {
          message: "Reconnect before saving this profile.",
          ok: false,
        }
      }
      const input = await parseProfileForm(formData)
      if (!input.success) return input.state
      const queued = await offline.queue({
        ...(input.avatar ? { blob: input.avatar } : {}),
        entityId: profile.membershipId,
        entityType: "profile",
        expectedVersion: profile.profileVersion ?? null,
        kind: "profile.update",
        payload: input.values,
        optimistic: (snapshot) => ({
          ...snapshot,
          membership: {
            ...snapshot.membership,
            displayName:
              `${input.values.firstName} ${input.values.lastName}`.trim(),
          },
          profile: {
            ...snapshot.profile,
            ...input.values,
            displayName:
              `${input.values.firstName} ${input.values.lastName}`.trim(),
          },
        }),
      })
      return queued
        ? {
            message: offline.isOffline
              ? "Profile saved on this device."
              : "Profile update queued.",
            ok: true,
          }
        : { message: "Unable to save the profile offline.", ok: false }
    },
    [offline, profile.membershipId, profile.profileVersion]
  )
}

export function useEmployeeProfileFormAction(employee: EmployeeSummary) {
  const offline = useOfflineV2Actions()
  return useCallback(
    async (state: ActionState, formData: FormData): Promise<ActionState> => {
      if (offline.mutationTransport === "server") {
        return updateEmployeeAction(employee.membershipId, state, formData)
      }
      if (offline.mutationTransport === "unavailable") {
        return {
          message: "Reconnect before saving this employee.",
          ok: false,
        }
      }
      const input = await parseProfileForm(formData)
      if (!input.success) return input.state
      const queued = await offline.queue({
        ...(input.avatar ? { blob: input.avatar } : {}),
        entityId: employee.membershipId,
        entityType: "employee_profile",
        expectedVersion: employee.profileVersion ?? null,
        kind: "membership.update",
        payload: input.values,
        optimistic: (snapshot) => ({
          ...snapshot,
          people: snapshot.people
            ? {
                ...snapshot.people,
                employees: snapshot.people.employees.map((item) =>
                  item.membershipId === employee.membershipId
                    ? {
                        ...item,
                        ...input.values,
                        displayName:
                          `${input.values.firstName} ${input.values.lastName}`.trim(),
                      }
                    : item
                ),
              }
            : null,
        }),
      })
      return queued
        ? { message: "Employee saved on this device.", ok: true }
        : { message: "Unable to save the employee offline.", ok: false }
    },
    [
      employee.membershipId,
      employee.profileVersion,
      offline,
    ]
  )
}
