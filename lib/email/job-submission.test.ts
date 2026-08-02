import { describe, expect, it } from "vitest"

import { buildSubmissionEmail } from "@/lib/email/job-submission"

describe("job submission email", () => {
  it("includes review context without private evidence URLs", () => {
    const message = buildSubmissionEmail({
      employeeName: "Alex Employee",
      from: "jobs@example.test",
      idempotencyKey: "job-submitted/77/1101",
      jobTitle: "Inspect loading bay",
      minimumCompletionPhotos: 2,
      organisationName: "People People",
      recipientEmail: "owner@example.test",
      requiresCompletionNote: true,
      reviewUrl: "https://app.example.test/dashboard/jobs?job=1401",
      submittedAt: "2026-07-27T04:00:00.000Z",
    })

    expect(message.to).toEqual(["owner@example.test"])
    expect(message.idempotencyKey).toBe("job-submitted/77/1101")
    expect(message.subject).toContain("Inspect loading bay")
    expect(message.text).toContain("Alex Employee")
    expect(message.text).toContain("2 completion photos required")
    expect(message.text).toContain("/dashboard/jobs?job=1401")
    expect(message.html).not.toContain("job-evidence")
    expect(message.html).toContain("background-color: #f5f5f5")
    expect(message.html).toContain(
      'src="https://app.example.test/icons/logo-transparent.png"'
    )
    expect(message.html).toContain('bgcolor="#facc15"')
    expect(message.html).toContain("Ready for review")
    expect(message.html).toContain('alt="Pure Peninsula Honey"')
  })

  it("escapes user-controlled values in HTML", () => {
    const message = buildSubmissionEmail({
      employeeName: "<Alex>",
      from: "jobs@example.test",
      idempotencyKey: "key",
      jobTitle: "A & B",
      minimumCompletionPhotos: 0,
      organisationName: '"People"',
      recipientEmail: "owner@example.test",
      requiresCompletionNote: false,
      reviewUrl: "https://app.example.test/dashboard/jobs?job=1",
      submittedAt: "2026-07-27T04:00:00.000Z",
    })

    expect(message.html).toContain("&lt;Alex&gt;")
    expect(message.html).toContain("A &amp; B")
    expect(message.html).not.toContain("<Alex>")
  })
})
