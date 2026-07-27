import { describe, expect, it } from "vitest"

import {
  detectImageMimeType,
  mimeTypeForImageUpload,
} from "@/lib/uploads/image"

function isoImageHeader(brand: string) {
  return new Uint8Array([
    0,
    0,
    0,
    24,
    ...new TextEncoder().encode("ftyp"),
    ...new TextEncoder().encode(brand),
  ])
}

describe("job evidence image signatures", () => {
  it.each([
    [new Uint8Array([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"],
    [
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      "image/png",
    ],
    [new TextEncoder().encode("RIFF0000WEBP"), "image/webp"],
    [isoImageHeader("heic"), "image/heic"],
    [isoImageHeader("mif1"), "image/heif"],
  ])("detects a supported image from its bytes", (bytes, expected) => {
    expect(detectImageMimeType(bytes)).toBe(expected)
  })

  it("rejects extension-only and malformed content", () => {
    expect(
      detectImageMimeType(new TextEncoder().encode("not an image"))
    ).toBeNull()
    expect(detectImageMimeType(isoImageHeader("avif"))).toBeNull()
  })

  it("normalizes supported uploads and falls back to phone file extensions", () => {
    expect(mimeTypeForImageUpload({ name: "photo.HEIC", type: "" })).toBe(
      "image/heic"
    )
    expect(mimeTypeForImageUpload({ name: "photo.heif", type: "" })).toBe(
      "image/heif"
    )
    expect(
      mimeTypeForImageUpload({ name: "photo.jpg", type: "IMAGE/JPEG" })
    ).toBe("image/jpeg")
    expect(
      mimeTypeForImageUpload({ name: "photo.avif", type: "image/avif" })
    ).toBeNull()
  })
})
