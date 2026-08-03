import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ProfileScreen } from "@/components/profile-screen"
import type { EmployeeSummary } from "@/lib/employees/data"

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("@/components/profile-form-action", () => ({
  useOwnProfileFormAction: () => mocks.action,
}))
vi.mock("@/components/employee-avatar", () => ({
  EmployeeAvatar: () => <span>Avatar</span>,
}))
vi.mock("@/components/employee-form", () => ({
  EmployeeForm: ({ formId }: { formId: string }) => (
    <form id={formId}>
      <input name="firstName" value="Alex" readOnly />
      <input name="lastName" value="Employee" readOnly />
      <input name="phone" value="" readOnly />
      <input name="jobTitle" value="Operator" readOnly />
    </form>
  ),
}))
vi.mock("@/components/offline-storage-settings", () => ({
  OfflineAwareLogoutButton: () => null,
}))
vi.mock("@/components/push-notification-settings", () => ({
  PushNotificationSettings: () => null,
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: mocks.toastSuccess },
}))

const profile: EmployeeSummary = {
  avatarPath: null,
  avatarUrl: null,
  displayName: "Alex Employee",
  email: "alex@example.test",
  firstName: "Alex",
  inviteDeliveryStatus: "sent",
  inviteLastAttemptedAt: null,
  jobTitle: "Operator",
  lastName: "Employee",
  membershipId: 1103,
  phone: "",
  profileId: 1203,
  role: "employee",
  status: "active",
  userId: "00000000-0000-4000-8000-000000000002",
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("ProfileScreen", () => {
  it("uploads a selected profile photo immediately without a form save", async () => {
    const user = userEvent.setup()
    const file = new File(["avatar"], "avatar.png", { type: "image/png" })
    mocks.action.mockResolvedValue({ message: "Profile updated.", ok: true })
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:avatar")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

    render(<ProfileScreen profile={profile} />)
    await user.upload(screen.getByLabelText("Profile photo"), file)

    await waitFor(() => expect(mocks.action).toHaveBeenCalledOnce())
    const submitted = mocks.action.mock.calls[0]?.[1] as FormData
    expect(submitted.get("avatar")).toBe(file)
    expect(screen.queryByRole("button", { name: "Save profile" })).toBeNull()
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Profile photo updated.")
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
})
