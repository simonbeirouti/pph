# Employee Operations Dashboard — Sequential Implementation Register

## Purpose

This file converts [`PRD.md`](PRD.md) into one ordered implementation plan.

`PRD.md` remains the source of truth for product behaviour, architecture, security, and acceptance criteria. This file tracks:

- the current implementation step;
- the exact order of work;
- tasks and PRD references for each step;
- required tests and completion gates;
- reusable reference code;
- deferred integration TODOs;
- checkpoint notes and verification results.

This plan does not depend on parallel branches or sub-agents. Work proceeds one step at a time in the same implementation lineage.

## Working method

1. Confirm the previous step is `complete`.
2. Change the next step to `in_progress`.
3. Read its linked PRD stories and relevant Next.js 16 documentation.
4. Inspect relevant files in `components/ref-files`.
5. Implement the complete step, including schema, permissions, server behaviour, UI, and tests.
6. Run the step's required checks.
7. Update generated types, `.env.example`, documentation, and the TODO ledger where applicable.
8. Record the verification result and checkpoint commit.
9. Mark the step `complete`.
10. Begin the next step only after the working tree is clean and the checkpoint is recoverable.

Normal Git commits remain encouraged as checkpoints, but feature branches, worktrees, and parallel agents are not part of this delivery plan.

## Status values

| Status        | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `planned`     | Defined but not started                                            |
| `in_progress` | The only step currently being implemented                          |
| `blocked`     | Waiting on a required decision, credential, or external dependency |
| `complete`    | Implementation and step-level checks pass                          |
| `verified`    | Confirmed as part of the final integrated V1 journey               |

At most one row may be `in_progress`.

## Installed project skills

The following checked-in skills are required parts of development:

| Skill                              | Required for                                                                                                    | Primary steps                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `playwright-best-practices`        | Playwright architecture, configuration, fixtures, Auth, mobile, drag/drop, upload, time, PWA, debugging, and CI | S01–S11                         |
| `supabase`                         | Supabase Auth, SSR, clients, CLI, migrations, RLS, Storage, and Cron                                            | S01, S02, S04–S06, S08, S10–S11 |
| `supabase-postgres-best-practices` | Schema, constraints, indexes, RLS performance, queries, locking, and database review                            | Every schema/query step         |
| `vercel-react-best-practices`      | React/Next.js rendering, data fetching, server actions, bundle size, and client performance                     | Every UI step                   |

For each active step:

1. Read every applicable skill's `SKILL.md` completely.
2. Follow its activity routing and read only the references required for the work.
3. Apply the guidance while preserving PRD behaviour.
4. Record the skills and important references used in the checkpoint notes.

## Implementation status

| Step | Capability                              | Status        | Depends on | Checkpoint | Verification notes                                                                                                                                                                                         |
| ---- | --------------------------------------- | ------------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S00  | Product and implementation baseline     | `complete`    | —          | `8a07533`  | Baseline content is committed and recoverable; documentation links resolve and no feature step is represented as complete                                                                                  |
| S01  | Platform foundation                     | `complete`    | S00        | `2e26642`  | Local stack reset/seed, schema lint, 24 pgTAP checks, 22 unit/component checks, 10 desktop/mobile Playwright checks, lint, type-check, generated types, and production build pass                          |
| S02  | Authentication and employees            | `complete`    | S01        | —          | 66 pgTAP checks, 33 unit/component tests, prior 18-check desktop/mobile Playwright journey, current live-browser interaction QA, schema lint, generated types, lint, type-check, and production build pass |
| S03  | Progressive Web App shell               | `complete`    | S02        | —          | Valid manifest/icons, lifecycle-only root service worker, employee install guidance, security headers, Auth/PWA degradation, 43 unit, 66 database, and 50 desktop/mobile E2E checks pass.                  |
| S04  | Owner jobs and Kanban                   | `complete`    | S03        | —          | Three-column workflow, viewport-height/internal scrolling, full-width mobile snapping, human-readable assignment controls, 65 unit/component, 123 database, and 54 runnable E2E checks pass.               |
| S05  | Employee job execution and owner review | `complete`    | S04        | `ef897ef`  | Complete job execution/review, private evidence, creator-owner email, deterministic shared-fixture browser coverage, 96 unit/component, 170 database, and 57 desktop/mobile E2E checks pass.               |
| S06  | Roster data and views                   | `in_progress` | S05        | —          | Owner Roster route, viewer-local live time, Team day retains every active employee lane even without a shift on the selected date, viewport-contained Team day/Employee week views, employee-sheet exact create/edit, focused roster checks pass.          |
| S07  | Roster interactions                     | `planned`     | S06        | —          | —                                                                                                                                                                                                          |
| S08  | Templates and job schedules             | `planned`     | S07        | —          | —                                                                                                                                                                                                          |
| S09  | Operational dashboards                  | `planned`     | S08        | —          | —                                                                                                                                                                                                          |
| S10  | Offline employee job completion         | `planned`     | S09        | —          | Membership-scoped IndexedDB work packs and outbox, idempotent foreground sync, evidence recovery, conflict states, and offline mobile coverage.                                                            |
| S11  | Integration and production hardening    | `planned`     | S10        | —          | —                                                                                                                                                                                                          |

## Rules that apply to every step

- Link implementation decisions to the applicable PRD story or section.
- Do not begin work that belongs to a later step.
- Preserve established contracts from completed steps unless the PRD is updated first.
- Add new Supabase migrations; do not rewrite migrations already used by a completed step.
- Regenerate checked-in Supabase types after schema changes.
- Treat `.env.example` as the canonical variable list.
- If `.env.example` changes, explicitly tell the user which real values must be added, renamed, or removed in `.env.local`.
- Never place usable secrets in `.env.example`.
- Inspect relevant reference implementations before recreating styling or functionality.
- Preserve useful styling, interactions, logic, and assets while replacing obsolete `@eva/*`, missing, or reference-only dependencies.
- Record which reference files were reused, cleaned, moved, left for later, or removed.
- Keep production imports in repository-native `app`, `features`, `lib`, or shared component locations.
- Add tests with the implementation, not in a later cleanup pass.
- Use the installed project skills for every matching implementation or test task.
- Record deferred cross-step work in the TODO ledger as soon as it is discovered.
- Finish with a clean lint, type-check, test, and build result appropriate to the step.

## Shared implementation surfaces

| Surface                                       | Rule                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `PRD.md`                                      | Update first when product behaviour or architecture changes                      |
| `FEATURES.md`                                 | Update active status, checkpoint, verification notes, and TODOs                  |
| `AGENTS.md`                                   | Keep durable repository workflow guidance aligned with this plan                 |
| `.env.example`                                | Names and safe placeholders only; explicitly notify the user of every change     |
| `package.json`, `pnpm-lock.yaml`              | Add dependencies only when required by the active step                           |
| Root `proxy.ts`, `lib/supabase/proxy.ts`      | Established in S01; later changes require regression tests                       |
| `app/layout.tsx`, dashboard shell, navigation | Establish incrementally; avoid placeholders that imply unavailable features work |
| `next.config.ts`                              | Reconcile Proxy, PWA, and security requirements when S03 changes it              |
| Supabase migrations                           | Append-only after the owning step is complete                                    |
| Generated Supabase types                      | Regenerate after every schema step and verify again in S11                       |
| Shared test fixtures                          | Extend without weakening prior role or organisation isolation                    |
| `components/ref-files/**`                     | Reusable source material; clean and absorb relevant code during the owning step  |

## S00 — Product and implementation baseline

### Outcome

The product scope, sequential implementation plan, reference assets, environment contract, and durable agent guidance are committed and recoverable.

### Included

- [x] [`PRD.md`](PRD.md)
- [x] [`FEATURES.md`](FEATURES.md)
- [x] [`AGENTS.md`](AGENTS.md)
- [x] `.env.example`
- [x] Starter UI and `components/ref-files`

### Completion evidence

- [x] Baseline checkpoint `8a07533` exists in the current implementation lineage.
- [x] Documentation links resolve.
- [x] At the S00 checkpoint, no feature implementation was represented as complete.

## S01 — Platform foundation

### PRD references

- AUTH-01
- Sections 2, 6.1–6.3, 8, and 11
- Sequential implementation Step 1

### Required skills

- `playwright-best-practices`
- `supabase`
- `supabase-postgres-best-practices`
- `vercel-react-best-practices`

### Outcome

The application has a clean quality baseline, local Supabase foundation, typed session boundary, organisation membership security, and protected application shell.

### Tasks

- [x] Exclude untouched reference files from production lint and TypeScript scope while keeping them available for inspection.
- [x] Fix starter lint and type-check failures.
- [x] Add Vitest and React Testing Library alongside the already installed `@playwright/test`.
- [x] Configure `playwright.config.ts`, local web-server lifecycle, Chromium development project, mobile project, failure artifacts, deterministic Auth/data fixtures, and test directories according to the Playwright skill.
- [x] Add scripts for lint, type-check, unit tests, database tests, Playwright tests, and production build.
- [x] Create `organisations`, `memberships`, and minimal `employee_profiles` migrations.
- [x] Add representative seed data for owner, invited employee, active employee, and inactive employee states.
- [x] Generate checked-in Supabase types.
- [x] Port Supabase browser, server, admin, and environment helpers into repository-native modules.
- [x] Port the reference Proxy pattern into a thin root `proxy.ts` and `lib/supabase/proxy.ts`.
- [x] Propagate refreshed Supabase cookies through both the request and returned response.
- [x] Implement optimistic signed-out dashboard and signed-in root/login redirects.
- [x] Exclude framework assets, images, `/sw.js`, and `/manifest.webmanifest` from the matcher.
- [x] Add authoritative session, membership, role, status, and organisation helpers.
- [x] Establish the role-aware application shell and protected-route boundaries.

### Tests

- [x] Environment validation.
- [x] Session and permission helpers.
- [x] Proxy cookie propagation and redirects.
- [x] Public Auth route and static/PWA matcher behaviour.
- [x] Membership state and organisation-isolation RLS.
- [x] Signed-out, owner, employee, and inactive-user route behaviour.
- [x] Clean lint, type-check, test, and build commands.
- [x] Playwright configuration, fixtures, user-facing locators, web-first assertions, and failure artifacts.

### Reference material

- [x] Supabase browser prototype — consumed into `lib/supabase/browser.ts` and removed.
- [x] Supabase server prototype — consumed into `lib/supabase/server.ts` and removed.
- [x] Supabase admin prototype — consumed into `lib/supabase/admin.ts` and removed.
- [x] Supabase environment prototype — split into `lib/supabase/public-env.ts` and `lib/supabase/server-env.ts`, then removed.
- [x] Supabase session Proxy prototype — consumed into `lib/supabase/proxy.ts` and removed.
- [x] Thin root Proxy prototype — consumed into root `proxy.ts` and removed.
- [x] Existing application shell and sidebar components — cleaned into the role-aware S01 shell.

### Completion gate

- [x] All foundation checks pass.
- [x] Required environment variables are documented and validated.
- [x] The `.env.example` changes were explicitly reported to the user.
- [x] No authoritative access decisions are implemented only in Proxy.
- [x] Status, checkpoint, verification notes, and TODOs are updated.

### S01 checkpoint

- Commit: `2e26642`.
- PRD stories verified: AUTH-01 foundation and sections 2, 6.1–6.3, 8, and 11.
- Commands passed: `pnpm db:reset`, Supabase schema lint with warnings treated as failures, `pnpm db:types`, `pnpm test:db` (24), `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` (22), `pnpm test:e2e` (10 across desktop Chromium and Pixel 7), and `pnpm build`.
- Database migration: `20260726032911_platform_foundation.sql`; the existing `pph` local project, ports, PostgreSQL 17 stack, migration configuration, seed configuration, and local SMTP capture were preserved.
- Environment variables changed: `.env.example` now contains empty placeholders for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the added server-only `SUPABASE_SECRET_KEY`. The secret in `.env.local` matches the local stack; its two public entries still require the local `API_URL` and `PUBLISHABLE_KEY` mappings followed by a Next.js restart.
- Project skills and references used: `playwright-best-practices`, `supabase`, `supabase-postgres-best-practices`, and `vercel-react-best-practices`; Next.js 16 Proxy, environment, `distDir`, and custom TypeScript configuration guides; Supabase SSR cookie/session guidance.
- Reference files reused/cleaned/removed: the browser, server, admin, environment, Proxy, and root Proxy prototypes were ported into repository-native production modules and then removed. The remaining `components/ref-files/**` examples stay available for later owning steps and remain excluded from production TypeScript and ESLint scope. The application-shell and sidebar components were cleaned into the role-aware S01 shell.
- Deferred TODOs: TODO-001, TODO-006, and TODO-011 remain planned for their registered later steps.
- Known limitations: credential submission, invitation acceptance, password setup, final feature navigation, and PWA assets remain owned by later steps. From S02 onward, local development and Playwright use the shared port-4000 application origin.

### Implementation prompt

```text
Implement S01 Platform Foundation from FEATURES.md against PRD.md.

Work only on S01. Establish clean lint/type/build baselines, test tooling, Supabase local structure, organisations/memberships/minimal employee profiles, generated types, typed clients, environment validation, session and permission helpers, RLS, seeds, and the role-aware application shell.

Read the bundled Next.js 16 Proxy and environment guides first. Use the completed repository-native Supabase modules and the thin root proxy.ts delegating to lib/supabase/proxy.ts, with correct request/response cookie propagation, optimistic redirects, public Auth access, and static/PWA matcher exclusions. The consumed Supabase prototypes have been removed. Keep authoritative authorisation in the data-access layer and mutations.

Inspect and reuse suitable existing styling and functionality. Do not implement invitations, employee management UI, PWA assets, jobs, roster, templates, schedules, or dashboards.

If .env.example changes, explicitly list the changed variables and tell the user to add real values to .env.local. Update S01 status, verification notes, checkpoint, reference-code disposition, and deferred TODOs. Finish only after the S01 checks pass.
```

## S02 — Authentication and employees

### PRD references

- AUTH-02 through AUTH-04
- EMP-01 through EMP-03
- `/auth/confirm`, `/set-password`, and `/dashboard/employees`
- Sequential implementation Step 2

### Outcome

An owner can manage the employee lifecycle, and an invited employee can activate a secure account.

### Tasks

- [x] Implement owner login against the S01 Auth/session boundary.
- [x] Implement employee creation, validation, directory, filtering, and detail.
- [x] Create pending membership and profile records idempotently.
- [x] Call Supabase Admin for initial employee invitations.
- [x] Implement token-hash Auth confirmation, exact membership linking, password setup, and activation.
- [x] Implement edit, deactivate, and reactivate behaviour.
- [x] Add private avatar storage, content validation, path policies, signed URLs, cleanup, and initials fallback.
- [x] Publish the server-only typed `ActiveEmployeeOption` query for later jobs and roster steps.
- [x] Keep S04 job summaries and S06 roster information as explicit deferred states.
- [x] Move the canonical local application and Playwright origin to port 4000.
- [x] Provide root toast/tooltip providers and header theme switching; link the sidebar user directly to profile and keep logout in the profile header.
- [x] Make each full employee row in the full-width directory open details in a right-hand sheet and create employees in a dialog without route transitions.
- [x] Keep access deactivation at the end of the employee sheet.
- [x] Require confirmation before deleting an invited employee or deactivating an active employee; keep resend above the access action and report results through toasts.
- [x] Allow every active user, including owners, to edit their own profile under organisation-scoped RLS.
- [x] Provide responsive mobile navigation and an evenly spaced desktop inset sidebar whose cookie-backed icon-collapsed preference is rendered correctly on the first frame after reload.
- [x] Keep theme rendering hydration-safe and expose a prominent invitation send/resend/retry action near the top of the employee sheet.
- [x] Refine the employee sheet with a large clickable avatar, centred identity and status, direct email/call actions, dirty-only save, and a persistent access footer that keeps invitation resend immediately above invited-employee deletion.
- [x] Keep the outlined theme control hydration-safe by avoiding server/client attributes derived from the pre-hydration resolved theme.
- [x] Allow both local application hostnames (`127.0.0.1` and `localhost`) for invitation confirmation so Supabase does not silently replace the requested callback with the login-bound site root.

### Tests

- [x] Login validation, success, safe failure, and inactive-user handling.
- [x] Duplicate and case-insensitive employee email handling.
- [x] Invitation idempotency, exact callback linking, password setup, and activation.
- [x] Owner/employee/inactive/cross-organisation RLS and privileged-function grants.
- [x] Avatar type, size, magic bytes, path, owner/self/cross-organisation access, signed URL, and storage policies.
- [x] Active-employee contract mapping and database source filtering.
- [x] Owner creates/invites employee E2E journey on desktop and mobile at port 4000.

### Completion gate

- [x] The full invitation-to-activation journey passes on desktop and mobile at port 4000.
- [x] Employee permissions do not expose another employee's data.
- [x] Later steps can consume a typed active-employee interface.
- [x] Email is captured by local Mailpit in automated tests; no real email is sent.

### Reference material

- [x] The remaining `components/ref-files/resend/**` examples were inspected and left in place. S02 delegates initial invite delivery to Supabase Auth SMTP, so direct application Resend code is intentionally not ported or removed.
- [x] Employee forms, directory/detail views, access actions, and avatar UI use repository-native components and imports.

### S02 checkpoint

- Commit: Pending; the user has not requested a Git checkpoint commit.
- PRD stories verified: AUTH-02 through AUTH-04, EMP-01 through EMP-03, and the `/auth/confirm`, `/set-password`, and `/dashboard/employees` route contracts.
- Commands passed: `pnpm test:unit` (33), the prior `pnpm test:e2e` journey (18 across desktop and mobile at port 4000), `pnpm db:reset`, `pnpm test:db` (66), `pnpm db:types`, Supabase schema lint with warnings treated as failures, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check`. Current live-browser QA verified shadcn theme switching without hydration errors, direct sidebar profile navigation, profile-header logout, owner profile editing, shared employee filters, full-row right-hand employee details, the large clickable sheet avatar, centred identity/status, direct email/call actions, dirty-only save, persistent resend/delete and access actions, confirmed invited-employee deletion and active-employee deactivation, toast feedback for invitation resend and access changes, in-place reactivate, dialog-based employee creation, cookie-first expanded and collapsed sidebar reloads without a post-hydration state correction, and even collapsed icon-rail spacing. A fresh CLI Playwright rerun could not start in the restricted sandbox because its server reachability check attempted to bind the already-running port 4000.
- Database migration: `20260726062502_authentication_employees.sql`; the owner self-profile update and invited-employee deletion follow-ups were consolidated into this S02 migration before the local reset.
- Environment variable names changed: none. `.env.example` now provides the safe local Docker Supabase defaults for its existing URL, publishable-key, and secret-key entries. Hosted Resend SMTP credentials belong in Supabase Auth configuration, not application variables.
- Project skills and references used: `playwright-best-practices`, `supabase`, `supabase-postgres-best-practices`, and `vercel-react-best-practices`; Next.js 16 layouts, navigation, cookies, client/server components, Server Actions, forms, Route Handlers, and authentication guides; Supabase server-side token-hash, invitation, local email-template, Auth user, SSR, RLS, and Storage guidance.
- Reference files reused/cleaned/moved/removed: no S02 production dependency remains on `components/ref-files/**`. The direct-Resend examples remain because S02 uses Supabase Auth SMTP for initial invitations and does not own direct application email sending.
- Deferred TODOs added: TODO-012 for S04 employee job summaries and TODO-013 for S06 roster state/upcoming shifts. TODO-002 remains the consumer handoff for `ActiveEmployeeOption`.
- Known limitations: employee job summaries remain owned by S04, and roster state/upcoming shifts remain owned by S06.

### Implementation prompt

```text
Implement S02 Authentication and Employees from FEATURES.md against PRD stories AUTH-02–AUTH-04 and EMP-01–EMP-03.

Build the complete owner-to-employee lifecycle on the verified S01 contracts: login, employee creation, initial invitation, Auth callback, password setup, directory, detail, edit, avatar storage, deactivation/reactivation, RLS, and tests. Publish a small typed active-employee option/display query for later jobs and roster work.

Use the established project-native Supabase clients and inspect the remaining Resend, form, and UI references while cleaning relevant pieces into repository-native modules. Do not implement jobs, roster editing, PWA, templates, schedules, or operational dashboards.

Follow the environment notification rule. Update S02 status, verification notes, checkpoint, reference-code disposition, and TODOs. Finish only after the complete invitation journey and all S02 checks pass.
```

## S03 — Progressive Web App shell

### PRD references

- PWA-01 through PWA-03
- `/manifest.webmanifest` and `/sw.js`
- Sections 8.4 and 10
- Sequential implementation Step 3
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)

### Outcome

The authenticated application can be installed on supported devices and degrades safely as a normal responsive website.

### Tasks

- [x] Add typed `app/manifest.ts`.
- [x] Add 192×192, 512×512, maskable, and Apple touch icons.
- [x] Add minimal same-origin service-worker install/activate lifecycle.
- [x] Register with feature detection and `updateViaCache: "none"`.
- [x] Add standalone detection and non-blocking floating installation guidance across authenticated employee pages.
- [x] Add iOS Share → Add to Home Screen guidance.
- [x] Add global and service-worker-specific security headers.
- [x] Verify Proxy excludes `/sw.js` and `/manifest.webmanifest`.

### Explicit boundary

- [x] No offline application-data caching.
- [x] No offline mutations or background sync.
- [x] No push subscriptions, VAPID keys, or notification permission requests.

### Tests

- [x] Manifest metadata and icon references.
- [x] Service-worker lifecycle, response type, cache headers, and CSP.
- [x] Registration support and failure handling.
- [x] Standalone/install guidance visibility.
- [x] Signed-out standalone `/dashboard` launch.
- [x] Normal application use without service-worker support.

### Completion gate

- [x] Production build exposes valid install resources.
- [x] Auth and PWA routing work together.
- [x] Unsupported browsers retain the complete responsive web experience.

### Reference material

- [x] Used the bundled Next.js 16 Progressive Web App, manifest, and app-icon guidance.
- [x] Used the supplied `public/logo.png` without visual editing; generated only deterministic black-background size and safe-area variants.
- [x] No remaining `components/ref-files/**` file contains relevant PWA behaviour to consume.

### S03 checkpoint

- Commit: Pending; the user has not requested a Git checkpoint commit.
- PRD stories verified: PWA-01 through PWA-03, `/manifest.webmanifest`, `/sw.js`, Proxy exclusions, security headers, and signed-out standalone launch.
- Commands passed: `pnpm check` (`pnpm lint`, `pnpm typecheck`, 43 unit/component tests, 66 database tests, and production build), `pnpm test:e2e` (50 desktop/mobile checks), the complete S03 Playwright suite repeated twice (36 checks), the repaired sidebar persistence journey repeated twice on both projects (4 checks), icon MIME/dimension inspection, and `git diff --check`.
- Project skills and references used: `playwright-best-practices` with service-worker, locator, assertion, and test-structure guidance; `vercel-react-best-practices`; the bundled Next.js 16 Progressive Web App, manifest, and app-icon documentation.
- Shared-step overlap: S03 verification repaired stale S01/S02 Playwright contracts by scoping duplicate navigation locators, waiting for the sidebar cookie before reload, closing the mobile modal before breadcrumb assertions, selecting generated employees by their unique email, and confirming deactivation. The mobile sidebar close trigger also received the missing stacking priority so its visible control owns its pointer target.
- Post-checkpoint refinement during S05: employee install guidance now mounts in the authenticated dashboard layout as a floating viewport card, so it persists across employee pages until dismissed or installed instead of occupying dashboard page content. Its mobile presentation uses equal viewport gutters up to a desktop cap, a vertically centred left-hand install icon, left-aligned copy, and a reduced-motion-safe reminder bounce every 30 seconds.
- Environment variable names changed: none. `.env.example` and `.env.local` require no S03 changes.
- Deferred work: offline employee job data and mutations are now assigned to
  S10. Background-only sync, push subscriptions, and notification permissions
  remain outside V1.

### Implementation prompt

```text
Implement S03 Progressive Web App Shell from FEATURES.md against PRD stories PWA-01–PWA-03 and the bundled Next.js 16 PWA guide.

Add the typed manifest, install icons, Apple touch icon, lifecycle-only service worker, feature-detected registration, standalone/install guidance, iOS instructions, Proxy exclusions, security headers, and tests.

Do not cache authenticated data, Supabase requests, API responses, mutations,
signed asset URLs, or uploaded evidence in S03. Do not implement background
sync, push notifications, or offline product claims here; the approved
IndexedDB-based employee workflow is owned by S10.

Update S03 status, verification notes, checkpoint, and TODOs. Finish only after PWA, Auth-routing, degradation, lint, type-check, test, and build checks pass.
```

## S04 — Owner jobs and Kanban

### PRD references

- JOB-01 through JOB-03
- EDASH-02 (read-only assigned work queue only; execution remains S05)
- Sections 5, 6.5, and `/dashboard/jobs`
- Sequential implementation Step 4

### Outcome

An owner can create, inspect, filter, assign, and reassign jobs through a fixed Unassigned, Assigned, and To review workflow, while employees can see their assigned work ranked by urgency.

### Tasks

- [x] Create jobs and immutable job-update migrations and RLS.
- [x] Implement central state-transition and assignment domain rules.
- [x] Implement owner job creation, editing, and validation.
- [x] Replace employee columns with fixed Unassigned, Assigned, and To review workflow columns.
- [x] Show active and historical assignee identity while excluding invited and inactive assignment targets.
- [x] Add Workflow and single-column Archived filters.
- [x] Preserve keyboard/pointer drag/drop, assignment selection, optimistic update, and rollback behaviour.
- [x] Fill the remaining viewport height, scroll cards within columns, and snap full-width columns on mobile.
- [x] Render employee names rather than membership identifiers in every job assignment Select.
- [x] Record creation, editing, and assignment audit updates.
- [x] Expose job aggregate query contracts needed by the later dashboard step.
- [x] Replace S02 employee-detail placeholders with active and archived job summaries.
- [x] Add an employee-only assigned-jobs list ordered by priority, due time, and recent activity.
- [x] Add the shared private Broadcast invalidation layer for memberships, employee profiles, jobs, job updates, and roster changes.

### Tests

- [x] Job validation and allowed state transitions.
- [x] Workflow status/assignee mapping and archived separation.
- [x] Assignment authorisation and audit history.
- [x] Owner/employee/cross-organisation RLS.
- [x] Assignee identity, assignment selection, optimistic reassignment, cancellation, and rollback.
- [x] Owner creates, edits, validates, filters, and reassigns a job E2E journey.
- [x] Accessible pointer/keyboard drag and mobile assignment-control coverage.
- [x] Viewport-height, mobile snap-width, and selected-assignee label coverage.
- [x] Employee jobs route visibility, urgency ordering, and cross-job isolation.
- [x] Realtime topic authorization, trigger routing, connection recovery, optimistic reconciliation, and multi-session employee/owner updates.

### Completion gate

- [x] Owner job management works without employee execution features.
- [x] The board has accessible non-drag assignment controls.
- [x] No template or schedule behaviour is introduced early.

### S04 checkpoint

- Commit: Pending; the user has not requested a Git checkpoint commit.
- PRD stories verified: JOB-01 through JOB-03 plus the read-only EDASH-02 queue, role-specific `/dashboard/jobs`, immutable create/edit/assignment audit history, assignment permissions, employee summaries, fixed workflow mapping, historical assignee display, Workflow/Archived views, equal desktop column widths, responsive header controls, remaining-viewport column height, mobile full-width snapping, and human-readable assignment controls.
- Commands passed: `pnpm test` (65 unit/component checks), `pnpm lint`, `pnpm typecheck`, `pnpm test:db` (123 pgTAP checks), `pnpm exec supabase db lint --level warning`, focused owner-jobs Playwright coverage (2), isolated full Playwright regression (54 passed and 2 intentional project skips), `pnpm build`, and the single final `pnpm db:reset`.
- Project skills and references used: `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, and `playwright-best-practices`; Next.js 16 server/client component and form guides; React server-serialization and derived-state guidance; Playwright locator, waiting, drag/drop, and mobile guidance; Supabase July 2026 changelog reviewed with no applicable breaking change.
- Migration disposition: no schema change was required; the existing job status, assignment RPC, RLS, audit, Realtime, and roster contracts remain unchanged.
- Reference disposition: consumed the column layout, muted card treatment, sortable grouping, filter controls, optimistic movement, and rollback patterns from `components/ref-files/dashboard-workspace.tsx`; replaced the reference grip treatment with a functional edit action and shadcn form controls, then removed the consumed duplicate. Shared helper references still needed by the future roster/calendar steps remain in place. Production code has only repository-native imports and contracts.
- S04 refinement: the owner board has fixed Unassigned, Assigned, and To review columns; Assigned includes `assigned` and `in_progress`; only employee submission can enter To review; Archived is a separate single-column view matching one Workflow column's desktop width. The owner route establishes the remaining live-viewport height, including the desktop inset margins, while the workspace and columns consume that bounded height and scroll cards internally without document scrolling; mobile columns occupy the board width and snap horizontally. The Workflow/Archived tabs sit left of Create job on desktop and span the row beneath the button on mobile, without a redundant workflow explainer. Cards and every assignment Select show active or inactive historical assignee names rather than membership IDs, while only active employees appear as assignment targets. Card assignment Select values and options present the assignee compactly as `name - title` on one line, use the concise `Unassign` action to return work to the Unassigned queue, and retain stacked presentation for non-interactive historical assignee summaries. The assignment control uses the standard compact Select trigger and option spacing without the temporary padded identity-card treatment. Sortable cards use a full-card drag layer beneath their interactive controls, allowing pointer movement from any non-interactive card area while moving and styling the entire card as one unit. Dropping into Assigned opens a required employee picker, cancellation preserves Unassigned, and pointer/keyboard/mobile assignment paths are verified. This S05 follow-on refinement passes all 74 unit/component checks, lint, type-check, and the isolated two-check owner-jobs Playwright journey. The later viewport-boundary correction passes the focused four-check workspace test, lint, type-check, `git diff --check`, and the isolated no-document-scroll Playwright check on desktop Chromium and Pixel 7; the mutation-heavy owner journey reached and passed the new desktop overflow assertion before its pre-existing Archived-tab refresh race failed later in the flow.
- Employee handoff: active employees can open Jobs from their sidebar and see only currently assigned, non-archived work ordered urgent-to-low, then by due time and recent activity. Start/resume, notes, evidence, submission, and review actions remain S05.
- Realtime foundation: private `org:<organisationId>:operations` and `member:<membershipId>:work` Broadcast topics carry versioned invalidation metadata only. Existing membership, employee-profile, job, job-update, and roster tables publish through a reusable private helper; S05–S09 attach future evidence, review, template, schedule, and dashboard consumers without exposing row payloads.
- Realtime UI: one dashboard-level subscription refreshes authoritative RLS-filtered server data, coalesces event bursts, recovers after reconnect or stale-tab focus, and shows a non-blocking degraded state only after a sustained failure. The Kanban defers refreshed snapshots while optimistic assignments are pending.
- Shared-step overlap: S04's minimal `roster_shifts` table, overlap constraint, and read RLS remain as S06 prerequisites but are no longer queried to arrange the Jobs board. S04 also publishes the shared Realtime topic/event contract for S05–S09. Roster writes, calendar ranges, calendar UI, roster mutation behaviour, and future domain-specific Realtime triggers remain owned by their respective steps.
- Test infrastructure: Playwright now accepts an isolated `PLAYWRIGHT_BASE_URL` port, preventing unrelated development servers from being reused during deterministic verification.
- Environment variable names changed: none. `.env.example` and `.env.local` require no S04 changes. Hosted environments must enforce private Realtime channels in project settings.
- Deferred work: employee execution, evidence, review, and lifecycle actions remain S05; roster views and mutations remain S06/S07; templates and schedules remain S08; dashboard composition remains S09.

### Implementation prompt

```text
Implement S04 Owner Jobs and Kanban from FEATURES.md against PRD stories JOB-01–JOB-03.

Build job and audit schema/RLS, domain transitions, owner creation, fixed Unassigned/Assigned/To review workflow mapping, Workflow/Archived filters, assignment/reassignment with employee selection, accessible alternatives, historical assignee display, and optimistic rollback. Use S02's employee display contract.

Inspect the reference Kanban, actions, queries, and styling first. Preserve useful interaction and visual behaviour while replacing obsolete imports, domain types, permissions, and actions. Do not implement employee notes/evidence/submission, templates, schedules, or dashboards.

Update S04 status, verification notes, checkpoint, reference-code disposition, and TODOs. Finish only after all S04 checks and owner job-management E2E pass.
```

## S05 — Employee job execution and owner review

### PRD references

- JOB-04 through JOB-08
- Sections 6.8, 6.9, and 7
- Sequential implementation Step 5

### Outcome

An employee can complete assigned work with evidence, and the owner can review, discuss, reopen, reassign, and archive it.

### Tasks

- Add private job-evidence storage and policies.
- Implement employee start/resume.
- Implement progress notes and completion photos.
- Accept JPEG, PNG, WebP, HEIC, and HEIF completion photos across the mobile
  picker, server signature validation, Storage bucket, and database contract.
- Optimize evidence photos above 1 MiB before upload, always convert HEIC/HEIF,
  standardize successful results to WebP, cap the long edge at 2,048 pixels,
  target half the source byte size on a best-effort basis, and keep decoder and
  worker code out of the initial job-detail bundle.
- Enforce note and minimum-photo requirements.
- Implement submit-for-review.
- Implement owner job detail, chronological history, evidence, and comments.
- Implement approve/archive and reopen/reassign.
- Preserve history and evidence through reopening.
- Send idempotent Resend notification email to the active job-creator owner
  after each distinct submission without coupling delivery success to the job
  transition.
- Persist owner-visible notification state and allow retry of failed delivery.
- Shared-step overlap: consolidate S02's equivalent owner/self
  `employee_profiles` UPDATE policies into one permissive policy. Allowed rows
  and checks remain unchanged while eliminating duplicate policy evaluation.
- Shared-step overlap: refine S03 install guidance into a floating card mounted
  across the authenticated employee application shell.
- Keep long mobile employee job details vertically scrollable inside the shared
  drawer, including touch panning within the viewport.
- Present job history in a collapsed accordion, initially rendering three
  updates and revealing three more per request.
- Stage employee job details so assigned work presents a Start action before
  revealing completion controls, keep status/priority/description in the
  surface header, keep location and due time side by side with requirements
  beneath, and use borderless accordions for completion, history, and comments.
- Hide employee evidence and history until work starts, omit empty evidence
  galleries, order history newest-first, remove the duplicate employee comment
  composer while preserving owner review comments, centre header badges, and
  visually hide the mobile drawer scrollbar without disabling scrolling.
- Render in-progress work notes, photo upload, and submission controls directly
  in the employee flow without a redundant completion accordion or explainer.
- Centre the location and due-time labels and values in their two-column row.
- Omit the submission-requirements block when neither a completion note nor
  completion photos are required.
- Give the owner review sheet dedicated presentation rules: left-align badges
  and job metadata, show the current assignee, omit employee requirements,
  open history and comments by default with three history entries, and keep
  uncarded owner actions in a fixed sheet footer outside the scroll region.

### Tests

- Start and submission transition rules.
- Evidence type, size, count, and requirement validation.
- Owner/current-assignee comment permissions.
- Evidence and update RLS/storage policies.
- Complete submit, review, reopen, resubmit, and archive E2E journey.
- Mobile viewport job and upload flow.
- Client-side optimization ratio, resolution, orientation, metadata removal,
  fallback behavior, cancellation, and lazy-bundle boundaries.
- Submission email recipient, payload, idempotency, failure persistence, and
  retry without real external delivery.

### Completion gate

- The complete manual job lifecycle passes.
- Evidence remains private and authorised.
- Notes, comments, assets, and system history remain distinct.

### Completion verification

- Phone-native evidence refinement: HEIC and HEIF now pass the mobile picker,
  empty-browser-MIME normalization, server-side ISO-BMFF signature validation,
  private Storage bucket allowlist/path policies, and job-asset constraints.
  AVIF and malformed content remain rejected.
- Migration disposition: the phone-native MIME, extension, bucket, policy, and
  finalization rules are consolidated into the owning S05
  `20260727040756_job_execution_review.sql` migration; no follow-up migration is
  retained for the same workflow.
- Image-optimization verification passed: 96 unit/component checks (including
  21 focused optimizer and job-detail checks), 47 focused S05 pgTAP checks,
  lint, TypeScript, production build, and `git diff --check`. The production
  output emits the pinned `heic-to@1.4.2` decoder as a separate 2.6 MB lazy
  chunk which is absent from the job route's initial client manifest.
- The Chromium Pixel 7 lifecycle uploads a generated large JPEG at no more than
  half its source byte size and a valid primary-still HEIC fixture as WebP,
  asserting the reduced TUS `Upload-Length` and encoded WebP metadata before
  completing submit, review, reopen, resubmit, and archive. The full
  desktop/mobile Playwright run passed 54 checks and skipped three
  project-filtered checks; three unrelated mutation/realtime checks failed
  under parallel shared local state, while the isolated S05 lifecycle passed.
- The prescribed single final local database reset restored canonical seed
  data, after which all 170 pgTAP checks passed.
- Project skills and references used for this refinement:
  `playwright-best-practices` file-upload guidance, `supabase`,
  `supabase-postgres-best-practices`, `vercel-react-best-practices`, the
  bundled Next.js 16 forms guide, and current Supabase Storage bucket/TUS
  documentation. No applicable Storage breaking change was found.
- Environment variable names changed: none.
- Final S05 closure fixed the keyboard drag-assignment/Realtime reconciliation
  race by remounting the drag context only when a job changes workflow columns,
  made overflow and Realtime assertions independent of accumulated seed data,
  and serialised the intentionally shared local Supabase organisation fixture.
- Final verification: lint, TypeScript, 96 unit/component checks, 170 pgTAP
  checks after the canonical reset, production build, three repeated focused
  keyboard assignment journeys, and the complete desktop/mobile Playwright
  suite (57 passed, three intentionally project-filtered checks skipped).
- Checkpoint: `ef897ef`.

### Implementation prompt

```text
Implement S05 Employee Job Execution and Owner Review from FEATURES.md against PRD stories JOB-04–JOB-08.

Extend the verified S04 job contracts with employee start/resume, progress notes, private photo evidence, requirement validation, submission, creator-owner Resend notification, owner review, comments, reopen/reassign, archive, preserved history, RLS, and tests.

Reuse suitable reference action, upload, mutation, and UI patterns while cleaning them into repository-native modules. Do not implement templates, schedules, roster, or dashboards.

Update S05 status, verification notes, checkpoint, reference-code disposition, and TODOs. Finish only after the complete desktop/mobile job journey and all S05 checks pass.
```

## S06 — Roster data and views

### PRD references

- CAL-01, CAL-02, and CAL-04
- Section 6.4 and `/dashboard/roster`
- Sequential implementation Step 6

### Outcome

Owners can view accurate employee week and organisation day rosters, and employees can read their current and upcoming shifts.

### Tasks

- [x] Extend the S04 prerequisite roster-shift schema/RLS with calendar query contracts.
- [x] Add server-side overlap prevention.
- [x] Add organisation-timezone and calendar-range helpers.
- [x] Implement selected-employee seven-day view.
- [x] Implement all-rostered-employees single-day view.
- [x] Implement read-only employee current/upcoming shift query.
- [x] Port and clean calendar layout, slot positioning, responsive styling, and date controls.
- [x] Expose working-now and today-roster aggregates for dashboards.
- [x] Provide owner-only shift creation and exact editing in the employee directory sheet as the accessible form entry point shared with S07.
- [x] Detect and validate the viewer's browser timezone for roster date ranges, labels, positioning, and navigation.
- [x] Show a live current-time line on today, expanding visible hours when needed and updating on minute/visibility boundaries.
- [x] Publish current/upcoming rostered-shift choices to the S04 job form so an owner can schedule a task from the selected employee's roster.

### Tests

- [x] Timezone and date-range calculations.
- [x] Shift overlap prevention.
- [x] Owner/employee/cross-organisation RLS.
- [x] Week/day placement and responsive rendering.
- [x] Employee shift summary.
- [x] Browser-timezone synchronisation and current-line timing.

### Completion gate

- [x] Roster views are viewport-contained and exact employee-sheet forms are correct before direct roster manipulation is added.
- [x] Shifts cannot overlap for the same employee.
- [x] Dashboard aggregate contracts are stable.

### S06 checkpoint

- PRD stories verified: CAL-01, CAL-02, CAL-04, section 6.4, and the owner-only `/dashboard/roster` route.
- Delivered Team day and Employee week route state, safe date/employee fallbacks, Monday–Sunday range loading, mobile single-day snapping and adjacent-week gestures, a sticky time rail/header, fixed readable Team day employee labels, stable accessible colours, overnight clipping, a complete 24-hour grid fitted to the available height, and shift-detail access. Redundant date/timezone metadata is omitted from the page header.
- Roster rendering now detects the viewer's browser IANA timezone, validates it server-side through route state, and uses it consistently for local dates, week boundaries, labels, shift placement, and navigation. The organisation timezone remains the safe initial fallback.
- Added the CAL-04 current-time line ahead of S07: it appears only on the viewer-local today, spans all Team-day lanes or today's Employee-week column, updates at the next minute and on visibility restore, and remains visible within the complete fitted 24-hour day.
- Replaced S02 roster placeholders in the employee directory, profile sheet, employee detail, and employee dashboard with current/upcoming self-scoped summaries.
- Added owner-only, minute-precision shift creation and exact editing beneath the employee-sheet Shifts area. Shift changes remain independent from profile dirty state and saving. Active same-organisation employees are enforced in both the Server Action and RLS; inactive employees remain read-only, overnight shifts are supported, and overlap/stale/invalid errors remain specific and safe.
- Published repository-native `RosterShift`, calendar, lane, summary, working-now, and today-roster contracts. Today totals clip overnight shifts to the requested organisation-local range.
- Cross-step overlap: S06 additively extends the completed S04 job form with
  assignee-filtered rostered-shift choices. The server resolves the selected
  shift inside the active organisation and employee boundary before using its
  start and end as the task schedule and due time; manual job scheduling
  remains supported.
- Migration `20260727105446_roster_calendar_reads.sql` makes archived shifts fail closed in SELECT RLS and adds owner-only INSERT/UPDATE policies and column grants while preserving employee read-only access, database overlap enforcement, and the established organisation boundaries. The existing overlap exclusion and partial organisation/start index were retained; `EXPLAIN` confirmed an index scan for the Team week intersection query, so no redundant index was added.
- Verification passed: lint, type-check, generated Supabase types, 116 unit/component tests, 188 pgTAP checks, production build, and the prior 63 runnable desktop/mobile Playwright suite with 3 intentional mobile skips. A focused desktop/mobile browser regression additionally verifies browser-timezone route state and the visible live line.
- Roster-to-job scheduling verification passed: 8 focused validation/component
  checks, lint, type-check, diff validation, and the 3-check Chromium owner jobs
  journey including assignee-filtered shift selection and manual override.
- Project skills and references used: `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, and `playwright-best-practices`; Next.js 16 page/search-param and client-boundary guidance; current Supabase RLS/query-optimisation guidance; `components/ref-files/roster-calendar.tsx` and `components/ref-files/roster-time.ts`.
- Reference disposition: the useful vertical grid, sticky header/time rail, viewport fill, mobile snapping, and timezone conversion patterns were ported into repository-native roster modules. The reference calendar remains for S07 pointer/optimistic interaction consumption; its unrelated automation/task domain is not imported into production.
- Environment contract: no variables were added, renamed, or removed.

### Implementation prompt

```text
Implement S06 Roster Data and Views from FEATURES.md against PRD stories CAL-01 and CAL-02.

Build roster schema/RLS, overlap protection, timezone helpers, selected-employee week view, all-employees day view, employee shift summary, and dashboard aggregate queries.

Inspect the reference calendar, roster time helpers, and styling first. Preserve useful layout and responsive behaviour while cleaning them into repository-native modules. Do not add drag, resize, copy, templates, scheduling, or dashboards yet.

Update S06 status, verification notes, checkpoint, reference-code disposition, and TODOs. Finish only after roster data, RLS, rendering, lint, type-check, test, and build checks pass.
```

## S07 — Roster interactions

### PRD references

- CAL-03; CAL-04 was completed early in S06
- Sequential implementation Step 7

### Outcome

Owners can manage shifts directly on the roster with precise, safe, and accessible interactions.

### Tasks

- Add slot-based shift creation.
- Add drag, resize, copy, and confirmed delete.
- Snap changes to 15-minute increments.
- Add optimistic updates and rollback.
- Provide non-drag alternatives.

### Tests

- Create, edit, move, resize, copy, and delete.
- Invalid ranges and overlap rejection.
- Optimistic rollback.
- Keyboard-accessible alternatives.
- Complete owner roster-management E2E journey.

### Completion gate

- All roster manipulation works against the S06 server contracts.
- Failed mutations restore the prior visible roster.
- Reference roster code consumed by this step is cleaned or documented for removal.

### Implementation prompt

```text
Implement S07 Roster Interactions from FEATURES.md against PRD story CAL-03 while preserving the completed S06 CAL-04 contract.

Extend the verified S06 roster with direct slot creation, move/resize/copy/delete, 15-minute snapping, optimistic rollback, accessible non-drag controls, and tests. Preserve the exact employee-sheet forms and live current-time indicator already delivered in S06.

Clean and reuse suitable reference calendar interactions and styling without reintroducing obsolete task/automation domain behaviour. Update S07 status, verification notes, checkpoint, reference-code disposition, and TODOs. Finish only after the complete roster-management journey and all S07 checks pass.
```

## S08 — Templates and job schedules

### PRD references

- TPL-01 and TPL-02
- Sections 6.6 and 6.7
- Sequential implementation Step 8

### Outcome

Owners can reuse job definitions and generate daily or weekly jobs exactly once per schedule occurrence.

### Tasks

- Add job template and job schedule migrations and RLS.
- Implement template CRUD and active state.
- Implement template-prefilled manual job creation with overrides.
- Implement daily and weekly schedule CRUD, pause, edit, and delete.
- Implement organisation-timezone occurrence calculation.
- Generate concrete jobs through the existing S04/S05 job contracts.
- Enforce occurrence uniqueness and safe retry.
- Add scheduler failure visibility.

### Tests

- Template defaults and overrides.
- Daily/weekly timezone occurrence calculation.
- Occurrence uniqueness and retry.
- Schedule RLS.
- Exactly-one-job-per-occurrence integration journey.

### Completion gate

- Generated jobs behave exactly like manual jobs.
- Editing schedules changes only future occurrences.
- No advanced recurrence or shift-start triggers are introduced.

### Implementation prompt

```text
Implement S08 Templates and Job Schedules from FEATURES.md against PRD stories TPL-01 and TPL-02.

Build template CRUD, template-prefilled job creation, daily/weekly schedules, timezone-aware occurrences, idempotent concrete-job generation, retry safety, failure visibility, RLS, and tests on top of the verified manual job lifecycle.

Do not add advanced recurrence, shift-start triggers, or notifications. Update S08 status, verification notes, checkpoint, and TODOs. Finish only after exactly-once generation and all S08 checks pass.
```

## S09 — Operational dashboards

### PRD references

- DASH-01, DASH-02, EDASH-01, and EDASH-02
- `/dashboard`
- Sequential implementation Step 9

### Outcome

Owners and employees receive useful role-specific dashboards composed from already verified feature contracts.

### Tasks

- Implement owner operational counts and actionable lists.
- Implement employee current/next shift summary.
- Implement prioritised employee job queue and primary Start/Resume action.
- Link statistics and rows to correct filtered destinations.
- Add timezone-correct labels, empty states, loading states, and failures.
- Verify mobile employee and desktop owner layouts.

### Tests

- Statistic calculations.
- Job priority and due-time ordering.
- Owner/employee role composition.
- Links and filter destinations.
- Desktop and mobile dashboard E2E journeys.

### Completion gate

- Dashboard code composes employee, job, and roster query contracts without duplicating domain rules.
- Role-specific data remains isolated.

### Implementation prompt

```text
Implement S09 Operational Dashboards from FEATURES.md against PRD stories DASH-01, DASH-02, EDASH-01, and EDASH-02.

Compose the verified employee, job, and roster query contracts into role-specific owner and employee dashboards with accurate counts, action lists, priority ordering, timezone formatting, links, empty/loading/error states, responsive behaviour, and tests.

Do not duplicate feature domain rules inside dashboard components. Update S09 status, verification notes, checkpoint, and TODOs. Finish only after desktop/mobile dashboard journeys and all S09 checks pass.
```

## S10 — Offline employee job completion

### PRD references

- PWA-04 through PWA-06
- Sections 6.5, 6.8–6.10, 7, and 8.2–8.4
- Sequential implementation Step 10

### Outcome

Employees can safely read and progress assigned jobs during temporary
connectivity loss, then synchronise acknowledged work exactly once when the
application returns online.

### Tasks

- Add a versioned, membership-scoped IndexedDB schema for the employee work
  pack, operation outbox, and pending photo blobs.
- Persist only assigned/in-progress job data, requirements, relevant notes, and
  canonical job versions; never cache signed evidence URLs.
- Expire work packs 24 hours after the last successful online refresh and add
  the personal-device/device-lock disclosure before offline storage is enabled;
  do not add a separate application PIN in V1.
- Add a generic offline navigation shell without caching authenticated HTML,
  Supabase responses, or mutation responses in CacheStorage.
- Add Offline/last-updated presentation, pending count, Sync now, and
  `pending`, `syncing`, `failed`, and `needs_attention` operation states.
- Queue employee start, progress note, completion photo, and submission request
  operations with permanent client UUIDs and dependency ordering.
- Check available browser storage, request persistence where supported, preserve
  existing evidence limits, and handle quota or persistence denial safely.
- Add `jobs.version` and an organisation-scoped operation-receipt table with a
  unique `(membership_id, client_operation_id)` contract.
- Extend the verified S05 RPCs with job locking, current authorisation checks,
  expected-version handling, atomic audit/asset/receipt writes, and repeated
  result lookup.
- Use deterministic non-overwriting evidence paths and verify current Supabase
  resumable-upload guidance for supported large images.
- Add foreground synchronisation on launch, focus, successful connectivity
  probe, and Sync now; refresh the Supabase session before replay.
- Replay in dependency order and replace optimistic state with canonical server
  responses only after acknowledgement.
- Hold submission until dependent note/photo operations are acknowledged, then
  revalidate evidence requirements server-side.
- Treat repeat start as success, merge authorised notes, and deduplicate photos
  and audit events by operation receipt.
- Stop replay for deactivation, reassignment, archive, or incompatible version
  and retain the unsynchronised local record as Needs attention.
- Purge cached operational data on logout, membership change, and successful
  online confirmation of deactivation.
- Keep owner, review, roster/calendar, employee administration, template, and
  schedule mutations online-only; do not require Background Sync.
- Inspect and either consume or explicitly retain
  `components/ref-files/query-provider.tsx` while implementing repository-native
  query persistence and offline state.

### Tests

- IndexedDB schema upgrades, cache lifetime, membership isolation, and purge.
- Outbox ordering, persistence across reload, retry, and acknowledged cleanup.
- Browser storage availability, quota exhaustion, and persistence denial.
- Unit tests for operation state transitions and typed conflict handling.
- Database tests for job version increments, receipt uniqueness, RLS,
  cross-organisation rejection, and atomic idempotent replay.
- Lost-response retry creates no duplicate note, asset, audit event, submission,
  or owner submission email.
- Playwright employee journey: load online, go offline, reload, start, add note
  and photo, queue submission, return online, and reach review exactly once.
- Playwright Needs attention journeys for reassignment, archive, deactivation,
  and version conflict.
- Mobile viewport, service-worker unavailable, persistent-storage unavailable,
  logout purge, and stale-cache behaviour.
- No arbitrary sleeps; use Playwright network/offline controls, web-first
  assertions, and observable sync state.

### Completion gate

- The employee can complete the approved offline workflow without data loss or
  a false claim of server acknowledgement.
- Replayed operations are authorised, transactional, version-aware, and
  idempotent.
- Cached data is membership-scoped, visibly stale when applicable, and purged at
  defined security boundaries.
- Online owner, employee, evidence, PWA, roster, template, and dashboard
  regressions pass.
- Reference-file disposition, generated types, verification evidence, and TODOs
  are recorded before S11 begins.

### Implementation prompt

```text
Implement S10 Offline Employee Job Completion from FEATURES.md against PRD stories PWA-04–PWA-06.

Build a membership-scoped IndexedDB work pack, operation outbox, pending-photo storage, generic offline shell, visible sync states, foreground/manual sync, job versions, operation receipts, and idempotent transactional Supabase replay for employee start, note, photo, and queued submission.

Use the existing S05 permissions and job lifecycle. Revalidate membership, organisation, assignment, state, evidence, and expected version during replay. Preserve conflicts as Needs attention. Do not cache authenticated responses or signed URLs, do not make owner/roster/admin flows offline, and do not depend on Background Sync.

Inspect components/ref-files/query-provider.tsx and preserve useful persistence patterns in repository-native modules. Use the checked-in Playwright, Supabase, Postgres, and Vercel React skills and the bundled Next.js PWA guide. Update S10 status, generated types, verification notes, checkpoint, reference disposition, and TODOs. Finish only after database, unit/component, desktop/mobile offline Playwright, regression, lint, type-check, and build checks pass.
```

## S11 — Integration and production hardening

### PRD references

- Sections 9–15
- Prototype and production readiness

### Outcome

The complete V1 is verified as one secure, accessible, responsive, deployable product.

### Tasks

- Resolve or explicitly defer every open TODO.
- Reconcile navigation, dependencies, headers, fixtures, and shared UI.
- Regenerate and verify final Supabase types.
- Remove superseded reference duplicates and unresolved reference-only imports.
- Run the complete owner and employee E2E journey.
- Run accessibility and responsive QA.
- Verify RLS, storage, Auth email, scheduler, PWA, and security behaviour.
- Document monitoring, failure visibility, backup, recovery, and deployment checks.
- Perform staging smoke tests.

### Completion gate

- All CI quality gates pass.
- Prototype acceptance is satisfied.
- Production-readiness evidence is recorded.
- Every TODO is resolved or explicitly moved to the PRD's deferred-work section.

### Implementation prompt

```text
Implement S11 Integration and Production Hardening from FEATURES.md and PRD sections 9–15.

Resolve every open cross-step TODO, reconcile navigation/dependencies/headers/fixtures/shared UI, regenerate final Supabase types, remove superseded reference code, complete cross-feature Playwright coverage, run accessibility and responsive QA, and verify staging Auth email, storage, scheduler, PWA, and security behaviour.

Do not silently reduce product scope. Update PRD.md first if a product decision is required. Update S11 status, verification evidence, checkpoint, and TODO resolution. Finish only when all CI gates and prototype/production readiness checks pass.
```

## Deferred integration TODO ledger

### Rules

- Add a TODO as soon as an active step identifies work that belongs to a later step.
- Give every TODO a target step.
- Resolve it when the target step begins, not during unrelated work.
- Do not mark it resolved until the integrated behaviour and relevant regression test pass.
- If resolution changes product behaviour, update `PRD.md` first.

| ID       | Introduced in   | Target step | Deferred work                                                                                                                                                    | Status     | Resolution/checkpoint                                                                                                                       |
| -------- | --------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| TODO-001 | S01             | S09         | Complete final owner/employee navigation after all feature routes exist.                                                                                         | `planned`  | —                                                                                                                                           |
| TODO-002 | S02             | S04/S06     | Consume the shared active-employee option/display query in Jobs and Roster.                                                                                      | `complete` | Jobs consumption completed in S04; S06 now consumes `ActiveEmployeeOption` for employee lanes and the week selector.                        |
| TODO-003 | Schema steps    | S11         | Regenerate and verify final combined Supabase types.                                                                                                             | `planned`  | —                                                                                                                                           |
| TODO-004 | All steps       | S11         | Reconcile final dependencies and remove unused packages.                                                                                                         | `planned`  | —                                                                                                                                           |
| TODO-005 | S04/S06         | S09         | Compose job and roster aggregate queries into dashboards.                                                                                                        | `planned`  | S04 job aggregates and S06 working-now/today-roster contracts are published; dashboard composition remains S09.                             |
| TODO-006 | S01             | S03         | Reconcile root Proxy matcher, standalone dashboard launch, PWA assets, and security headers.                                                                     | `complete` | S03 preserved public matcher exclusions, added install assets/headers, and verified signed-out launch plus the full Auth/PWA browser suite. |
| TODO-007 | All steps       | S11         | Consolidate shared Supabase and Playwright fixtures without weakening isolation.                                                                                 | `planned`  | —                                                                                                                                           |
| TODO-008 | S04/S07         | S11         | Consolidate repeated optimistic mutation, date control, dialog, and upload patterns where reuse is justified.                                                    | `planned`  | S06 established the exact employee-sheet form alternative; S07 still owns optimistic roster manipulation and rollback.                      |
| TODO-009 | S04/S05         | S08         | Ensure generated jobs use the manual job transition, audit, assignment, and evidence contracts.                                                                  | `planned`  | —                                                                                                                                           |
| TODO-010 | All steps       | S11         | Reconcile `.env.example`, runtime validation, deployment variables, and `.env.local` instructions.                                                               | `planned`  | —                                                                                                                                           |
| TODO-011 | S01/S04/S06/S07 | S11         | Remove superseded reference duplicates and verify repository-native production imports.                                                                          | `planned`  | S06 ported roster grid/time patterns without reference imports; S07 still owns pointer and optimistic interaction consumption.              |
| TODO-012 | S02             | S04         | Replace the employee-detail deferred card with active and archived job summaries.                                                                                | `complete` | S04 employee sheet and detail route render active and archived job summaries from the shared query contract.                                |
| TODO-013 | S02             | S06         | Replace employee directory/detail deferred roster states with roster availability and upcoming shifts.                                                           | `complete` | S06 supplies current/upcoming summaries in the directory, profile sheet, detail page, and employee dashboard.                               |
| TODO-014 | S03/S05         | S10         | Extend the install-only PWA and online employee job lifecycle with the approved IndexedDB work pack, outbox, idempotent replay, and offline security boundaries. | `planned`  | S03 deliberately stopped at the installable shell; S05 remains the authoritative online job and evidence contract consumed by S10.          |

### New TODO template

```text
| TODO-XXX | SXX | SXX | Concrete deferred behaviour or shared contract. | `planned` | — |
```

## Checkpoint record template

Add this information to the active step's verification notes before marking it complete:

```text
Checkpoint:
- Commit:
- PRD stories verified:
- Commands passed:
- Database migrations:
- Environment variables changed:
- Project skills and references used:
- Reference files reused/cleaned/moved/removed:
- Deferred TODOs added or resolved:
- Known limitations:
```
