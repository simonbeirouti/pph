import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loginAction, requestPasswordRecoveryAction } from "@/app/login/actions"
import { LoginForm } from "@/components/login-form"

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("@/app/login/actions", () => ({
  loginAction: vi.fn(),
  requestPasswordRecoveryAction: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe("LoginForm", () => {
  it("renders credentials and password recovery without card styling", () => {
    render(<LoginForm />)

    expect(screen.getByRole("textbox", { name: "Email" })).toBeVisible()
    expect(screen.getByLabelText("Password")).toBeVisible()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Forgot password?" })
    ).toBeVisible()
    expect(screen.queryByText(/Google|Sign up/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Sign in" }).parentElement
    ).toHaveClass("text-center", "text-white")
  })

  it("sends recovery for the entered email and keeps the response generic", async () => {
    vi.mocked(requestPasswordRecoveryAction).mockResolvedValue({
      message:
        "If an account uses that email, a password reset link is on its way.",
      ok: true,
    })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(
      screen.getByRole("textbox", { name: "Email" }),
      "USER@Example.com"
    )
    await user.click(screen.getByRole("button", { name: "Forgot password?" }))

    await waitFor(() =>
      expect(requestPasswordRecoveryAction).toHaveBeenCalledOnce()
    )
    const form = vi.mocked(requestPasswordRecoveryAction).mock.calls[0][0]
    expect(form.get("email")).toBe("USER@Example.com")
    expect(toastSuccess).toHaveBeenCalledWith(
      "If an account uses that email, a password reset link is on its way."
    )
  })

  it("announces a completed password reset", () => {
    render(<LoginForm passwordReset />)
    expect(toastSuccess).toHaveBeenCalledWith(
      "Password reset. You can now sign in."
    )
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
