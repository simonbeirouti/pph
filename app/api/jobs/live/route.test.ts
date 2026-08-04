import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getLiveJobCards: vi.fn(),
  membership: null as { membershipId: number } | null,
}))

vi.mock("@/lib/auth/membership", () => ({
  getMembershipContext: () => mocks.membership,
}))
vi.mock("@/lib/jobs/data", () => ({
  getLiveJobCards: mocks.getLiveJobCards,
}))

import { GET } from "@/app/api/jobs/live/route"

function request(query: string) {
  return GET(new Request(`https://pph.test/api/jobs/live?${query}`))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.membership = { membershipId: 1101 }
  mocks.getLiveJobCards.mockResolvedValue({ jobs: [], removedIds: [] })
})

describe("GET /api/jobs/live", () => {
  it("returns a private role-scoped card batch", async () => {
    mocks.getLiveJobCards.mockResolvedValue({
      jobs: [{ id: 1401, status: "in_review" }],
      removedIds: [1402],
    })

    const response = await request("ids=1401,1402,1401&scope=team")

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(mocks.getLiveJobCards).toHaveBeenCalledWith([1401, 1402], "team")
    await expect(response.json()).resolves.toEqual({
      jobs: [{ id: 1401, status: "in_review" }],
      removedIds: [1402],
    })
  })

  it("rejects invalid or oversized batches", async () => {
    expect((await request("ids=nope&scope=team")).status).toBe(400)
    expect(
      (
        await request(
          `ids=${Array.from({ length: 51 }, (_, index) => index + 1).join(",")}&scope=my-work`
        )
      ).status
    ).toBe(400)
    expect(mocks.getLiveJobCards).not.toHaveBeenCalled()
  })

  it("requires an active membership", async () => {
    mocks.membership = null

    const response = await request("ids=1401&scope=team")

    expect(response.status).toBe(401)
    expect(mocks.getLiveJobCards).not.toHaveBeenCalled()
  })
})
