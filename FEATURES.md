# Employee Operations Dashboard — Feature Branch Registry

## Purpose

This file turns [`PRD.md`](PRD.md) into executable development branches. It is the operational register for:

- feature ownership and branch names;
- dependency and merge order;
- ready-to-use Codex task prompts;
- tests and definition of done;
- shared-file overlap;
- cross-feature integration TODOs.

`PRD.md` remains the product and architecture source of truth. This file must not redefine product behaviour. If implementation needs a product decision, update the PRD first and link the resulting story or section here.

## How to use this registry

1. Start a Codex Worktree task from the branch listed under **Base**.
2. Paste the feature's task prompt into that task.
3. Create the listed `codex/...` branch in the worktree.
4. Change the feature status to `in_progress` and add the Codex task or PR link when available.
5. Implement the database, permissions, server behaviour, UI, and tests for the feature as one working vertical slice.
6. Add any cross-branch conflict or deferred integration to the integration ledger before finishing the branch.
7. Change the status to `ready_for_review` only after its required checks pass.
8. Merge features in dependency order and resolve integration TODOs in the designated integration branch.

## Status values

| Status | Meaning |
| --- | --- |
| `planned` | Scoped but not started |
| `blocked` | Cannot proceed until a named dependency or decision is resolved |
| `in_progress` | Active implementation |
| `ready_for_review` | Implementation and branch-level tests pass |
| `merged` | Merged into the current integration base |
| `verified` | Integrated end-to-end behaviour passes |

## Branch registry

| ID | Feature | Branch | Base | Depends on | Status | Task/PR |
| --- | --- | --- | --- | --- | --- | --- |
| F00 | Main baseline and coordination | `main` | — | — | `in_progress` | Current task |
| F01 | Platform foundation | `codex/platform-foundation` | `main` | F00 | `planned` | — |
| F02 | Authentication and employees | `codex/employees-auth` | `codex/platform-foundation` | F01 | `planned` | — |
| F03 | Manual jobs workflow | `codex/jobs-workflow` | `codex/platform-foundation` | F01; integrates F02 | `planned` | — |
| F04 | Roster and calendar | `codex/roster-calendar` | `codex/platform-foundation` | F01; integrates F02 | `planned` | — |
| F05 | PWA application shell | `codex/pwa-shell` | `codex/platform-foundation` | F01 | `planned` | — |
| F06 | Templates and job schedules | `codex/job-scheduling` | Integrated F03 branch | F03 | `planned` | — |
| F07 | Operational dashboards | `codex/operational-dashboards` | Feature integration branch | F02, F03, F04 | `planned` | — |
| F08 | Integration and production hardening | `codex/integration-hardening` | Feature integration branch | F02–F07 | `planned` | — |

F02, F03, F04, and F05 may run in parallel after F01. F03 and F04 must use the membership contract from F01 and record employee-profile display integration with F02 rather than duplicating employee management.

The **feature integration branch** is a temporary branch created from F01 after the parallel branches are ready. Merge F02–F05 into it one at a time, run combined checks after each merge, then use that updated branch as the base for F06 and F07. F08 becomes the final integration branch before changes return to `main`.

## Shared ownership rules

### Protected shared surfaces

| Surface | Primary owner | Rule |
| --- | --- | --- |
| `PRD.md` | F00/integration owner | Product decisions and acceptance criteria only |
| `FEATURES.md` | Every active feature | Update only the relevant feature row and integration ledger |
| `AGENTS.md` | F01/integration owner | Durable repository workflow rules |
| `package.json`, `pnpm-lock.yaml` | F01 initially; then feature adding dependency | Record dependency overlap in the ledger |
| `app/layout.tsx`, dashboard shell, navigation | F01 | Feature branches expose route/nav requirements; integration owner combines them |
| `next.config.ts` | F05 | Other security or runtime changes must be logged for integration |
| `app/globals.css` | F01/integration owner | Prefer component-local utility classes; log global token changes |
| Supabase migrations | Creating feature | Add new immutable migrations; never edit another merged migration |
| Generated Supabase types | F01 during foundation; F08 for final generation | Feature branches may regenerate locally but integration owns the final combined file |
| Shared Playwright fixtures | F01/F08 | Features may extend without changing another role's semantics |
| `components/ref-files/**` | Nobody | Read-only reference; never import directly into production |

### Branch completion rules

Every feature branch must:

- reference the applicable PRD story IDs in its PR or final task summary;
- contain no unresolved TypeScript or lint errors introduced by the branch;
- include unit/component tests for domain and UI behaviour;
- include database/RLS tests when it changes Supabase;
- include at least one critical Playwright path for user-visible behaviour;
- document environment variables and setup changes;
- avoid real email, push, or other external side effects in automated tests;
- update the integration ledger for every known overlap;
- leave unrelated user changes untouched.

## F00 — Main baseline and coordination

### PRD references

- Development control
- Sections 1, 11, 12, and 13

### Outcome

Maintain a clean, committed starting point containing the starter application, PRD, feature registry, and repository guidance. No product feature is implemented directly on `main`.

### Tasks

- Keep `PRD.md` authoritative and current.
- Maintain this branch registry and integration ledger.
- Ensure intended starter and reference files are committed.
- Define the branch base used by F01.
- Do not merge partially complete feature branches.

### Required checks

- Documentation links resolve.
- `git status` contains only intentional coordination-document changes before commit.

## F01 — Platform foundation

### PRD references

- AUTH-01
- Sections 2, 6.1–6.3, 8, 11, and Phase 1

### Owned scope

- Clean TypeScript and ESLint baseline, excluding untouched reference files.
- Vitest, Testing Library, Playwright, and Supabase local test structure.
- `organisations`, `memberships`, and minimal `employee_profiles` schema contracts.
- Supabase browser, server, and admin clients.
- Session loading, active membership, role, and organisation permission helpers.
- Next.js 16 `proxy.ts` for cookie refresh and optimistic redirects.
- Role-aware application shell and protected-route boundaries.
- Shared action-result, validation, date/time, and test-fixture conventions.
- Seeded owner and representative invited/active/inactive employee memberships.

### Excluded scope

- Invitation delivery and employee management UI.
- Jobs, roster shifts, templates, schedules, and dashboards.
- PWA manifest and service worker.

### Tests

- Session and permission unit tests.
- Organisation-isolation and membership-state RLS tests.
- Signed-out, owner, employee, and inactive-user route tests.
- Clean lint, type-check, build, and baseline test commands.

### Shared overlap to record

- Final application navigation items.
- Generated database types after feature migrations.
- Package-lock changes from later test or UI dependencies.

### Codex task prompt

```text
Implement feature F01 Platform Foundation from FEATURES.md against PRD.md.

Deliver only the foundation scope: clean quality baselines, test tooling, Supabase local setup, organisations/memberships/minimal employee profile contracts, typed clients, session and permission helpers, proxy-based cookie refresh and optimistic redirects, role-aware app shell, seeds, RLS, and foundation tests.

Read the relevant Next.js 16 guides in node_modules/next/dist/docs before using framework APIs. Treat components/ref-files as read-only reference and exclude untouched files from production checks. Do not implement employee invitations, jobs, roster, PWA, templates, schedules, or dashboards.

Update the F01 registry status and record every shared-file or future-feature overlap in the integration ledger. Done means lint, type-check, unit tests, database tests, Playwright foundation tests, and production build pass.
```

## F02 — Authentication and employees

### PRD references

- AUTH-02 through AUTH-04
- EMP-01 through EMP-03
- `/auth/confirm`, `/set-password`, and `/dashboard/employees`
- Sections 6.2, 6.3, 7, 8.2, 8.3, and Phase 2

### Owned scope

- Employee creation, editing, search, filtering, detail, and status management.
- Supabase Admin invitation and reinvitation.
- Invitation confirmation, membership linking, password setup, and activation.
- Resend-backed Supabase Auth SMTP contract and mocked test boundary.
- Private avatar bucket, validation, storage policies, and signed URLs.
- Deactivation/reactivation access behaviour.
- Employee directory and detail pages.

### Excluded scope

- Public owner signup.
- Job assignment UI and job history implementation.
- Roster editing.
- Non-Auth application email.

### Tests

- Invitation idempotency and duplicate-email validation.
- Invite callback, password setup, active/inactive access.
- Owner and employee RLS boundaries.
- Avatar type, size, path, signed URL, and policy tests.
- Owner creates/invites employee Playwright journey.

### Integration TODO triggers

- Expose a stable active-employee option view model for F03 and F04.
- Provide employee photo/name display primitives without requiring feature branches to query profile tables directly.
- Leave dashboard job/shift panels as integration placeholders.

### Codex task prompt

```text
Implement feature F02 Authentication and Employees from FEATURES.md against PRD stories AUTH-02–AUTH-04 and EMP-01–EMP-03.

Build the complete owner-to-employee activation slice: employee records, invitation/reinvitation, Auth callback, password setup, directory, detail, profile edit, avatar storage, deactivation/reactivation, RLS, and tests. Use the F01 membership and permission contracts without redesigning the shared foundation.

Expose a small typed employee option/display interface for jobs and roster integration. Do not implement jobs, roster editing, templates, schedules, PWA, or dashboards beyond necessary placeholders. Mock outbound email in tests.

Update F02 status and the integration ledger. Done means lint, type-check, relevant unit/component tests, Supabase tests, the critical invitation Playwright journey, and production build pass.
```

## F03 — Manual jobs workflow

### PRD references

- JOB-01 through JOB-08
- Sections 5, 6.5, 6.8, 6.9, and `/dashboard/jobs`
- Phase 4

### Owned scope

- Jobs, job updates, and job assets schema and RLS.
- Central job transition and evidence-validation domain functions.
- Owner job creation and employee-column Kanban.
- Active, Review, and Archived filters.
- Drag-to-reassign with optimistic rollback.
- Employee start/resume, notes, evidence upload, and review submission.
- Owner comments, review, reopen/reassign, and archive.
- Private job-evidence storage and signed URLs.

### Excluded scope

- Job templates and automatic schedules.
- Dashboard aggregates outside job-specific query helpers.
- Push or assignment email notifications.

### Tests

- Job state-transition and evidence-requirement unit tests.
- Board ordering and optimistic rollback component tests.
- Owner/assignee/cross-organisation RLS tests.
- Evidence limits and storage-policy tests.
- Owner creates/assigns and employee submits/owner reviews Playwright journeys.

### Integration TODO triggers

- Consume F02's employee option/display interface when available.
- Expose stable outstanding, urgent, and review aggregate queries for F07.
- Record navigation and shared upload-component needs.

### Codex task prompt

```text
Implement feature F03 Manual Jobs Workflow from FEATURES.md against PRD stories JOB-01–JOB-08.

Deliver the complete working manual lifecycle: schema, RLS, transition rules, owner creation and employee-column board, drag reassignment, employee start/notes/photos/submission, owner review/comments/reopen/archive, private evidence storage, optimistic rollback, and tests.

Base authorisation on F01 membership contracts. Use an adapter or fixture for employee display data until F02 is integrated; do not duplicate employee administration. Do not implement templates, recurring schedules, push notifications, or operational dashboard UI.

Treat components/ref-files as reference only. Update F03 status and record F02, navigation, generated-type, upload, and dashboard overlaps in the integration ledger. Done means all branch quality gates and critical Playwright journeys pass.
```

## F04 — Roster and calendar

### PRD references

- CAL-01 through CAL-04
- Section 6.4 and `/dashboard/calendar`
- Phase 5

### Owned scope

- Roster shift schema, RLS, and overlap protection.
- Employee week and organisation day queries and views.
- Shift creation, exact editing, move, resize, copy, and confirmed deletion.
- Fifteen-minute interaction grid and optimistic rollback.
- Organisation-timezone calculations and current-time indicator.
- Read-only current/upcoming shift query for employee dashboards.

### Excluded scope

- Availability, leave, timesheets, clock-in/out, and payroll.
- Job scheduling or shift-triggered job creation.
- Operational dashboard composition.

### Tests

- Timezone and overlap domain tests.
- Database overlap and RLS tests.
- Calendar placement, drag/resize, and current-time component tests.
- Owner shift-management Playwright journey.

### Integration TODO triggers

- Consume F02's employee option/display interface when available.
- Expose stable working-now and today-roster aggregate queries for F07.
- Record navigation, date-control, and global styling overlap.

### Codex task prompt

```text
Implement feature F04 Roster and Calendar from FEATURES.md against PRD stories CAL-01–CAL-04.

Deliver roster schema and RLS, overlap protection, selected-employee week view, all-employees day view, create/edit/move/resize/copy/delete interactions, 15-minute precision, optimistic rollback, timezone handling, current-time indicator, employee read-only shift query, and tests.

Use F01 membership contracts and an adapter or fixture for employee display data until F02 integration. Do not implement availability, leave, timesheets, payroll, job scheduling, or dashboards.

Port concepts from components/ref-files only into repository-native code. Update F04 status and integration TODOs. Done means all branch quality gates and the roster Playwright journey pass.
```

## F05 — PWA application shell

### PRD references

- PWA-01 through PWA-03
- `/manifest.webmanifest` and `/sw.js`
- Sections 8.4, 10, 11, and Phase 3
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)

### Owned scope

- Typed `app/manifest.ts`.
- 192×192, 512×512, maskable, and Apple touch icons.
- Minimal same-origin service worker lifecycle.
- Feature-detected client registration with `updateViaCache: "none"`.
- Install/standalone detection and non-blocking install guidance.
- iOS Add to Home Screen guidance.
- Global and service-worker-specific security headers in `next.config.ts`.
- HTTPS installability documentation and tests.

### Explicit V1 boundary

- No offline application-data caching.
- No offline job, roster, evidence, or mutation support.
- No background sync.
- No push subscriptions, VAPID keys, or notification permission prompts.

### Tests

- Manifest metadata and referenced asset tests.
- Standalone and unsupported-browser component tests.
- Registration success and failure tests.
- `/sw.js` content type, cache control, CSP, and lifecycle tests.
- Playwright smoke test confirming normal use without service-worker support.
- Staging installability check over HTTPS.

### Integration TODO triggers

- Mount registration and install guidance in the F01 application shell.
- Reconcile `next.config.ts` with any security headers introduced elsewhere.
- Ensure auth redirects and `/dashboard` start URL behave correctly when launched standalone.

### Codex task prompt

```text
Implement feature F05 PWA Application Shell from FEATURES.md against PRD stories PWA-01–PWA-03 and the bundled Next.js 16 progressive-web-apps guide.

Add the typed manifest, required install icons, Apple touch icon, minimal lifecycle-only service worker, safe feature-detected registration, standalone/install guidance including iOS instructions, security headers, and tests.

Do not implement offline application-data caching, background sync, push subscriptions, VAPID keys, notifications, or any claim that authenticated data works offline. Never cache Supabase requests, API responses, mutations, signed asset URLs, or uploaded evidence.

Integrate only with the F01 shell and record every app layout or next.config overlap. Update F05 status and the integration ledger. Done means lint, type-check, PWA unit/component tests, Playwright degradation smoke test, production build, and documented HTTPS staging verification pass.
```

## F06 — Templates and job schedules

### PRD references

- TPL-01 and TPL-02
- Sections 6.6 and 6.7
- Phase 6

### Owned scope

- Job template CRUD and activation state.
- Template-prefilled manual job creation.
- Daily and weekly schedule CRUD and pause/resume.
- Timezone-aware occurrence calculation.
- Idempotent concrete-job generation and retry safety.
- Scheduler failure visibility.

### Dependencies

- Must start from the integrated F03 manual job workflow.
- Uses F02 employee selection after integration.

### Tests

- Recurrence calculation and timezone unit tests.
- Occurrence uniqueness and RLS database tests.
- Template override component tests.
- Exactly-one-job-per-occurrence Playwright or integration test.

### Codex task prompt

```text
Implement feature F06 Templates and Job Schedules from FEATURES.md against PRD stories TPL-01 and TPL-02.

Start from the integrated manual job workflow. Deliver template management, template-prefilled job creation, daily/weekly schedules, pause/edit/delete behaviour, timezone-aware occurrences, idempotent generation, retry safety, scheduler visibility, RLS, and tests.

Do not add advanced recurrence, shift-start triggers, or notifications. Update F06 status and integration TODOs. Done means all branch quality gates and the exactly-once occurrence scenario pass.
```

## F07 — Operational dashboards

### PRD references

- DASH-01, DASH-02, EDASH-01, and EDASH-02
- `/dashboard`
- Sections 3.2, 3.3, and 13

### Owned scope

- Owner statistics and actionable lists.
- Employee shift summary and prioritised personal work queue.
- Organisation-timezone display.
- Empty, loading, and failure states.
- Links into integrated employee, job, and roster features.

### Dependencies

- Starts only after F02, F03, and F04 are integrated.
- Consumes feature-owned aggregate query interfaces rather than duplicating their domain logic.

### Tests

- Statistic calculation and priority ordering unit tests.
- Owner/employee role composition tests.
- Dashboard link/filter Playwright tests at desktop and mobile sizes.

### Codex task prompt

```text
Implement feature F07 Operational Dashboards from FEATURES.md against PRD stories DASH-01, DASH-02, EDASH-01, and EDASH-02.

Start from integrated Employees, Jobs, and Roster features. Compose their stable aggregate queries into role-specific owner and employee dashboards with timezone-correct values, actionable links, empty/loading/error states, responsive behaviour, and tests.

Do not reimplement job, employee, or roster domain rules inside dashboard components. Update F07 status and integration TODOs. Done means all branch quality gates and desktop/mobile dashboard journeys pass.
```

## F08 — Integration and production hardening

### PRD references

- Sections 9–15
- Prototype and production readiness

### Owned scope

- Merge and resolve every open integration TODO.
- Reconcile navigation, shared types, dependencies, headers, fixtures, and migrations.
- Regenerate final Supabase types.
- Run complete owner and employee Playwright journeys.
- Responsive and accessibility QA.
- RLS, storage, email, PWA, scheduler, and staging verification.
- Monitoring, failure visibility, and deployment documentation.

### Tests

- All CI quality gates.
- Full critical journey suite.
- Cross-feature reassignment, dashboard, roster, scheduling, and PWA checks.
- Desktop and mobile viewport suites.
- Staging smoke test.

### Codex task prompt

```text
Implement feature F08 Integration and Production Hardening from FEATURES.md and PRD sections 9–15.

Start from the latest branch containing F02–F07. Resolve every open integration TODO, reconcile shared navigation/types/dependencies/headers/fixtures/migrations, regenerate final Supabase types, complete cross-feature Playwright coverage, run accessibility and responsive QA, and verify staging email, storage, scheduler, PWA, and security behaviour.

Do not silently change product scope to make integration easier. Update PRD.md first if a product decision is required. Done means every integration TODO is resolved or explicitly deferred in PRD.md, all CI gates pass, and prototype/production readiness evidence is recorded.
```

## Integration TODO ledger

### Rules

- Add an entry as soon as a feature knowingly touches or depends on another feature's contract.
- The feature that discovers the overlap owns documenting it; the Integration owner owns final resolution unless another owner is named.
- Do not mark an item resolved until the merged implementation and relevant cross-feature test pass.
- If resolution changes product behaviour, link the updated PRD story.

| ID | Introduced by | Affects | Integration work | Owner | Status | Resolution/PR |
| --- | --- | --- | --- | --- | --- | --- |
| INT-001 | F01 | F02–F07 | Combine final owner/employee navigation after feature routes exist. | F08 | `planned` | — |
| INT-002 | F02 | F03, F04 | Replace employee fixtures/adapters with the shared active-employee option and display interface. | F08 | `planned` | — |
| INT-003 | F02–F06 | All database features | Regenerate and verify final Supabase types after all migrations merge. | F08 | `planned` | — |
| INT-004 | F01–F06 | All features | Reconcile `package.json` and `pnpm-lock.yaml` dependency additions and remove duplicates. | F08 | `planned` | — |
| INT-005 | F03, F04 | F07 | Integrate job and roster aggregate queries into role-specific dashboards. | F07 | `planned` | — |
| INT-006 | F05 | F01, F08 | Mount PWA registration/install guidance in the final shell and reconcile `next.config.ts` security headers. | F08 | `planned` | — |
| INT-007 | F01–F07 | Test suite | Merge shared Supabase and Playwright fixtures without weakening role isolation. | F08 | `planned` | — |
| INT-008 | F03, F04 | Shared UI | Reconcile optimistic mutation, date control, dialog, and upload patterns where reuse is justified. | F08 | `planned` | — |
| INT-009 | F05 | Auth | Verify standalone `/dashboard` launch respects signed-out redirects and invite/password routes remain browser-accessible. | F08 | `planned` | — |
| INT-010 | F03, F06 | Jobs | Confirm generated jobs use the same transition, audit, assignment, and evidence contracts as manual jobs. | F06 | `planned` | — |

### New integration TODO template

Copy this row and allocate the next identifier:

```text
| INT-XXX | FXX | FXX, FXX | Concrete overlapping contract or merge work. | FXX/F08 | `planned` | — |
```

## Merge order

1. F00 main baseline and coordination
2. F01 platform foundation
3. F02, F03, F04, and F05 feature branches
4. F06 templates and schedules after F03
5. F07 dashboards after F02, F03, and F04
6. F08 integration and hardening

When parallel branches finish at different times, merge one at a time into a temporary integration branch, run the combined quality gates, and update the remaining branches from that new base. Do not use a partially integrated branch as the base for unrelated new work.
