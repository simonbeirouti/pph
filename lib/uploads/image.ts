export const IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
} as const

export type SupportedImageMimeType = keyof typeof IMAGE_MIME_EXTENSIONS

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx"])
const HEIF_BRANDS = new Set(["mif1", "msf1"])

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value)
}

function readAscii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length))
}

export function detectImageMimeType(
  bytes: Uint8Array
): SupportedImageMimeType | null {
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png"
  }
  if (
    bytes.length >= 12 &&
    readAscii(bytes, 0, 4) === "RIFF" &&
    readAscii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp"
  }
  if (bytes.length >= 12 && readAscii(bytes, 4, 4) === "ftyp") {
    const brand = readAscii(bytes, 8, 4)
    if (HEIC_BRANDS.has(brand)) return "image/heic"
    if (HEIF_BRANDS.has(brand)) return "image/heif"
  }
  return null
}

export function extensionForImageMimeType(mimeType: SupportedImageMimeType) {
  return IMAGE_MIME_EXTENSIONS[mimeType]
}

export function mimeTypeForImageUpload(file: Pick<File, "name" | "type">) {
  const declaredMimeType = file.type.toLowerCase()
  if (declaredMimeType in IMAGE_MIME_EXTENSIONS) {
    return declaredMimeType as SupportedImageMimeType
  }

  const extension = file.name.split(".").pop()?.toLowerCase()
  if (extension === "heic") return "image/heic"
  if (extension === "heif") return "image/heif"
  return null
}
