import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  detail: null as { id: number; title: string } | null,
  membership: null as { membershipId: number } | null,
}))

vi.mock("@/lib/auth/membership", () => ({
  getMembershipContext: () => mocks.membership,
}))
vi.mock("@/lib/jobs/data", () => ({
  getJobDetail: (jobId: number) =>
    mocks.detail?.id === jobId ? mocks.detail : null,
}))

import { GET } from "@/app/api/jobs/[jobId]/route"

function request(jobId: string) {
  return GET(new Request(`https://pph.test/api/jobs/${jobId}`), {
    params: Promise.resolve({ jobId }),
  })
}

describe("GET /api/jobs/[jobId]", () => {
  it("returns an authorised job detail with private no-store caching", async () => {
    mocks.membership = { membershipId: 1101 }
    mocks.detail = { id: 1401, title: "Prepared job" }

    const response = await request("1401")

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("Vary")).toBe("Cookie")
    await expect(response.json()).resolves.toEqual(mocks.detail)
  })

  it("returns 404 without exposing inaccessible or missing jobs", async () => {
    mocks.membership = { membershipId: 1101 }
    mocks.detail = null

    expect((await request("1401")).status).toBe(404)
    expect((await request("not-a-job")).status).toBe(404)
  })

  it("requires an active authenticated membership", async () => {
    mocks.membership = null
    mocks.detail = { id: 1401, title: "Prepared job" }

    const response = await request("1401")

    expect(response.status).toBe(401)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })
})
