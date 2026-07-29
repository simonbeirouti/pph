import { describe, expect, it } from "vitest"

import {
  restoreOfflineEvidenceFile,
  validateOfflineEvidenceMetadata,
} from "@/lib/offline-v2/evidence-upload"

describe("offline evidence upload preparation", () => {
  it("restores the validated MIME type after IndexedDB loses blob metadata", () => {
    const blob = new Blob(["image bytes"])
    const file = restoreOfflineEvidenceFile(blob, {
      clientOperationId: "8c49cf41-a94f-4a74-bbc8-644f8b799716",
      extension: "webp",
      mimeType: "image/webp",
    })

    expect(file).not.toBeNull()
    expect(file?.name).toBe(
      "8c49cf41-a94f-4a74-bbc8-644f8b799716.webp"
    )
    expect(file?.size).toBe(blob.size)
    expect(file?.type).toBe("image/webp")
  })

  it("rejects mismatched and unsupported MIME metadata", () => {
    expect(
      validateOfflineEvidenceMetadata({
        extension: "jpg",
        mimeType: "image/png",
      })
    ).toBeNull()
    expect(
      validateOfflineEvidenceMetadata({
        extension: "svg",
        mimeType: "image/svg+xml",
      })
    ).toBeNull()
  })
})
