import { describe, expect, it } from "vitest"

import {
  loginSchema,
  passwordSchema,
  recoveryEmailSchema,
  setPasswordSchema,
} from "@/lib/auth/validation"

describe("authentication validation", () => {
  it("normalises login email without changing the password", () => {
    expect(
      loginSchema.parse({
        email: " Owner@Example.Test ",
        password: "Password123!",
      })
    ).toEqual({
      email: "owner@example.test",
      password: "Password123!",
    })
  })

  it("normalises password recovery email", () => {
    expect(recoveryEmailSchema.parse({ email: "  USER@Example.COM " })).toEqual(
      {
        email: "user@example.com",
      }
    )
  })

  it("enforces the S02 password policy", () => {
    expect(passwordSchema.safeParse("password").success).toBe(false)
    expect(passwordSchema.safeParse("Password123!").success).toBe(true)
  })

  it("requires matching password confirmation", () => {
    const result = setPasswordSchema.safeParse({
      confirmPassword: "Password124!",
      password: "Password123!",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain(
        "Passwords do not match."
      )
    }
  })
})
