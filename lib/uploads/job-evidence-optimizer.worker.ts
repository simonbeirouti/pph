/// <reference lib="webworker" />

import {
  EVIDENCE_BITMAP_OPTIONS,
  findBestWebpCandidate,
} from "./job-evidence-optimizer-core"
import type { SupportedImageMimeType } from "./image"

type OptimizationRequest = {
  file: File
  mimeType: SupportedImageMimeType
  originalSizeBytes: number
}

type OptimizationResponse =
  | { blob: Blob; ok: true }
  | { message: string; ok: false }

const worker = self as unknown as DedicatedWorkerGlobalScope

worker.onmessage = async (event: MessageEvent<OptimizationRequest>) => {
  let bitmap: ImageBitmap | null = null
  let canvas: OffscreenCanvas | null = null
  let context: OffscreenCanvasRenderingContext2D | null = null
  let canvasHeight = 0
  let canvasWidth = 0

  try {
    if (
      event.data.mimeType === "image/heic" ||
      event.data.mimeType === "image/heif"
    ) {
      const { heicTo } = await import("heic-to/csp")
      bitmap = await heicTo({
        blob: event.data.file,
        options: EVIDENCE_BITMAP_OPTIONS,
        type: "bitmap",
      })
    } else {
      bitmap = await createImageBitmap(event.data.file, EVIDENCE_BITMAP_OPTIONS)
    }
    const candidate = await findBestWebpCandidate({
      encode: async ({ height, quality, width }) => {
        if (!canvas || width !== canvasWidth || height !== canvasHeight) {
          canvas = new OffscreenCanvas(width, height)
          context = canvas.getContext("2d")
          if (!context) throw new Error("Canvas is unavailable.")
          context.imageSmoothingEnabled = true
          context.imageSmoothingQuality = "high"
          context.drawImage(bitmap!, 0, 0, width, height)
          canvasHeight = height
          canvasWidth = width
        }
        return canvas.convertToBlob({ quality, type: "image/webp" })
      },
      height: bitmap.height,
      originalSizeBytes: event.data.originalSizeBytes,
      width: bitmap.width,
    })
    worker.postMessage({
      blob: candidate.blob,
      ok: true,
    } satisfies OptimizationResponse)
  } catch (error) {
    worker.postMessage({
      message: error instanceof Error ? error.message : "Optimization failed.",
      ok: false,
    } satisfies OptimizationResponse)
  } finally {
    bitmap?.close()
    const activeCanvas = canvas as OffscreenCanvas | null
    if (activeCanvas) {
      activeCanvas.height = 1
      activeCanvas.width = 1
    }
  }
}

export {}
