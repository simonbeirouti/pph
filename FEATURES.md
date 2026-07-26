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

| Status | Meaning |
| --- | --- |
| `planned` | Defined but not started |
| `in_progress` | The only step currently being implemented |
| `blocked` | Waiting on a required decision, credential, or external dependency |
| `complete` | Implementation and step-level checks pass |
| `verified` | Confirmed as part of the final integrated V1 journey |

At most one row may be `in_progress`.

## Installed project skills

The following checked-in skills are required parts of development:

| Skill | Required for | Primary steps |
| --- | --- | --- |
| `playwright-best-practices` | Playwright architecture, configuration, fixtures, Auth, mobile, drag/drop, upload, time, PWA, debugging, and CI | S01–S10 |
| `supabase` | Supabase Auth, SSR, clients, CLI, migrations, RLS, Storage, and Cron | S01, S02, S04–S06, S08, S10 |
| `supabase-postgres-best-practices` | Schema, constraints, indexes, RLS performance, queries, locking, and database review | Every schema/query step |
| `vercel-react-best-practices` | React/Next.js rendering, data fetching, server actions, bundle size, and client performance | Every UI step |

For each active step:

1. Read every applicable skill's `SKILL.md` completely.
2. Follow its activity routing and read only the references required for the work.
3. Apply the guidance while preserving PRD behaviour.
4. Record the skills and important references used in the checkpoint notes.

## Implementation status

| Step | Capability | Status | Depends on | Checkpoint | Verification notes |
| --- | --- | --- | --- | --- | --- |
| S00 | Product and implementation baseline | `in_progress` | — | Pending | Sequential PRD/register reframing must be committed before S01 begins |
| S01 | Platform foundation | `planned` | S00 | — | — |
| S02 | Authentication and employees | `planned` | S01 | — | — |
| S03 | Progressive Web App shell | `planned` | S02 | — | — |
| S04 | Owner jobs and Kanban | `planned` | S03 | — | — |
| S05 | Employee job execution and owner review | `planned` | S04 | — | — |
| S06 | Roster data and calendar views | `planned` | S05 | — | — |
| S07 | Calendar interactions | `planned` | S06 | — | — |
| S08 | Templates and job schedules | `planned` | S07 | — | — |
| S09 | Operational dashboards | `planned` | S08 | — | — |
| S10 | Integration and production hardening | `planned` | S09 | — | — |

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

| Surface | Rule |
| --- | --- |
| `PRD.md` | Update first when product behaviour or architecture changes |
| `FEATURES.md` | Update active status, checkpoint, verification notes, and TODOs |
| `AGENTS.md` | Keep durable repository workflow guidance aligned with this plan |
| `.env.example` | Names and safe placeholders only; explicitly notify the user of every change |
| `package.json`, `pnpm-lock.yaml` | Add dependencies only when required by the active step |
| Root `proxy.ts`, `lib/supabase/proxy.ts` | Established in S01; later changes require regression tests |
| `app/layout.tsx`, dashboard shell, navigation | Establish incrementally; avoid placeholders that imply unavailable features work |
| `next.config.ts` | Reconcile Proxy, PWA, and security requirements when S03 changes it |
| Supabase migrations | Append-only after the owning step is complete |
| Generated Supabase types | Regenerate after every schema step and verify again in S10 |
| Shared test fixtures | Extend without weakening prior role or organisation isolation |
| `components/ref-files/**` | Reusable source material; clean and absorb relevant code during the owning step |

## S00 — Product and implementation baseline

### Outcome

The product scope, sequential implementation plan, reference assets, environment contract, and durable agent guidance are committed and recoverable.

### Included

- [`PRD.md`](PRD.md)
- [`FEATURES.md`](FEATURES.md)
- [`AGENTS.md`](AGENTS.md)
- `.env.example`
- Starter UI and `components/ref-files`

### Completion evidence

- Baseline commit exists on `main`.
- Documentation links resolve.
- No feature implementation is represented as complete.

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

- Exclude untouched reference files from production lint and TypeScript scope while keeping them available for inspection.
- Fix starter lint and type-check failures.
- Add Vitest and React Testing Library alongside the already installed `@playwright/test`.
- Configure `playwright.config.ts`, local web-server lifecycle, Chromium development project, mobile project, failure artifacts, deterministic Auth/data fixtures, and test directories according to the Playwright skill.
- Add scripts for lint, type-check, unit tests, database tests, Playwright tests, and production build.
- Create `organisations`, `memberships`, and minimal `employee_profiles` migrations.
- Add representative seed data for owner, invited employee, active employee, and inactive employee states.
- Generate checked-in Supabase types.
- Port Supabase browser, server, admin, and environment helpers into repository-native modules.
- Port the reference Proxy pattern into a thin root `proxy.ts` and `lib/supabase/proxy.ts`.
- Propagate refreshed Supabase cookies through both the request and returned response.
- Implement optimistic signed-out dashboard and signed-in root/login redirects.
- Exclude framework assets, images, `/sw.js`, and `/manifest.webmanifest` from the matcher.
- Add authoritative session, membership, role, status, and organisation helpers.
- Establish the role-aware application shell and protected-route boundaries.

### Tests

- Environment validation.
- Session and permission helpers.
- Proxy cookie propagation and redirects.
- Public Auth route and static/PWA matcher behaviour.
- Membership state and organisation-isolation RLS.
- Signed-out, owner, employee, and inactive-user route behaviour.
- Clean lint, type-check, test, and build commands.
- Playwright configuration, fixtures, user-facing locators, web-first assertions, and failure artifacts.

### Reference material

- `components/ref-files/supabase/browser.ts`
- `components/ref-files/supabase/server.ts`
- `components/ref-files/supabase/admin.ts`
- `components/ref-files/supabase/env.ts`
- `components/ref-files/supabase/proxy.ts`
- `components/ref-files/supabase/root-proxy.ts`
- Existing application shell and sidebar components

### Completion gate

- All foundation checks pass.
- Required environment variables are documented and validated.
- Any `.env.example` changes have been explicitly reported to the user.
- There are no authoritative access decisions implemented only in Proxy.
- Status, checkpoint, verification notes, and TODOs are updated.

### Implementation prompt

```text
Implement S01 Platform Foundation from FEATURES.md against PRD.md.

Work only on S01. Establish clean lint/type/build baselines, test tooling, Supabase local structure, organisations/memberships/minimal employee profiles, generated types, typed clients, environment validation, session and permission helpers, RLS, seeds, and the role-aware application shell.

Read the bundled Next.js 16 Proxy and environment guides first. Clean and port the Supabase reference helpers into repository-native modules. Create one thin root proxy.ts delegating to lib/supabase/proxy.ts, with correct request/response cookie propagation, optimistic redirects, public Auth access, and static/PWA matcher exclusions. Keep authoritative authorisation in the data-access layer and mutations.

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

- Implement owner login against the S01 Auth/session boundary.
- Implement employee creation, validation, directory, filtering, and detail.
- Create pending membership and profile records idempotently.
- Call Supabase Admin invitation and reinvitation.
- Implement Auth confirmation, membership linking, password setup, and activation.
- Implement edit, deactivate, and reactivate behaviour.
- Add private avatar storage, validation, policies, signed URLs, and initials fallback.
- Publish a stable active-employee option/display query for later jobs and roster steps.

### Tests

- Login success and safe failure.
- Duplicate and case-insensitive employee email handling.
- Invitation idempotency, callback, password setup, and activation.
- Inactive-user access.
- Owner/employee/cross-organisation RLS.
- Avatar type, size, path, signed URL, and storage policies.
- Owner creates/invites employee E2E journey.

### Completion gate

- The full invitation-to-activation journey passes.
- Employee permissions do not expose another employee's data.
- Later steps can consume a typed active-employee interface.
- Email is mocked in automated tests.

### Implementation prompt

```text
Implement S02 Authentication and Employees from FEATURES.md against PRD stories AUTH-02–AUTH-04 and EMP-01–EMP-03.

Build the complete owner-to-employee lifecycle on the verified S01 contracts: login, employee creation, invitation/reinvitation, Auth callback, password setup, directory, detail, edit, avatar storage, deactivation/reactivation, RLS, and tests. Publish a small typed active-employee option/display query for later jobs and roster work.

Inspect and reuse relevant reference Supabase, Resend, form, and UI code while cleaning it into repository-native modules. Do not implement jobs, roster editing, PWA, templates, schedules, or operational dashboards.

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

- Add typed `app/manifest.ts`.
- Add 192×192, 512×512, maskable, and Apple touch icons.
- Add minimal same-origin service-worker install/activate lifecycle.
- Register with feature detection and `updateViaCache: "none"`.
- Add standalone detection and non-blocking installation guidance.
- Add iOS Share → Add to Home Screen guidance.
- Add global and service-worker-specific security headers.
- Verify Proxy excludes `/sw.js` and `/manifest.webmanifest`.

### Explicit boundary

- No offline application-data caching.
- No offline mutations or background sync.
- No push subscriptions, VAPID keys, or notification permission requests.

### Tests

- Manifest metadata and icon references.
- Service-worker lifecycle, response type, cache headers, and CSP.
- Registration support and failure handling.
- Standalone/install guidance visibility.
- Signed-out standalone `/dashboard` launch.
- Normal application use without service-worker support.

### Completion gate

- Production build exposes valid install resources.
- Auth and PWA routing work together.
- Unsupported browsers retain the complete responsive web experience.

### Implementation prompt

```text
Implement S03 Progressive Web App Shell from FEATURES.md against PRD stories PWA-01–PWA-03 and the bundled Next.js 16 PWA guide.

Add the typed manifest, install icons, Apple touch icon, lifecycle-only service worker, feature-detected registration, standalone/install guidance, iOS instructions, Proxy exclusions, security headers, and tests.

Do not cache authenticated data, Supabase requests, API responses, mutations, signed asset URLs, or uploaded evidence. Do not implement background sync, push notifications, or offline product claims.

Update S03 status, verification notes, checkpoint, and TODOs. Finish only after PWA, Auth-routing, degradation, lint, type-check, test, and build checks pass.
```

## S04 — Owner jobs and Kanban

### PRD references

- JOB-01 through JOB-03
- Sections 5, 6.5, and `/dashboard/jobs`
- Sequential implementation Step 4

### Outcome

An owner can create, inspect, filter, assign, and reassign jobs through the employee-column board.

### Tasks

- Create jobs and immutable job-update migrations and RLS.
- Implement central state-transition and assignment domain rules.
- Implement owner job creation and validation.
- Implement Unassigned, working-now, rostered-today, and remaining-employee column ordering.
- Add Active, Review, and Archived filters.
- Port and clean Kanban styling, drag/drop, optimistic update, and rollback behaviour.
- Record creation and assignment audit updates.
- Expose job aggregate query contracts needed by the later dashboard step.

### Tests

- Job validation and allowed state transitions.
- Employee-column ordering.
- Assignment authorisation and audit history.
- Owner/employee/cross-organisation RLS.
- Optimistic reassignment and rollback.
- Owner creates and reassigns a job E2E journey.

### Completion gate

- Owner job management works without employee execution features.
- The board has accessible non-drag assignment controls.
- No template or schedule behaviour is introduced early.

### Implementation prompt

```text
Implement S04 Owner Jobs and Kanban from FEATURES.md against PRD stories JOB-01–JOB-03.

Build job and audit schema/RLS, domain transitions, owner creation, filters, employee-column ordering, assignment/reassignment, accessible alternatives, and optimistic rollback. Use S02's employee display contract.

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
- Enforce note and minimum-photo requirements.
- Implement submit-for-review.
- Implement owner job detail, chronological history, evidence, and comments.
- Implement approve/archive and reopen/reassign.
- Preserve history and evidence through reopening.

### Tests

- Start and submission transition rules.
- Evidence type, size, count, and requirement validation.
- Owner/current-assignee comment permissions.
- Evidence and update RLS/storage policies.
- Complete submit, review, reopen, resubmit, and archive E2E journey.
- Mobile viewport job and upload flow.

### Completion gate

- The complete manual job lifecycle passes.
- Evidence remains private and authorised.
- Notes, comments, assets, and system history remain distinct.

### Implementation prompt

```text
Implement S05 Employee Job Execution and Owner Review from FEATURES.md against PRD stories JOB-04–JOB-08.

Extend the verified S04 job contracts with employee start/resume, progress notes, private photo evidence, requirement validation, submission, owner review, comments, reopen/reassign, archive, preserved history, RLS, and tests.

Reuse suitable reference action, upload, mutation, and UI patterns while cleaning them into repository-native modules. Do not implement templates, schedules, roster, or dashboards.

Update S05 status, verification notes, checkpoint, reference-code disposition, and TODOs. Finish only after the complete desktop/mobile job journey and all S05 checks pass.
```

## S06 — Roster data and calendar views

### PRD references

- CAL-01 and CAL-02
- Section 6.4 and `/dashboard/calendar`
- Sequential implementation Step 6

### Outcome

Owners can view accurate employee week and organisation day rosters, and employees can read their current and upcoming shifts.

### Tasks

- Create roster shift migration and RLS.
- Add server-side overlap prevention.
- Add organisation-timezone and calendar-range helpers.
- Implement selected-employee seven-day view.
- Implement all-rostered-employees single-day view.
- Implement read-only employee current/upcoming shift query.
- Port and clean calendar layout, slot positioning, responsive styling, and date controls.
- Expose working-now and today-roster aggregates for dashboards.

### Tests

- Timezone and date-range calculations.
- Shift overlap prevention.
- Owner/employee/cross-organisation RLS.
- Week/day placement and responsive rendering.
- Employee shift summary.

### Completion gate

- Read-only roster views are correct before direct manipulation is added.
- Shifts cannot overlap for the same employee.
- Dashboard aggregate contracts are stable.

### Implementation prompt

```text
Implement S06 Roster Data and Calendar Views from FEATURES.md against PRD stories CAL-01 and CAL-02.

Build roster schema/RLS, overlap protection, timezone helpers, selected-employee week view, all-employees day view, employee shift summary, and dashboard aggregate queries.

Inspect the reference calendar, roster time helpers, and styling first. Preserve useful layout and responsive behaviour while cleaning them into repository-native modules. Do not add drag, resize, copy, templates, scheduling, or dashboards yet.

Update S06 status, verification notes, checkpoint, reference-code disposition, and TODOs. Finish only after roster data, RLS, rendering, lint, type-check, test, and build checks pass.
```

## S07 — Calendar interactions

### PRD references

- CAL-03 and CAL-04
- Sequential implementation Step 7

### Outcome

Owners can manage shifts directly on the calendar with precise, safe, and accessible interactions.

### Tasks

- Add slot-based shift creation.
- Add exact edit form.
- Add drag, resize, copy, and confirmed delete.
- Snap changes to 15-minute increments.
- Add optimistic updates and rollback.
- Add current-time indicator with minute updates.
- Provide non-drag alternatives.

### Tests

- Create, edit, move, resize, copy, and delete.
- Invalid ranges and overlap rejection.
- Optimistic rollback.
- Current-time visibility and positioning.
- Keyboard-accessible alternatives.
- Complete owner roster-management E2E journey.

### Completion gate

- All calendar manipulation works against the S06 server contracts.
- Failed mutations restore the prior visible roster.
- Reference calendar code consumed by this step is cleaned or documented for removal.

### Implementation prompt

```text
Implement S07 Calendar Interactions from FEATURES.md against PRD stories CAL-03 and CAL-04.

Extend the verified S06 calendar with create/edit/move/resize/copy/delete, 15-minute snapping, optimistic rollback, current-time indicator, accessible non-drag controls, and tests.

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

## S10 — Integration and production hardening

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
Implement S10 Integration and Production Hardening from FEATURES.md and PRD sections 9–15.

Resolve every open cross-step TODO, reconcile navigation/dependencies/headers/fixtures/shared UI, regenerate final Supabase types, remove superseded reference code, complete cross-feature Playwright coverage, run accessibility and responsive QA, and verify staging Auth email, storage, scheduler, PWA, and security behaviour.

Do not silently reduce product scope. Update PRD.md first if a product decision is required. Update S10 status, verification evidence, checkpoint, and TODO resolution. Finish only when all CI gates and prototype/production readiness checks pass.
```

## Deferred integration TODO ledger

### Rules

- Add a TODO as soon as an active step identifies work that belongs to a later step.
- Give every TODO a target step.
- Resolve it when the target step begins, not during unrelated work.
- Do not mark it resolved until the integrated behaviour and relevant regression test pass.
- If resolution changes product behaviour, update `PRD.md` first.

| ID | Introduced in | Target step | Deferred work | Status | Resolution/checkpoint |
| --- | --- | --- | --- | --- | --- |
| TODO-001 | S01 | S09 | Complete final owner/employee navigation after all feature routes exist. | `planned` | — |
| TODO-002 | S02 | S04/S06 | Consume the shared active-employee option/display query in Jobs and Roster. | `planned` | — |
| TODO-003 | Schema steps | S10 | Regenerate and verify final combined Supabase types. | `planned` | — |
| TODO-004 | All steps | S10 | Reconcile final dependencies and remove unused packages. | `planned` | — |
| TODO-005 | S04/S06 | S09 | Compose job and roster aggregate queries into dashboards. | `planned` | — |
| TODO-006 | S01 | S03 | Reconcile root Proxy matcher, standalone dashboard launch, PWA assets, and security headers. | `planned` | — |
| TODO-007 | All steps | S10 | Consolidate shared Supabase and Playwright fixtures without weakening isolation. | `planned` | — |
| TODO-008 | S04/S07 | S10 | Consolidate repeated optimistic mutation, date control, dialog, and upload patterns where reuse is justified. | `planned` | — |
| TODO-009 | S04/S05 | S08 | Ensure generated jobs use the manual job transition, audit, assignment, and evidence contracts. | `planned` | — |
| TODO-010 | All steps | S10 | Reconcile `.env.example`, runtime validation, deployment variables, and `.env.local` instructions. | `planned` | — |
| TODO-011 | S01/S04/S06/S07 | S10 | Remove superseded reference duplicates and verify repository-native production imports. | `planned` | — |

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
