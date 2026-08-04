import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  afterCallback: null as (() => Promise<void>) | null,
  deliver: vi.fn().mockResolvedValue("sent"),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/server", () => ({
  after: (callback: () => Promise<void>) => {
    mocks.afterCallback = callback
  },
}))
vi.mock("@/lib/auth/membership", () => ({
  requireActiveMembership: vi.fn(),
  requireAssignedWorker: () => ({
    membershipId: 1103,
    organisationId: 1001,
  }),
  requireOperations: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    let filters = 0
    const query = {
      eq: vi.fn(() => {
        filters += 1
        return filters === 2 ? Promise.resolve({ data: [{ id: 77 }] }) : query
      }),
      select: vi.fn(() => query),
    }
    return { from: vi.fn(() => query) }
  },
}))
vi.mock("@/lib/email/job-submission", () => ({
  deliverJobSubmissionEmail: mocks.deliver,
}))
vi.mock("@/lib/http/origin", () => ({
  getRequestOrigin: () => "https://pph.test",
}))

import { submitJobAction } from "@/app/dashboard/jobs/actions"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.afterCallback = null
  mocks.rpc.mockResolvedValue({
    data: [{ submission_update_id: 901 }],
    error: null,
  })
})

describe("submitJobAction", () => {
  it("returns after the commit and defers reviewer email delivery", async () => {
    await expect(submitJobAction(1401)).resolves.toEqual({
      message: "Job submitted for review.",
      ok: true,
    })

    expect(mocks.rpc).toHaveBeenCalledWith("submit_job", { p_job_id: 1401 })
    expect(mocks.deliver).not.toHaveBeenCalled()
    expect(mocks.afterCallback).not.toBeNull()

    await mocks.afterCallback?.()

    expect(mocks.deliver).toHaveBeenCalledWith(77, "https://pph.test")
  })
})
