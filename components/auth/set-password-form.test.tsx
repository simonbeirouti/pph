import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SetPasswordForm } from "@/components/auth/set-password-form"

vi.mock("@/app/set-password/actions", () => ({
  setPasswordAction: vi.fn(),
}))

afterEach(cleanup)

describe("SetPasswordForm", () => {
  it("uses the centred cardless authentication treatment", () => {
    const { container } = render(
      <SetPasswordForm email="worker@example.test" />
    )

    const heading = screen.getByRole("heading", {
      name: "Set your password",
    })
    expect(heading.parentElement).toHaveClass("text-center", "text-white")
    expect(
      container.querySelector('[data-slot="card"]')
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Password", { exact: true })).toBeVisible()
    expect(screen.getByLabelText("Confirm password")).toBeVisible()
  })
})
