import "server-only"

import { z } from "zod"

const serverEnvironmentSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),
})

export function parseSupabaseSecretKey(environment: {
  SUPABASE_SECRET_KEY?: string
}): string {
  const parsed = serverEnvironmentSchema.safeParse(environment)

  if (!parsed.success) {
    throw new Error("Invalid server Supabase configuration: secret key is missing")
  }

  return parsed.data.SUPABASE_SECRET_KEY
}

export function getSupabaseSecretKey(): string {
  return parseSupabaseSecretKey({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  })
}
