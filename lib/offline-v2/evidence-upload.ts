import {
  IMAGE_MIME_EXTENSIONS,
  type SupportedImageMimeType,
} from "@/lib/uploads/image"

const SUPPORTED_MIME_TYPES = new Set<SupportedImageMimeType>(
  Object.keys(IMAGE_MIME_EXTENSIONS) as SupportedImageMimeType[]
)

export function validateOfflineEvidenceMetadata(input: {
  extension: string
  mimeType: string
}) {
  if (!SUPPORTED_MIME_TYPES.has(input.mimeType as SupportedImageMimeType)) {
    return null
  }
  const mimeType = input.mimeType as SupportedImageMimeType
  if (IMAGE_MIME_EXTENSIONS[mimeType] !== input.extension) return null
  return { extension: input.extension, mimeType }
}

export function restoreOfflineEvidenceFile(
  blob: Blob,
  input: {
    clientOperationId: string
    extension: string
    mimeType: string
  }
) {
  const metadata = validateOfflineEvidenceMetadata(input)
  if (!metadata) return null
  return new File(
    [blob],
    `${input.clientOperationId}.${metadata.extension}`,
    { type: metadata.mimeType }
  )
}
