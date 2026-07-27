export const EVIDENCE_MAX_SOURCE_BYTES = 10 * 1024 * 1024
export const EVIDENCE_OPTIMIZATION_THRESHOLD_BYTES = 1024 * 1024
export const EVIDENCE_TARGET_RATIO = 0.5
export const EVIDENCE_MAX_LONG_EDGE = 2048
export const EVIDENCE_MIN_LONG_EDGE = 1280
export const EVIDENCE_WEBP_QUALITIES = [0.82, 0.75, 0.68, 0.61, 0.54] as const
export const EVIDENCE_BITMAP_OPTIONS = {
  imageOrientation: "from-image",
} satisfies ImageBitmapOptions

export type EncodedImageCandidate = {
  blob: Blob
  height: number
  quality: number
  width: number
}

type EncodeImage = (input: {
  height: number
  quality: number
  width: number
}) => Promise<Blob>

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
}

export function imageDimensionTargets(width: number, height: number) {
  const originalLongEdge = Math.max(width, height)
  const maximumLongEdge = Math.min(originalLongEdge, EVIDENCE_MAX_LONG_EDGE)
  const minimumLongEdge = Math.min(originalLongEdge, EVIDENCE_MIN_LONG_EDGE)
  const longEdges = [maximumLongEdge]

  while (longEdges.at(-1)! > minimumLongEdge) {
    const next = Math.max(minimumLongEdge, Math.floor(longEdges.at(-1)! * 0.85))
    if (next === longEdges.at(-1)) break
    longEdges.push(next)
  }

  return longEdges.map((longEdge) => {
    const scale = longEdge / originalLongEdge
    return {
      height: Math.max(1, Math.round(height * scale)),
      width: Math.max(1, Math.round(width * scale)),
    }
  })
}

export async function findBestWebpCandidate(input: {
  encode: EncodeImage
  height: number
  originalSizeBytes: number
  signal?: AbortSignal
  width: number
}): Promise<EncodedImageCandidate> {
  const targetBytes = Math.floor(
    input.originalSizeBytes * EVIDENCE_TARGET_RATIO
  )
  let smallest: EncodedImageCandidate | null = null

  for (const dimensions of imageDimensionTargets(input.width, input.height)) {
    for (const quality of EVIDENCE_WEBP_QUALITIES) {
      throwIfAborted(input.signal)
      const blob = await input.encode({ ...dimensions, quality })
      if (!blob.size) continue

      const candidate = { blob, ...dimensions, quality }
      if (!smallest || candidate.blob.size < smallest.blob.size) {
        smallest = candidate
      }
      if (candidate.blob.size <= targetBytes) return candidate
    }
  }

  if (!smallest) throw new Error("The browser could not encode this image.")
  return smallest
}
