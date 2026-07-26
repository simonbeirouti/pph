import { z } from "zod"

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  NEXT_PUBLIC_SUPABASE_URL: z
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
})

export type SupabasePublicConfig = {
  publishableKey: string
  url: string
}

export function parseSupabasePublicConfig(environment: {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
  NEXT_PUBLIC_SUPABASE_URL?: string
}): SupabasePublicConfig {
  const parsed = publicEnvironmentSchema.safeParse(environment)

  if (!parsed.success) {
    throw new Error(
      `Invalid public Supabase configuration: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(", ")}`
    )
  }

  return {
    publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
  }
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  return parseSupabasePublicConfig({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  })
}
