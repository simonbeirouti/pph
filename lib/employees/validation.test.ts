import { describe, expect, it } from "vitest"

import {
  detectImageMimeType,
  employeeSchema,
  MAX_AVATAR_BYTES,
  validateAvatar,
} from "@/lib/employees/validation"

describe("employee validation", () => {
  it("normalises case-insensitive employee email", () => {
    const employee = employeeSchema.parse({
      email: " New.Employee@Example.Test ",
      firstName: "New",
      jobTitle: "Operator",
      lastName: "Employee",
      phone: "0400 000 010",
    })
    expect(employee.email).toBe("new.employee@example.test")
  })

  it("detects supported image signatures", () => {
    expect(detectImageMimeType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(
      "image/jpeg"
    )
    expect(
      detectImageMimeType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])
      )
    ).toBe("image/png")
    expect(detectImageMimeType(new TextEncoder().encode("RIFF0000WEBP"))).toBe(
      "image/webp"
    )
  })

  it("rejects a spoofed declared image type", async () => {
    const file = new File(["not an image"], "avatar.png", {
      type: "image/png",
    })
    await expect(validateAvatar(file)).resolves.toEqual({
      error: "The file contents do not match its image type.",
    })
  })

  it("rejects avatars larger than 5 MB before reading content", async () => {
    const file = new File([new Uint8Array(MAX_AVATAR_BYTES + 1)], "large.jpg", {
      type: "image/jpeg",
    })
    await expect(validateAvatar(file)).resolves.toEqual({
      error: "Avatar images must be 5 MB or smaller.",
    })
  })
})
