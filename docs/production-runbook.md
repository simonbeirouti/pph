# Employee Ops production runbook

## Release artifact and configuration

1. Build one immutable release artifact and deploy that exact artifact to
   staging before production.
2. Configure the variables listed in `.env.example`. Keep the VAPID private
   key, Supabase secret key, and Resend key in deployment/Supabase secret
   stores. Never expose them through `NEXT_PUBLIC_` variables.
3. Confirm `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the Edge Function
   `VAPID_PUBLIC_KEY` are the same key. Set `VAPID_SUBJECT` to a monitored
   `mailto:` address or HTTPS origin.
4. Deploy `dispatch-web-push` with JWT verification enabled.
5. In Supabase Database Webhooks, invoke `dispatch-web-push` after INSERT on
   `public.push_notification_deliveries`. Authenticate the request with the
   project service-role bearer token held by the Supabase integration, not in
   application code.
6. Add a one-minute Supabase Cron invocation of the same Edge Function so
   transient deliveries whose `next_attempt_at` has elapsed are retried even
   when no new notification is inserted.

The dispatcher claims at most 50 queued deliveries per invocation. A `404` or
`410` permanently deactivates that browser subscription. Other failures use
bounded exponential retry. Notification delivery never participates in the
job or roster transaction.

## Migration and rollback

- Take and verify a database backup before applying release migrations.
- Apply migrations in timestamp order and inspect the migration report before
  enabling the push webhook.
- If application rollout fails, roll back the application artifact first.
  Disable the push webhook and Cron job to stop delivery. Do not delete queued
  delivery, operation receipt, or local-recovery records.
- Database rollback is restore-forward: restore the verified backup to a new
  environment, apply only approved migrations, validate organisation/RLS
  isolation, then switch traffic. Do not issue destructive down migrations in
  place.

## Offline and push incident response

- Offline assigned work is local-only. Starts, notes, photos, and submission are
  written to IndexedDB without contacting Supabase. Automatic foreground replay
  begins only after the browser reports connectivity or a same-origin
  reachability probe succeeds.
- A worker with `needs_attention` retains local notes/photos until they
  explicitly discard them or the membership/consent purge contract applies.
- Reassignment, inactive membership, archive, and version conflicts are not
  auto-merged. Verify the authoritative job and operation receipt before
  advising a worker to retry.
- Inspect `push_notification_deliveries` by status and attempt time. Stored
  errors are generic and must not contain endpoint keys, job notes, employee
  details, locations, evidence, or signed URLs.
- Rotate VAPID keys only as an incident response or planned migration. Existing
  browser subscriptions must opt in again after a rotation.

## Staging release checklist

- Verify Auth redirects, HTTPS, cookie behaviour, service-worker headers,
  installability, private Storage, signed URL expiry, and cross-organisation
  rejection.
- Perform physical-device PWA checks only on a trusted HTTPS origin. A
  plain-HTTP LAN URL such as `http://192.168.x.x` is not a valid service-worker
  or installability environment. Playwright WebKit does not support
  service-worker testing, so the automated offline gate runs in Chromium and
  real Safari remains a named manual staging check.
- Run desktop and supported-mobile offline preload/reload/start/note/photo/
  submit/reconnect journeys, quota-pressure handling, logout purge, and
  expired-cache recovery.
- On real Chrome/Edge/Android and supported Safari/iOS devices, verify push
  opt-in/out, denied/unsupported states, foreground/background delivery, and
  same-origin job/roster deep links. Inspect the payload to confirm it contains
  only `label` and `url`.
- Deliberately exercise mutation, scheduler, email, push, and upload failures
  and confirm the configured monitoring service records actionable identifiers
  without private content.
- Record migration window, rollback trigger, release owner, on-call owner,
  post-deploy smoke result, and monitoring window in the PRD release decision
  record.
