"use client"

import {
  EVIDENCE_BITMAP_OPTIONS,
  EVIDENCE_MAX_SOURCE_BYTES,
  EVIDENCE_OPTIMIZATION_THRESHOLD_BYTES,
  findBestWebpCandidate,
  isAbortError,
  throwIfAborted,
} from "@/lib/uploads/job-evidence-optimizer-core"
import {
  mimeTypeForImageUpload,
  type SupportedImageMimeType,
} from "@/lib/uploads/image"

export type JobEvidenceOptimizationResult = {
  file: File
  originalSizeBytes: number
  outcome: "fallback" | "optimized" | "skipped"
  uploadSizeBytes: number
}

type WorkerResponse = { blob: Blob; ok: true } | { message: string; ok: false }

export class JobEvidenceOptimizationError extends Error {
  constructor(
    message: string,
    readonly code: "file_too_large" | "unsupported_file"
  ) {
    super(message)
    this.name = "JobEvidenceOptimizationError"
  }
}

function isPhoneNativeMimeType(mimeType: SupportedImageMimeType) {
  return mimeType === "image/heic" || mimeType === "image/heif"
}

function optimizedFileName(name: string) {
  const basename = name.replace(/\.[^.]+$/u, "") || "job-evidence"
  return `${basename}.webp`
}

async function decodePhoneNativeImage(file: File, signal?: AbortSignal) {
  throwIfAborted(signal)
  const { heicTo } = await import("heic-to/csp")
  throwIfAborted(signal)
  const bitmap = await heicTo({
    blob: file,
    options: EVIDENCE_BITMAP_OPTIONS,
    type: "bitmap",
  })
  throwIfAborted(signal)
  return bitmap
}

function optimizeWithWorker(file: File, signal?: AbortSignal) {
  return new Promise<Blob>((resolve, reject) => {
    throwIfAborted(signal)
    const worker = new Worker(
      new URL("./job-evidence-optimizer.worker.ts", import.meta.url),
      { name: "job-evidence-optimizer", type: "module" }
    )

    const finish = () => {
      signal?.removeEventListener("abort", abort)
      worker.terminate()
    }
    const abort = () => {
      finish()
      reject(new DOMException("Aborted", "AbortError"))
    }

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      finish()
      if (event.data.ok) resolve(event.data.blob)
      else reject(new Error(event.data.message))
    }
    worker.onerror = (event) => {
      finish()
      reject(new Error(event.message || "The optimization worker failed."))
    }
    signal?.addEventListener("abort", abort, { once: true })
    worker.postMessage({
      file,
      mimeType: mimeTypeForImageUpload(file),
      originalSizeBytes: file.size,
    })
  })
}

async function optimizeOnMainThread(
  file: File,
  mimeType: SupportedImageMimeType,
  signal?: AbortSignal
) {
  let bitmap: ImageBitmap | null = null
  let canvas: HTMLCanvasElement | null = null
  let context: CanvasRenderingContext2D | null = null
  let canvasHeight = 0
  let canvasWidth = 0

  try {
    bitmap = isPhoneNativeMimeType(mimeType)
      ? await decodePhoneNativeImage(file, signal)
      : await createImageBitmap(file, EVIDENCE_BITMAP_OPTIONS)
    throwIfAborted(signal)

    const candidate = await findBestWebpCandidate({
      encode: ({ height, quality, width }) =>
        new Promise<Blob>((resolve, reject) => {
          throwIfAborted(signal)
          if (!canvas || width !== canvasWidth || height !== canvasHeight) {
            canvas = document.createElement("canvas")
            canvas.height = height
            canvas.width = width
            context = canvas.getContext("2d")
            if (!context) {
              reject(new Error("Canvas is unavailable."))
              return
            }
            context.imageSmoothingEnabled = true
            context.imageSmoothingQuality = "high"
            context.drawImage(bitmap!, 0, 0, width, height)
            canvasHeight = height
            canvasWidth = width
          }
          canvas.toBlob(
            (blob) =>
              blob
                ? resolve(blob)
                : reject(new Error("The browser could not encode WebP.")),
            "image/webp",
            quality
          )
        }),
      height: bitmap.height,
      originalSizeBytes: file.size,
      signal,
      width: bitmap.width,
    })
    return candidate.blob
  } finally {
    bitmap?.close()
    const activeCanvas = canvas as HTMLCanvasElement | null
    if (activeCanvas) {
      activeCanvas.height = 1
      activeCanvas.width = 1
    }
  }
}

async function optimizeImage(
  file: File,
  mimeType: SupportedImageMimeType,
  signal?: AbortSignal
) {
  if (typeof Worker !== "undefined") {
    try {
      return await optimizeWithWorker(file, signal)
    } catch (error) {
      if (isAbortError(error)) throw error
    }
  }
  return optimizeOnMainThread(file, mimeType, signal)
}

export async function optimizeJobEvidenceFile(
  file: File,
  options: { signal?: AbortSignal } = {}
): Promise<JobEvidenceOptimizationResult> {
  const originalSizeBytes = file.size
  if (originalSizeBytes > EVIDENCE_MAX_SOURCE_BYTES) {
    throw new JobEvidenceOptimizationError(
      "Choose an image no larger than 10 MB.",
      "file_too_large"
    )
  }

  const mimeType = mimeTypeForImageUpload(file)
  if (!mimeType) {
    throw new JobEvidenceOptimizationError(
      "Choose a JPEG, PNG, WebP, HEIC, or HEIF image.",
      "unsupported_file"
    )
  }
  if (
    originalSizeBytes <= EVIDENCE_OPTIMIZATION_THRESHOLD_BYTES &&
    !isPhoneNativeMimeType(mimeType)
  ) {
    return {
      file,
      originalSizeBytes,
      outcome: "skipped",
      uploadSizeBytes: originalSizeBytes,
    }
  }

  try {
    const blob = await optimizeImage(file, mimeType, options.signal)
    throwIfAborted(options.signal)
    if (!blob.size || blob.size >= originalSizeBytes) {
      return {
        file,
        originalSizeBytes,
        outcome: "fallback",
        uploadSizeBytes: originalSizeBytes,
      }
    }

    const optimized = new File([blob], optimizedFileName(file.name), {
      lastModified: file.lastModified,
      type: "image/webp",
    })
    return {
      file: optimized,
      originalSizeBytes,
      outcome: "optimized",
      uploadSizeBytes: optimized.size,
    }
  } catch (error) {
    if (isAbortError(error)) throw error
    return {
      file,
      originalSizeBytes,
      outcome: "fallback",
      uploadSizeBytes: originalSizeBytes,
    }
  }
}
