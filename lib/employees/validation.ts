import { z } from "zod"

import { detectImageMimeType, IMAGE_MIME_EXTENSIONS } from "@/lib/uploads/image"

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

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

export const teamMemberSchema = employeeSchema.extend({
  role: z.enum(["owner", "manager", "employee"]),
})

export const employeeProfileSchema = employeeSchema.omit({ email: true })

export type ValidAvatar = {
  bytes: Uint8Array
  extension: (typeof IMAGE_MIME_EXTENSIONS)[keyof typeof IMAGE_MIME_EXTENSIONS]
  mimeType: keyof typeof IMAGE_MIME_EXTENSIONS
}

export { detectImageMimeType }

export async function validateAvatar(
  file: File | null
): Promise<
  | { avatar: null; error?: never }
  | { avatar?: never; error: string }
  | { avatar: ValidAvatar; error?: never }
> {
  if (!file || file.size === 0) return { avatar: null }
  if (!(file.type in IMAGE_MIME_EXTENSIONS)) {
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
      extension: IMAGE_MIME_EXTENSIONS[detected],
      mimeType: detected,
    },
  }
}
