import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"

vi.mock("@/app/reset-password/actions", () => ({
  resetPasswordAction: vi.fn(),
}))

afterEach(cleanup)

describe("ResetPasswordForm", () => {
  it("uses the centred cardless authentication treatment", () => {
    const { container } = render(<ResetPasswordForm />)

    const heading = screen.getByRole("heading", {
      name: "Reset your password",
    })
    expect(heading.parentElement).toHaveClass("text-center", "text-white")
    expect(
      container.querySelector('[data-slot="card"]')
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Password", { exact: true })).toBeVisible()
    expect(screen.getByLabelText("Confirm password")).toBeVisible()
  })
})
