import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AuthScreen } from "@/components/auth/auth-screen"

describe("AuthScreen", () => {
  it("centres every authentication state at one shared width", () => {
    render(
      <AuthScreen>
        <p>Authentication content</p>
      </AuthScreen>
    )

    const content = screen.getByText("Authentication content")
    expect(content.parentElement).toHaveClass("w-full", "max-w-sm")
    expect(content.parentElement?.parentElement).toHaveClass(
      "items-center",
      "justify-center"
    )
  })
})
