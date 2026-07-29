"use server"

import { z } from "zod"

import { requireActiveMembership } from "@/lib/auth/membership"
import { createClient } from "@/lib/supabase/server"

const subscriptionSchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({
    auth: z.string().min(1).max(512),
    p256dh: z.string().min(1).max(512),
  }),
  userAgent: z.string().max(500),
})

const endpointSchema = z.url().max(2048)

export async function subscribeToPushAction(input: unknown) {
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) {
    return { message: "The browser subscription is invalid.", ok: false } as const
  }
  const membership = await requireActiveMembership()
  const supabase = await createClient()
  const { error } = await supabase.from("web_push_subscriptions").upsert(
    {
      active: true,
      auth: parsed.data.keys.auth,
      deactivated_at: null,
      endpoint: parsed.data.endpoint,
      membership_id: membership.membershipId,
      organisation_id: membership.organisationId,
      p256dh: parsed.data.keys.p256dh,
      updated_at: new Date().toISOString(),
      user_agent: parsed.data.userAgent,
    },
    { onConflict: "endpoint" }
  )
  if (error) {
    console.error("Push subscription upsert failed", {
      code: error.code,
      membershipId: membership.membershipId,
    })
    return { message: "Push notifications could not be enabled.", ok: false } as const
  }
  return { ok: true } as const
}

export async function unsubscribeFromPushAction(endpoint: unknown) {
  const parsed = endpointSchema.safeParse(endpoint)
  if (!parsed.success) {
    return { message: "The browser subscription is invalid.", ok: false } as const
  }
  const membership = await requireActiveMembership()
  const supabase = await createClient()
  const { error } = await supabase
    .from("web_push_subscriptions")
    .update({
      active: false,
      deactivated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("endpoint", parsed.data)
    .eq("membership_id", membership.membershipId)
    .eq("organisation_id", membership.organisationId)
  if (error) {
    console.error("Push subscription deactivation failed", {
      code: error.code,
      membershipId: membership.membershipId,
    })
    return { message: "Push notifications could not be disabled.", ok: false } as const
  }
  return { ok: true } as const
}
