import { afterEach, describe, expect, it, vi } from "vitest"

import {
  JobEvidenceOptimizationError,
  optimizeJobEvidenceFile,
} from "@/lib/uploads/job-evidence-optimizer"

type WorkerMessage = {
  file: File
  mimeType: string
  originalSizeBytes: number
}

class ResultWorker {
  static blob = new Blob([new Uint8Array(400_000)], { type: "image/webp" })
  static messages: WorkerMessage[] = []

  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent<{ blob: Blob; ok: true }>) => void) | null =
    null

  postMessage(message: WorkerMessage) {
    ResultWorker.messages.push(message)
    queueMicrotask(() =>
      this.onmessage?.(
        new MessageEvent("message", {
          data: { blob: ResultWorker.blob, ok: true },
        })
      )
    )
  }

  terminate() {}
}

afterEach(() => {
  ResultWorker.blob = new Blob([new Uint8Array(400_000)], {
    type: "image/webp",
  })
  ResultWorker.messages = []
  vi.unstubAllGlobals()
})

describe("optimizeJobEvidenceFile", () => {
  it("skips common images at or below one MiB", async () => {
    const source = new File([new Uint8Array(1024)], "small.jpg", {
      type: "image/jpeg",
    })

    await expect(optimizeJobEvidenceFile(source)).resolves.toEqual({
      file: source,
      originalSizeBytes: source.size,
      outcome: "skipped",
      uploadSizeBytes: source.size,
    })
  })

  it("rejects oversized sources before starting a worker", async () => {
    vi.stubGlobal("Worker", ResultWorker)
    const source = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      "oversized.jpg",
      { type: "image/jpeg" }
    )

    await expect(optimizeJobEvidenceFile(source)).rejects.toMatchObject({
      code: "file_too_large",
    } satisfies Partial<JobEvidenceOptimizationError>)
    expect(ResultWorker.messages).toHaveLength(0)
  })

  it("returns a smaller WebP and removes the source extension", async () => {
    vi.stubGlobal("Worker", ResultWorker)
    const source = new File(
      [new Uint8Array(2 * 1024 * 1024)],
      "loading-bay.jpeg",
      { type: "image/jpeg" }
    )

    const result = await optimizeJobEvidenceFile(source)

    expect(result.outcome).toBe("optimized")
    expect(result.file.name).toBe("loading-bay.webp")
    expect(result.file.type).toBe("image/webp")
    expect(result.uploadSizeBytes).toBe(400_000)
    expect(ResultWorker.messages[0]).toMatchObject({
      mimeType: "image/jpeg",
      originalSizeBytes: source.size,
    })
  })

  it("always routes HEIC through conversion, including small files", async () => {
    vi.stubGlobal("Worker", ResultWorker)
    const source = new File([new Uint8Array(800_000)], "iphone.HEIC")

    const result = await optimizeJobEvidenceFile(source)

    expect(result.outcome).toBe("optimized")
    expect(result.file.type).toBe("image/webp")
    expect(ResultWorker.messages[0]?.mimeType).toBe("image/heic")
  })

  it("keeps the original when encoding would enlarge it", async () => {
    vi.stubGlobal("Worker", ResultWorker)
    const source = new File([new Uint8Array(2 * 1024 * 1024)], "photo.png", {
      type: "image/png",
    })
    ResultWorker.blob = new Blob([new Uint8Array(source.size + 1)], {
      type: "image/webp",
    })

    await expect(optimizeJobEvidenceFile(source)).resolves.toEqual({
      file: source,
      originalSizeBytes: source.size,
      outcome: "fallback",
      uploadSizeBytes: source.size,
    })
  })

  it("terminates optimization when aborted", async () => {
    class PendingWorker extends ResultWorker {
      override postMessage(message: WorkerMessage) {
        ResultWorker.messages.push(message)
      }
    }
    vi.stubGlobal("Worker", PendingWorker)
    const controller = new AbortController()
    const source = new File([new Uint8Array(2 * 1024 * 1024)], "photo.jpg", {
      type: "image/jpeg",
    })

    const pending = optimizeJobEvidenceFile(source, {
      signal: controller.signal,
    })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
  })
})
