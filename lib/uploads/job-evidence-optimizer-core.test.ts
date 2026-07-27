import { describe, expect, it, vi } from "vitest"

import {
  EVIDENCE_BITMAP_OPTIONS,
  EVIDENCE_MIN_LONG_EDGE,
  EVIDENCE_WEBP_QUALITIES,
  findBestWebpCandidate,
  imageDimensionTargets,
} from "@/lib/uploads/job-evidence-optimizer-core"

describe("job evidence optimizer core", () => {
  it("requests EXIF-aware orientation before drawing metadata-free pixels", () => {
    expect(EVIDENCE_BITMAP_OPTIONS).toEqual({
      imageOrientation: "from-image",
    })
  })

  it("caps the long edge at 2,048 pixels without upscaling", () => {
    expect(imageDimensionTargets(4032, 3024)[0]).toEqual({
      height: 1536,
      width: 2048,
    })
    expect(imageDimensionTargets(800, 600)).toEqual([
      { height: 600, width: 800 },
    ])
  })

  it("preserves portrait dimensions and does not resize below 1,280 pixels", () => {
    const targets = imageDimensionTargets(3024, 4032)

    expect(targets[0]).toEqual({ height: 2048, width: 1536 })
    expect(Math.max(...Object.values(targets.at(-1)!))).toBe(
      EVIDENCE_MIN_LONG_EDGE
    )
  })

  it("steps quality and resolution down until the half-size target is met", async () => {
    const encode = vi.fn(
      async ({
        height,
        quality,
        width,
      }: {
        height: number
        quality: number
        width: number
      }) => {
        const size = Math.round(width * height * quality * 0.7)
        return new Blob([new Uint8Array(size)], { type: "image/webp" })
      }
    )

    const result = await findBestWebpCandidate({
      encode,
      height: 3000,
      originalSizeBytes: 2_000_000,
      width: 4000,
    })

    expect(result.blob.size).toBeLessThanOrEqual(1_000_000)
    expect(encode).toHaveBeenCalledTimes(9)
    expect(encode).toHaveBeenLastCalledWith(
      expect.objectContaining({ quality: 0.61 })
    )
  })

  it("returns the smallest best-effort result at the quality and size floors", async () => {
    const result = await findBestWebpCandidate({
      encode: async ({ height, quality, width }) =>
        new Blob(
          [
            new Uint8Array(
              Math.round(1_000_000 + width * height * quality * 0.01)
            ),
          ],
          { type: "image/webp" }
        ),
      height: 3000,
      originalSizeBytes: 2_000_000,
      width: 4000,
    })

    expect(result.quality).toBe(EVIDENCE_WEBP_QUALITIES.at(-1))
    expect(Math.max(result.width, result.height)).toBe(EVIDENCE_MIN_LONG_EDGE)
  })

  it("aborts between encoding attempts", async () => {
    const controller = new AbortController()

    await expect(
      findBestWebpCandidate({
        encode: async () => {
          controller.abort()
          return new Blob([new Uint8Array(900_000)])
        },
        height: 3000,
        originalSizeBytes: 1_000_000,
        signal: controller.signal,
        width: 4000,
      })
    ).rejects.toMatchObject({ name: "AbortError" })
  })
})
