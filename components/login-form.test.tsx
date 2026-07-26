import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { LoginForm } from "@/components/login-form"

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
})
