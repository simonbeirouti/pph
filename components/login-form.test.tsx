import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loginAction } from "@/app/login/actions"
import { LoginForm } from "@/components/login-form"

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
}))

vi.mock("@/app/login/actions", () => ({
  loginAction: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe("LoginForm", () => {
  it("renders only the V1 credential fields", () => {
    render(<LoginForm />)

    expect(screen.getByRole("textbox", { name: "Email" })).toBeVisible()
    expect(screen.getByLabelText("Password")).toBeVisible()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled()
    expect(screen.queryByText(/Google|Sign up|Forgot/i)).not.toBeInTheDocument()
  })

  it("associates credential fields with submitted names", () => {
    render(<LoginForm />)

    expect(screen.getAllByLabelText("Email").at(-1)).toHaveAttribute(
      "name",
      "email"
    )
    expect(screen.getAllByLabelText("Password").at(-1)).toHaveAttribute(
      "name",
      "password"
    )
  })

  it("shows a safe inactive membership message", () => {
    render(<LoginForm inactive />)

    expect(screen.getByText(/access is unavailable/i)).toBeVisible()
    expect(screen.queryByText(/inactive employee/i)).not.toBeInTheDocument()
  })

  it("shows credential failures in a toast instead of inline", async () => {
    vi.mocked(loginAction).mockResolvedValue({
      message: "Unable to sign in with those credentials.",
      ok: false,
      values: { email: "owner@example.test" },
    })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(
      screen.getByRole("textbox", { name: "Email" }),
      "owner@example.test"
    )
    await user.type(screen.getByLabelText("Password"), "incorrect-password")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Unable to sign in with those credentials."
      )
    )
    expect(
      screen.queryByText("Unable to sign in with those credentials.")
    ).not.toBeInTheDocument()
  })
})
