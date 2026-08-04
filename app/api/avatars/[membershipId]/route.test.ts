import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  avatar: new Blob(["avatar"], { type: "image/png" }) as Blob | null,
  avatarError: null as Error | null,
  membership: { membershipId: 1101 } as { membershipId: number } | null,
  profile: { avatar_path: "1001/1101/avatar.png" } as {
    avatar_path: string | null
  } | null,
  profileError: null as Error | null,
}))

const maybeSingle = vi.fn(async () => ({
  data: mocks.profile,
  error: mocks.profileError,
}))
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const download = vi.fn(async () => ({
  data: mocks.avatar,
  error: mocks.avatarError,
}))
const fromStorage = vi.fn(() => ({ download }))

vi.mock("@/lib/auth/membership", () => ({
  getMembershipContext: () => mocks.membership,
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({ select }),
    storage: { from: fromStorage },
  }),
}))

import { GET } from "@/app/api/avatars/[membershipId]/route"

function request(membershipId: string) {
  return GET(new Request(`https://pph.test/api/avatars/${membershipId}`), {
    params: Promise.resolve({ membershipId }),
  })
}

describe("GET /api/avatars/[membershipId]", () => {
  beforeEach(() => {
    mocks.avatar = new Blob(["avatar"], { type: "image/png" })
    mocks.avatarError = null
    mocks.membership = { membershipId: 1101 }
    mocks.profile = { avatar_path: "1001/1101/avatar.png" }
    mocks.profileError = null
    vi.clearAllMocks()
  })

  it("streams an authorised private avatar without an expiring URL", async () => {
    const response = await request("1101")

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect(response.headers.get("Vary")).toBe("Cookie")
    expect(eq).toHaveBeenCalledWith("membership_id", 1101)
    expect(download).toHaveBeenCalledWith("1001/1101/avatar.png")
    await expect(response.text()).resolves.toBe("avatar")
  })

  it("requires an active authenticated membership", async () => {
    mocks.membership = null

    const response = await request("1101")

    expect(response.status).toBe(401)
    expect(select).not.toHaveBeenCalled()
  })

  it("does not expose missing or inaccessible profiles and objects", async () => {
    mocks.profile = null
    expect((await request("1101")).status).toBe(404)

    mocks.profile = { avatar_path: "1001/1101/avatar.png" }
    mocks.avatarError = new Error("forbidden")
    expect((await request("1101")).status).toBe(404)
    expect((await request("not-an-id")).status).toBe(404)
  })
})
