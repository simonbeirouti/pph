import { createClient } from "npm:@supabase/supabase-js@2.110.8"
import webpush from "npm:web-push@3.6.7"

type Delivery = {
  attempt_count: number
  id: number
  push_notification_events: {
    deep_link: string
    label: string
  }
  web_push_subscriptions: {
    auth: string
    endpoint: string
    id: number
    p256dh: string
  }
}

const required = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is required`)
  return value
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const supabase = createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  webpush.setVapidDetails(
    required("VAPID_SUBJECT"),
    required("VAPID_PUBLIC_KEY"),
    required("VAPID_PRIVATE_KEY")
  )

  const { data, error } = await supabase
    .from("push_notification_deliveries")
    .select(
      `
        id,
        attempt_count,
        push_notification_events!inner(label, deep_link),
        web_push_subscriptions!inner(id, endpoint, p256dh, auth)
      `
    )
    .in("status", ["queued", "retry"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("id")
    .limit(50)

  if (error) return Response.json({ error: "Unable to load deliveries" }, { status: 500 })

  let delivered = 0
  let retried = 0
  let deactivated = 0
  for (const delivery of (data ?? []) as unknown as Delivery[]) {
    const claimed = await supabase
      .from("push_notification_deliveries")
      .update({
        attempt_count: delivery.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
        status: "sending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id)
      .in("status", ["queued", "retry"])
      .select("id")
      .maybeSingle()
    if (!claimed.data) continue

    try {
      const result = await webpush.sendNotification(
        {
          endpoint: delivery.web_push_subscriptions.endpoint,
          keys: {
            auth: delivery.web_push_subscriptions.auth,
            p256dh: delivery.web_push_subscriptions.p256dh,
          },
        },
        JSON.stringify({
          label: delivery.push_notification_events.label,
          url: delivery.push_notification_events.deep_link,
        }),
        { TTL: 60 * 60 }
      )
      await supabase
        .from("push_notification_deliveries")
        .update({
          delivered_at: new Date().toISOString(),
          last_error: null,
          response_status: result.statusCode,
          status: "delivered",
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.id)
      delivered += 1
    } catch (caught) {
      const statusCode =
        typeof caught === "object" &&
        caught &&
        "statusCode" in caught &&
        typeof caught.statusCode === "number"
          ? caught.statusCode
          : null
      const permanent = statusCode === 404 || statusCode === 410
      const attempt = delivery.attempt_count + 1
      const delayMinutes = Math.min(60, 2 ** Math.min(attempt, 6))
      await supabase
        .from("push_notification_deliveries")
        .update({
          last_error: permanent
            ? "Push endpoint is no longer available"
            : "Transient push delivery failure",
          next_attempt_at: new Date(
            Date.now() + delayMinutes * 60_000
          ).toISOString(),
          response_status: statusCode,
          status: permanent ? "permanent_failure" : "retry",
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.id)
      if (permanent) {
        await supabase
          .from("web_push_subscriptions")
          .update({
            active: false,
            deactivated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", delivery.web_push_subscriptions.id)
        deactivated += 1
      } else {
        retried += 1
      }
    }
  }

  return Response.json({ deactivated, delivered, retried })
})
