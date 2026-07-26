import { z } from "zod"

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const

export const employeeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  firstName: z.string().trim().min(1, "Enter a first name.").max(100),
  jobTitle: z.string().trim().min(1, "Enter a job title.").max(150),
  lastName: z.string().trim().min(1, "Enter a last name.").max(100),
  phone: z.string().trim().min(1, "Enter a phone number.").max(50),
})

export const employeeProfileSchema = employeeSchema.omit({ email: true })

export type ValidAvatar = {
  bytes: Uint8Array
  extension: (typeof MIME_EXTENSIONS)[keyof typeof MIME_EXTENSIONS]
  mimeType: keyof typeof MIME_EXTENSIONS
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value)
}

export function detectImageMimeType(
  bytes: Uint8Array
): keyof typeof MIME_EXTENSIONS | null {
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png"
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp"
  }
  return null
}

export async function validateAvatar(
  file: File | null
): Promise<
  | { avatar: null; error?: never }
  | { avatar?: never; error: string }
  | { avatar: ValidAvatar; error?: never }
> {
  if (!file || file.size === 0) return { avatar: null }
  if (!(file.type in MIME_EXTENSIONS)) {
    return { error: "Use a JPEG, PNG, or WebP image." }
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Avatar images must be 5 MB or smaller." }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const detected = detectImageMimeType(bytes)
  if (!detected || detected !== file.type) {
    return { error: "The file contents do not match its image type." }
  }

  return {
    avatar: {
      bytes,
      extension: MIME_EXTENSIONS[detected],
      mimeType: detected,
    },
  }
}
