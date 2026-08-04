# Pure Peninsula Honey

## Product

Pure Peninsula Honey is a responsive workforce-operations application for a
single organisation. It combines employee access, job execution, rostering,
evidence, review, and reusable schedules in one place.

The application is built with Next.js, TypeScript, Supabase, Resend, Tailwind
CSS, shadcn/ui, and Playwright. Australia/Melbourne is the product timezone.

## Roles and access

| Role     | Primary access                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner    | Full organisation operations, access and role management, review, jobs, roster, templates, and schedules. An owner can be assigned their own operational job, but cannot assign a job to another owner. |
| Manager  | Employee lifecycle and operations: jobs, roster, templates, schedules, and review of employee work. A manager can perform assigned work, but cannot change roles or manage owners/managers.             |
| Employee | Personal roster and assigned jobs. Can add notes and photos, comment, submit work, and see review feedback. Cannot see other employees or manage operations.                                            |

Every operational record belongs to an organisation. Application authorisation
and Supabase Row Level Security enforce organisation and role boundaries.

## Core workflows

### Invite and activate a team member

1. An owner invites an employee, manager, or one additional owner; a manager
   may invite employees only.
2. Supabase Auth sends an invitation. The recipient confirms it and chooses a
   password.
3. Their membership becomes active. An authorised administrator can resend,
   deactivate, reactivate, or remove a pending invitation without deleting work
   history.

There must always be at least one active owner and never more than two
invited-or-active owners.

### Plan and assign work

1. An owner or manager creates a job directly or from a reusable template.
2. They assign or reassign it to an eligible worker, and can schedule recurring
   jobs daily or weekly.
3. Owners and managers use the organisation job board; employees see only
   their own work. Jobs progress from `unassigned` to `assigned`, `in_progress`,
   `in_review`, and `archived`. A reviewer can reopen work, returning it to an
   actionable state with its history intact.

### Complete and review a job

1. The assigned worker starts the job, adds progress notes and required photos,
   then submits it for review.
2. Employee work is reviewed by an active manager or owner; manager work is
   reviewed by an active owner. No one can review their own work.
3. The first valid review wins. Reviewers can approve, comment, reopen, or
   reassign, and the full history and evidence remain available.

### Roster the team

1. Owners and managers create shifts in week/day roster views and can attach
   eligible not-started jobs.
2. Shifts can be edited or archived from the employee profile. Employees see
   their current, next, and upcoming shifts only.
3. Templates and schedules generate recurring work idempotently so retries do
   not duplicate jobs.

### Work through intermittent connectivity

After a successful sign-in, the app prepares the permitted role-scoped
dashboard for offline use. It supports navigation to prepared routes and queues
permitted changes for foreground synchronisation. Queued changes expose local,
syncing, and attention-needed states; replay is idempotent and preserves local
work when a conflict needs resolution. Signing out or losing access purges the
local work data.

The dashboard is installable as a PWA on supported browsers. The Profile page
manages browser push-notification settings where supported and configured.

## Data and privacy

- Private avatars and job evidence are organisation-scoped in Supabase Storage.
- Avatar links are stable, authenticated application URLs and may be prepared
  for offline use. Job evidence is delivered only after authorisation and may
  use short-lived signed URLs.
- No public storage URLs are kept in application records.
- Membership, review, job, roster, schedule, audit, notification, and offline
  replay data is retained according to its operational lifecycle.

## Main routes

| Route                                                         | Purpose                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| `/login`, `/auth/confirm`, `/set-password`, `/reset-password` | Sign-in and account activation/recovery.                 |
| `/dashboard`                                                  | Role-scoped operations overview.                         |
| `/dashboard/jobs`                                             | Job board, execution, evidence, and review.              |
| `/dashboard/roster`                                           | Team and personal roster views.                          |
| `/dashboard/employees`                                        | Employee directory and profiles for authorised roles.    |
| `/dashboard/templates`                                        | Job templates and recurring schedules.                   |
| `/dashboard/profile`                                          | Personal profile, offline storage, and notifications.    |
| `/offline`                                                    | Recovery shell when a prepared dashboard is unavailable. |

## Supported scope

V1 intentionally excludes public organisation signup, multi-organisation
switching, payroll, timesheets, clock-in/out, leave management, non-image job
attachments, and employee-to-employee visibility. Future enhancements may add
reporting, exports, time tracking, payroll integrations, richer notifications,
and background synchronisation.

## Delivery register

- S12 production readiness — `in_progress`, **NO-GO**.
- 2026-08-04 realtime review and performance hardening: diagnosed the missing
  owner-column move as a slow full-snapshot path combined with an in-flight
  refresh dedupe race that could swallow the submission invalidation. The jobs
  screen now batches parent job IDs from private broadcasts, fetches only the
  affected versioned cards through authenticated `GET /api/jobs/live`, and
  moves submitted work directly from Assigned to To review while preserving
  pending offline mutations. The stable realtime channel deduplicates event
  IDs, catches up after reconnect, token refresh, foreground return, and manual
  refresh, and exposes a self-clearing “Live updates paused” recovery action.
  The offline reconciler now guarantees a trailing revision sync when an event
  arrives during an in-flight request. Submission email delivery runs through
  Next.js `after()` after the committed response without changing its delivery
  ledger, idempotency, or retry contract.
- 2026-08-04 realtime review storage/database checkpoint: additive migration
  `20260804074843_realtime_review_performance_hardening.sql` establishes the
  parent-job invalidation contract, adds the RLS-respecting bounded employee
  summary RPC, and adds the partial active-job organisation/update index. The
  offline schema is v4 and prepares all active team jobs plus the newest 15
  archives and details; older archives remain paginated online. Focused Vitest
  (7 files / 27 tests), changed-file Prettier/ESLint, TypeScript, the production
  build, and `git diff --check` pass. A focused multi-session Playwright
  checkpoint covers employee submissions visible to manager/owner, manager
  submissions requiring owner review, the two-second budget, and a deliberately
  held stale owner sync. The linked production database was updated through the
  repository `supa` wrapper on 2026-08-04; remote migration history now matches
  local through `20260804074843`, RPC privileges are authenticated-only, and a
  forced representative `EXPLAIN` confirms
  `jobs_organisation_active_updated_idx` is usable. S12 remains **NO-GO**
  because the local Docker/Supabase stack is not running, so the full pgTAP set
  and repeated production-build Playwright checkpoint could not execute.
  Production must also monitor card-move latency, reconnect recovery,
  trailing-sync frequency, and deferred email failures after deployment. No
  environment variables were added or changed.
- 2026-08-04 cached-shell job-detail regression: prepared dashboard users can
  open, switch, and close job details from `/dashboard/jobs` again. The shared
  detail controller now follows prop-driven detail changes from the cached
  dashboard router without remounting while preserving direct navigation,
  history, snapshot, and online-refresh behavior. Added focused controller
  coverage for open/switch/close transitions. Changed-file Prettier/ESLint, 3
  Vitest files / 22 tests, TypeScript, and `git diff --check` pass. The focused
  mobile Playwright drawer regression remains deferred because the local Docker
  daemon/Supabase stack is not running. No environment-variable or database
  change is required.
- 2026-08-04 deployment asset-cache regression: public shell cache v11 keeps a
  prepared cached shell coherent with its cached immutable Next.js assets when
  Vercel removes an older deployment's chunks. Online dashboard navigation also
  refreshes the shell and current asset set in the background for the next
  navigation. The global `X-Content-Type-Options: nosniff` protection remains
  unchanged. The deployed v10 worker and a reported chunk URL reproduced the
  mismatched-cache path (the asset is now a text/plain 404). Changed-file
  Prettier/ESLint, 2 Vitest files / 12 tests, TypeScript, the production build,
  and `git diff --check` pass. The deployment-transition Playwright regression
  is implemented but still needs execution against the seeded browser stack.
  No environment-variable or database change is required.
- 2026-08-04 local workspace recovery: when cached-shell repository opening
  fails or remains stuck for ten seconds, the otherwise hidden opening state is
  replaced with a styled recovery card. Its destructive action is available
  only in that failure state, warns that unsynchronised local changes will be
  removed, deletes the `pph-offline-v2` IndexedDB database, clears the public
  readiness marker, and reloads for a clean bootstrap. Changed-file
  Prettier/ESLint, 2 Vitest files / 12 tests, TypeScript, the production build,
  and `git diff --check` pass. No environment-variable or database migration is
  required.
- 2026-08-04 sidebar persistence regression: prepared deployed installations
  serve the cached `/offline` shell even while online, and that shell previously
  hardcoded the sidebar open instead of applying the persisted cookie. The
  shared dashboard chrome now writes the non-sensitive preference to browser
  storage and its cookie synchronously, then reconciles from browser storage or
  the cookie after hydration. The server write also migrates existing HttpOnly
  preference cookies. Both the server layout and cached shell therefore restore
  the last choice. Added focused persistence parsing coverage. No
  environment-variable or database change is required.
