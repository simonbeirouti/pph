import { describe, expect, it } from "vitest"

import { parseProfileForm } from "@/components/profile/profile-form-action"

describe("shared profile form validation", () => {
  it("normalises valid fields before either transport is selected", async () => {
    const formData = new FormData()
    formData.set("firstName", "  Ada ")
    formData.set("lastName", " Lovelace  ")
    formData.set("jobTitle", " Engineer ")
    formData.set("phone", " +61 400 000 000 ")

    await expect(parseProfileForm(formData)).resolves.toMatchObject({
      success: true,
      values: {
        firstName: "Ada",
        jobTitle: "Engineer",
        lastName: "Lovelace",
        phone: "+61 400 000 000",
      },
    })
  })

  it("returns shared field errors before either transport is selected", async () => {
    const formData = new FormData()
    formData.set("firstName", "")
    formData.set("lastName", "")
    formData.set("jobTitle", "")
    formData.set("phone", "")

    const result = await parseProfileForm(formData)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.state.errors).toMatchObject({
        firstName: ["Enter a first name."],
        jobTitle: ["Enter a job title."],
        lastName: ["Enter a last name."],
        phone: ["Enter a phone number."],
      })
    }
  })
})
