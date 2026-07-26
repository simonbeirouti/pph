# Employee Operations Dashboard V1

## Document status

- Status: Approved for implementation
- Version: 1.6
- Last updated: 26 July 2026
- Product timezone default: Australia/Melbourne
- Technical stack: Next.js 16, TypeScript, Supabase, Resend, Tailwind CSS, shadcn/ui, Playwright

### Development control

This PRD is the central source of truth for product scope, behaviour, acceptance criteria, architecture, and delivery readiness.

- [`FEATURES.md`](FEATURES.md) converts this PRD into one ordered implementation sequence with step status, task prompts, tests, completion criteria, and deferred integration TODOs.
- Only one implementation step is active at a time. A step must be implemented, tested, documented, and checkpointed before the next step begins.
- Every step links its work to PRD story identifiers and updates its entry in `FEATURES.md`.
- Installed project skills under `.agents/skills` are part of the implementation standard and must be used for matching Playwright, Supabase, Postgres, React, and Next.js work.
- Product decisions are changed here first. Implementation progress and cross-step TODOs are tracked in `FEATURES.md`.
- When implementation exposes a missing or conflicting requirement, record the TODO immediately and update this PRD before resolving it in code.

## 1. Product overview

The Employee Operations Dashboard is a responsive web application for companies that need to roster employees, assign operational jobs, collect completion evidence, and review completed work.

V1 supports one organisation per user and two roles:

- **Owner:** manages employees, jobs, templates, recurring schedules, reviews, and rosters.
- **Employee:** sees their own roster and assigned jobs, records work, uploads photos, leaves notes and comments, and submits jobs for review.

The owner experience has four primary pages:

1. Dashboard
2. Jobs
3. Calendar
4. Employees

Employees receive a role-specific dashboard and job experience. They do not have access to the owner calendar, employee directory, templates, schedules, or other employees' work.

### 1.1 Problem statement

Operational work is often split between rosters, task boards, messaging, and photo storage. This makes it difficult for an owner to understand who is working, what needs attention, whether work was completed correctly, and where completion evidence is stored.

The product should provide a single, simple workflow from employee invitation through job completion and owner approval.

### 1.2 V1 goals

- Let an owner create and invite employees.
- Show who is currently working and who is rostered today.
- Let an owner create, assign, schedule, and reassign jobs.
- Give employees a mobile-friendly way to start jobs and submit notes and photos.
- Give owners a review queue containing the complete job history and evidence.
- Let owners build and maintain a seven-day roster.
- Provide reusable job templates and daily or weekly job schedules.
- Make the application installable as a Progressive Web App on supported desktop and mobile browsers.
- Establish automated tests that support fast progression from development to prototype and production.

### 1.3 Success criteria

V1 is successful when:

- An invited employee can activate their account without manual database intervention.
- An owner can create and assign a job in under one minute.
- An employee can start and submit a job from a mobile viewport.
- Evidence requirements prevent incomplete submissions.
- An owner can review, comment on, reopen, reassign, and archive submitted work.
- The jobs board correctly prioritises employees who are working or rostered today.
- The roster accurately represents shifts in both week and day views.
- The application exposes a valid manifest, install icons, and a securely served service worker so supported browsers can install it.
- Organisation and role boundaries are enforced by application checks and Supabase Row Level Security.
- Critical owner and employee journeys pass in automated tests.

## 2. Users, roles, and permissions

### 2.1 Owner

An owner can:

- View all organisation dashboard statistics.
- Create, edit, invite, and deactivate employees.
- View all employee profiles, shifts, jobs, comments, notes, and evidence.
- Create, edit, assign, reassign, archive, and review jobs.
- Create and manage job templates and schedules.
- Create, move, resize, copy, edit, and delete roster shifts.
- Comment on any job in their organisation.

### 2.2 Employee

An employee can:

- View their current, next, and upcoming shifts.
- View jobs currently assigned to them.
- Start an assigned job.
- Add progress notes and completion photos to their jobs.
- Comment on their jobs.
- Submit a job when its evidence requirements are satisfied.
- View feedback and the preserved history of a reopened job.

An employee cannot:

- View the employee directory or another employee's profile.
- View another employee's shifts, jobs, evidence, notes, or comments.
- Assign or reassign jobs.
- Change job templates or schedules.
- Edit the roster.
- Archive or approve a job.

### 2.3 Organisation boundary

Every operational record belongs to an organisation. V1 allows a user to belong to one organisation, but the schema and policies must use `organisation_id` so multi-organisation support can be added later.

No authenticated user may read or mutate records belonging to another organisation, even if they know a record identifier.

## 3. Core workflows and user stories

### 3.1 Authentication and employee invitations

The initial organisation and owner are provisioned manually in Supabase. There is no public owner registration in V1.

#### AUTH-01: Owner sign-in

As an owner, I want to sign in with email and password so that I can access company operations.

Acceptance criteria:

- The login form accepts email and password.
- Invalid credentials show a generic error without revealing whether an account exists.
- Successful login redirects to `/dashboard`.
- An authenticated user visiting `/login` is redirected to their permitted dashboard.
- A signed-out user visiting an authenticated route is redirected to `/login`.

#### AUTH-02: Employee invitation

As an owner, I want an invitation sent when I create an employee so that the employee can activate their account.

Acceptance criteria:

- The owner supplies first name, last name, email, phone, job title, and optional profile photo.
- Email is unique within the organisation, compared case-insensitively.
- The application creates an `invited` membership and employee profile before requesting the Auth invitation.
- The server calls Supabase Admin `inviteUserByEmail`.
- Supabase Auth sends the invitation through Resend SMTP.
- The callback returns to `/auth/confirm` and then `/set-password`.
- A failed invite remains visible as an invited employee and can be resent.
- The employee sheet shows an invitation action whose label and pending state
  reflect whether the invitation is pending, sent, or failed; sent invitations
  can be resent and failed invitations can be retried.
- The UI clearly reports invitation success or failure.
- Repeated requests do not create duplicate memberships.

#### AUTH-03: Invite acceptance

As an invited employee, I want to accept the invitation and set my password so that I can access my work.

Acceptance criteria:

- The confirmation route exchanges the Supabase verification data for a valid session.
- The authenticated user is linked to the pending membership using the normalised email.
- The employee must choose and confirm a password before proceeding.
- Password validation is performed on the server.
- Successful activation changes the membership state to `active`.
- The employee is redirected to `/dashboard`.
- Expired or invalid links display a recoverable error and instructions to request another invitation.

#### AUTH-04: Deactivated access

As an owner, I want deactivated employees blocked without deleting their history.

Acceptance criteria:

- Deactivation changes membership state to `inactive`.
- An inactive employee cannot access authenticated application data.
- Existing shifts, jobs, notes, comments, and evidence remain available to owners.
- Jobs currently assigned to an inactive employee remain visible and can be reassigned.

### 3.2 Owner dashboard

#### DASH-01: Operational statistics

As an owner, I want an immediate operational summary so that I know what needs attention.

The dashboard displays:

- **Working now:** distinct active employees with a shift where `starts_at <= now < ends_at`.
- **Outstanding jobs:** jobs in `assigned` or `in_progress`.
- **Awaiting review:** jobs in `in_review`.
- **High urgency:** non-archived `urgent` jobs.

Acceptance criteria:

- Counts are scoped to the active organisation.
- Time calculations use the organisation timezone.
- Statistics link to the relevant filtered page.
- Empty statistics show zero rather than an error or blank state.

#### DASH-02: Action lists

As an owner, I want concise lists of urgent work, submitted work, and today's roster so that I can act quickly.

Acceptance criteria:

- Urgent work is ordered by due time and then most recently updated.
- Recently submitted jobs are ordered by `submitted_at` descending.
- Today's roster shows employees, shift times, and whether they are working now.
- Each row links to its job or employee detail.
- Empty lists include a helpful next action.

### 3.3 Employee dashboard

#### EDASH-01: Personal shift summary

As an employee, I want to see my current or next shift so that I know when I am expected to work.

Acceptance criteria:

- A current shift is shown before a future shift.
- Upcoming shifts are ordered chronologically.
- Employees only receive their own roster data.
- Times are formatted in the organisation timezone.

#### EDASH-02: Personal work queue

As an employee, I want my jobs prioritised so that I know what to work on next.

Acceptance criteria:

- Only jobs currently assigned to the employee are shown.
- `urgent` and `high` priority jobs appear before normal and low priority jobs.
- Jobs with earlier due times appear first within the same priority.
- The primary job offers a clear Start or Resume action.
- Jobs already in review are visible as read-only pending-review items.

### 3.4 Employees

#### EMP-01: Employee directory

As an owner, I want a searchable employee directory so that I can manage the workforce.

Acceptance criteria:

- The directory shows photo, full name, job title, email, status, and today's roster state.
- Owners can search by name or email and filter by membership status.
- Invited, active, and inactive states are visually distinct.
- The entire employee table row opens detail and edit controls in a right-side sheet without navigating away from the directory.
- Employee creation uses an in-page dialog rather than a separate navigation transition.
- Deactivation, reactivation, or invited-employee deletion remains persistently visible at the end of the employee sheet.
- When an invitation action is available, it appears immediately above the invited-employee delete action and never replaces or obscures it.
- Employees cannot access the directory route.

#### EMP-02: Employee profile

As an owner, I want an employee detail view so that I can see their information and workload.

Acceptance criteria:

- The view shows contact information, job title, photo, membership state, and invite state.
- The view includes upcoming shifts, active jobs, and recently archived jobs.
- Owners can edit the employee or deactivate/reactivate access.
- In the employee sheet, the profile photo is enlarged and opens the photo picker when clicked, with the employee name centred beneath it.
- The employee sheet keeps membership and invitation status visible and provides direct email and phone call actions.
- The employee sheet only shows its save action after an editable profile field or photo changes.
- Every active user can open their own profile directly from the sidebar user link and update their own name, phone, job title, and photo.
- Employees cannot use the self-profile flow to read or update another employee.
- Historical activity remains available after deactivation.

#### EMP-03: Profile photo

As an owner, I want to upload a photo so that employees are easy to identify.

Acceptance criteria:

- JPEG, PNG, and WebP images are accepted.
- The maximum avatar size is 5 MB.
- File type and size are validated server-side.
- Images are stored in the private `avatars` bucket.
- The stored path is organisation and employee scoped.
- The UI uses short-lived signed URLs and has an initials fallback.

### 3.5 Jobs and Kanban board

#### JOB-01: Employee-column board

As an owner, I want jobs grouped by employee so that I can understand and balance workloads.

Column order:

1. Unassigned
2. Employees working now, ordered by shift start
3. Other employees rostered today, ordered by shift start
4. Remaining active employees, ordered by name

Acceptance criteria:

- Each employee appears once.
- Inactive employees are hidden from assignment targets but remain available in historical filters.
- The board supports Active, Review, and Archived filters.
- Changing a filter does not change the employee-column structure.
- Cards show title, priority, status, scheduled/due time, and evidence requirement indicators.
- Horizontal scrolling remains usable on desktop and narrow screens.

#### JOB-02: Job creation

As an owner, I want to create a job and optionally assign it so that work can enter the queue.

Job fields:

- Title
- Description
- Location
- Priority: `low`, `normal`, `high`, or `urgent`
- Optional assignee
- Optional scheduled date and time
- Optional due date and time
- Whether a completion note is required
- Minimum completion photo count, from 0 to 10
- Optional source template

Acceptance criteria:

- Title is required.
- Due time cannot precede scheduled time.
- An assignee must be an active employee in the organisation.
- An unassigned job is stored with status `assigned` and a null assignee.
- Creation produces an audit update.
- The new job appears without a full-page refresh.

#### JOB-03: Drag-to-reassign

As an owner, I want to drag a job to another employee so that I can rebalance work quickly.

Acceptance criteria:

- Dropping in an employee column changes the assignee.
- Dropping in Unassigned clears the assignee.
- The UI updates optimistically and rolls back if persistence fails.
- Reassignment is authorised and validated on the server.
- Every assignment change records previous and new assignee identifiers.
- Reassigning an `in_review` job reopens it and returns it to `assigned`.

#### JOB-04: Start work

As an employee, I want to start my job so that its progress is visible.

Acceptance criteria:

- Only the current active assignee can start a job.
- Starting changes `assigned` to `in_progress` and records `started_at`.
- Starting an already in-progress job is idempotent.
- Unassigned, in-review, and archived jobs cannot be started.

#### JOB-05: Add notes and evidence

As an employee, I want to document progress so that the owner can verify the work.

Acceptance criteria:

- The assignee can add multiple timestamped progress notes.
- The assignee can upload JPEG, PNG, and WebP images.
- Each evidence image is limited to 10 MB.
- A job can contain no more than 10 evidence images.
- Evidence is stored in the private `job-evidence` bucket under an organisation/job path.
- Uploads display progress, success, and actionable failure states.
- Notes and assets identify their author and creation time.
- Owners can view all evidence but employees can view evidence only for their assigned jobs.

#### JOB-06: Submit for review

As an employee, I want to submit completed work so that the owner can approve it.

Acceptance criteria:

- Only the current assignee can submit.
- Submission is allowed from `assigned` or `in_progress`.
- If a completion note is required, at least one employee note must exist.
- The number of valid completion photos must meet the job minimum.
- Successful submission changes status to `in_review` and records `submitted_at`.
- Failed validation identifies the missing evidence.
- The job becomes read-only to the employee except for comments.

#### JOB-07: Owner review

As an owner, I want to inspect all job information before approving or reopening it.

Acceptance criteria:

- The review view shows job fields, state history, assignment history, notes, evidence, and comments in chronological context.
- Owners can add a comment without changing status.
- Archive/approve changes `in_review` to `archived` and records `archived_at`.
- Reopen/reassign changes the job to `assigned`, clears the current submission timestamp, and preserves all prior evidence and updates.
- A reopened job displays owner feedback prominently to the employee.
- Review actions are idempotent and produce audit updates.

#### JOB-08: Job conversation

As an owner or assigned employee, I want to discuss a job without mixing the discussion with completion notes.

Acceptance criteria:

- Comments are stored as a distinct update type.
- Owners and the current assignee can comment.
- Every comment shows author and timestamp.
- Comments cannot be silently edited or deleted in V1.
- Progress notes, comments, evidence, and system audit events are visually distinguishable.

### 3.6 Templates and scheduled jobs

#### TPL-01: Reusable job template

As an owner, I want reusable job templates so that common jobs are quick to create.

Acceptance criteria:

- A template can store all job defaults except a concrete scheduled/due timestamp.
- Owners can create, edit, deactivate, and select templates.
- Creating from a template pre-fills a job form and allows overrides.
- Editing a template does not alter previously created jobs.

#### TPL-02: Daily or weekly schedule

As an owner, I want templates to generate recurring jobs so that routine work is not forgotten.

A schedule contains:

- Template
- Assignee
- Local generation time
- Recurrence type: daily or weekly
- Applicable weekdays
- Start date
- Optional end date
- Enabled state

Acceptance criteria:

- The assignee and template belong to the organisation.
- Weekly schedules require at least one weekday.
- The scheduler calculates occurrences in the organisation timezone.
- One concrete job is created per due schedule occurrence.
- A uniqueness constraint prevents duplicate jobs for the same schedule occurrence.
- Pausing or deleting a schedule prevents future generation but does not change generated jobs.
- Updating a schedule affects only future occurrences.
- A failed occurrence can be retried without producing duplicates.

### 3.7 Calendar and roster

#### CAL-01: Employee week view

As an owner, I want a seven-day view for one employee so that I can plan their week.

Acceptance criteria:

- The owner can select any active employee.
- Seven consecutive dates are shown with 15-minute placement precision.
- Shifts display start time, end time, duration, and optional notes.
- Previous week, next week, and Today controls are available.

#### CAL-02: Organisation day view

As an owner, I want a single-day view of all rostered employees so that I can see daily coverage.

Acceptance criteria:

- Each rostered employee has a visible lane or row.
- Employees are ordered by first shift start and then name.
- Multiple non-overlapping shifts for one employee can be shown.
- The view can move to the previous day, next day, or today.

#### CAL-03: Shift management

As an owner, I want to edit shifts directly from the calendar so that roster maintenance is quick.

Acceptance criteria:

- Owners can create a shift from an empty calendar slot.
- Dragging changes the shift time or employee where the current view permits it.
- Resizing changes start or end in 15-minute increments.
- Owners can open a form to edit exact values and notes.
- Owners can copy a shift to another valid date or employee.
- Delete requires confirmation.
- A shift must end after it starts.
- Overlapping shifts for the same employee are rejected server-side.
- Optimistic updates roll back on failure.

#### CAL-04: Current-time indicator

As an owner, I want to see the current time on today's roster so that I can understand live coverage.

Acceptance criteria:

- A horizontal line is shown only when the displayed date range contains today.
- Its position reflects the organisation-local current time.
- It updates at least once per minute while the page is open.
- It is hidden outside the visible hour range.

### 3.8 Progressive Web App

V1 provides an installable application shell. Offline data access, offline mutations, background sync, and push notifications remain outside V1 because they require additional data consistency, subscription, and notification product decisions.

The implementation follows the [Next.js Progressive Web App guide](https://nextjs.org/docs/app/guides/progressive-web-apps).

#### PWA-01: Installable application

As an owner or employee, I want to install the dashboard on my device so that it launches like an application.

Acceptance criteria:

- `app/manifest.ts` returns a valid typed web app manifest.
- The manifest defines the product name, short name, description, `/dashboard` start URL, standalone display mode, portrait-primary orientation, theme colour, background colour, and relevant application categories.
- The application includes valid 192×192 and 512×512 PNG icons, including a maskable icon, plus an Apple touch icon.
- Production and staging serve the application over HTTPS.
- Supported browsers recognise the deployed application as installable.
- The employee dashboard provides non-blocking installation guidance when the application is not already running in standalone mode.
- iOS guidance explains the Share → Add to Home Screen flow.
- The UI does not depend exclusively on the non-standard `beforeinstallprompt` event.

#### PWA-02: Service worker lifecycle

As a user, I want installed application resources to update safely so that I do not remain on an obsolete application shell.

Acceptance criteria:

- A same-origin service worker is served from `/sw.js` and registered with scope `/`.
- Registration uses `updateViaCache: "none"`.
- The service worker has explicit install and activate lifecycle handling.
- The service worker does not cache authenticated API responses, Supabase requests, uploaded evidence, signed asset URLs, or mutation responses.
- V1 does not claim that jobs, rosters, evidence, or mutations work offline.
- Service-worker registration failure does not block normal browser use.
- A new application version can activate without requiring users to clear browser storage manually.

#### PWA-03: PWA security and graceful degradation

As a user, I want PWA capabilities to fail safely so that unsupported browsers can still use the product.

Acceptance criteria:

- `/sw.js` is served as JavaScript with `no-cache, no-store, must-revalidate`.
- The service-worker response has a same-origin Content Security Policy.
- Global responses include `X-Content-Type-Options`, frame protection, and a strict-origin referrer policy.
- Installation guidance is hidden when running in standalone mode.
- Unsupported browsers receive the standard responsive web application without errors or blocked workflows.
- Push permission is never requested in V1.

## 4. Navigation and route acceptance

### `/login`

- Public route containing email/password login.
- No public signup or social login controls.
- Authenticated users are redirected to `/dashboard`.

### `/auth/confirm`

- Public callback route for Supabase invitation verification.
- Exchanges verification data, links the pending membership, and redirects to password setup.
- Displays a safe recovery state for invalid or expired verification data.

### `/set-password`

- Requires a valid invited-user session.
- Requires password and confirmation.
- Activates the employee membership and redirects to `/dashboard`.

### `/dashboard`

- Requires an active membership.
- Renders the owner dashboard for owners and personal dashboard for employees.
- Does not fetch data the current role is not permitted to access.

### `/dashboard/profile`

- Requires an active membership and is linked directly from the sidebar user control.
- Owners and employees can update only their own profile information and photo.
- Logout is displayed in the profile header opposite the current user's name and is not persistently displayed on every page.
- The authenticated header exposes a light/dark theme toggle.

### `/dashboard/jobs`

- Owners receive the employee-column Kanban board, filters, creation, templates, schedules, and review tools.
- Employees receive their own active and review jobs in a mobile-friendly list.
- Job detail may use a nested route or route-addressable drawer, but direct linking and refresh must preserve the selected job.

### `/dashboard/calendar`

- Owner-only route.
- Contains employee week and organisation day views.
- Employee shift summaries remain on the employee dashboard.

### `/dashboard/employees`

- Owner-only route.
- Contains a full-width directory with fully clickable employee rows, dialog-based creation/invitation, right-side profile detail and editing, and deactivation.
- The desktop sidebar collapses to navigable icons, keeps visually even spacing on both sides of the icon rail, and restores the last expanded/collapsed choice from a cookie.

### `/manifest.webmanifest`

- Public metadata route generated by `app/manifest.ts`.
- Contains valid install metadata and references existing application icons.

### `/sw.js`

- Public same-origin service worker.
- Uses service-worker-specific security and cache headers.
- Does not expose environment secrets or cache authenticated application data.
- Is excluded from the root proxy matcher so service-worker installation and updates never depend on an Auth request.

## 5. Job state model

| Current state | Actor             | Action                     | Next state    |
| ------------- | ----------------- | -------------------------- | ------------- |
| `assigned`    | Employee assignee | Start                      | `in_progress` |
| `assigned`    | Employee assignee | Submit with valid evidence | `in_review`   |
| `in_progress` | Employee assignee | Submit with valid evidence | `in_review`   |
| `in_review`   | Owner             | Archive/approve            | `archived`    |
| `in_review`   | Owner             | Reopen/reassign            | `assigned`    |
| `assigned`    | Owner             | Reassign                   | `assigned`    |
| `in_progress` | Owner             | Reassign                   | `assigned`    |
| `archived`    | Owner             | Reopen/reassign            | `assigned`    |

State transitions must be validated on the server. Status, assignment, and evidence changes produce immutable audit updates.

## 6. Data model

Database migrations are the source of truth. Generated Supabase TypeScript types are checked into the repository after every schema change.

### 6.1 `organisations`

- `id`
- `name`
- `timezone`, default `Australia/Melbourne`
- `created_at`
- `updated_at`

### 6.2 `memberships`

- `id`
- `organisation_id`
- `user_id`, nullable until invitation acceptance
- `email`
- `role`: `owner` or `employee`
- `status`: `invited`, `active`, or `inactive`
- `invited_at`
- `invite_delivery_status`: `pending`, `sent`, or `failed`
- `invite_last_attempted_at`
- `activated_at`
- `deactivated_at`
- `created_at`
- `updated_at`

Constraints:

- Normalised email is unique per organisation.
- A user can have only one V1 membership.

### 6.3 `employee_profiles`

- `id`
- `organisation_id`
- `membership_id`
- `first_name`
- `last_name`
- `phone`
- `job_title`
- `avatar_path`
- `created_at`
- `updated_at`

### 6.4 `roster_shifts`

- `id`
- `organisation_id`
- `employee_membership_id`
- `starts_at`
- `ends_at`
- `notes`
- `created_by`
- `created_at`
- `updated_at`
- `archived_at`

Overlapping non-archived ranges for the same employee are prohibited.

### 6.5 `jobs`

- `id`
- `organisation_id`
- `template_id`, nullable
- `schedule_id`, nullable
- `schedule_occurrence_at`, nullable
- `assignee_membership_id`, nullable
- `title`
- `description`
- `location`
- `priority`
- `status`
- `scheduled_at`
- `due_at`
- `requires_completion_note`
- `minimum_completion_photos`
- `started_at`
- `submitted_at`
- `archived_at`
- `created_by`
- `created_at`
- `updated_at`

Constraints:

- `(schedule_id, schedule_occurrence_at)` is unique when both values are present.
- Minimum completion photos is between 0 and 10.

### 6.6 `job_templates`

- `id`
- `organisation_id`
- Job default fields
- `is_active`
- `created_by`
- `created_at`
- `updated_at`

### 6.7 `job_schedules`

- `id`
- `organisation_id`
- `template_id`
- `assignee_membership_id`
- `recurrence_type`: `daily` or `weekly`
- `weekdays`
- `local_time`
- `starts_on`
- `ends_on`
- `timezone`
- `is_enabled`
- `next_occurrence_at`
- `created_by`
- `created_at`
- `updated_at`

### 6.8 `job_updates`

- `id`
- `organisation_id`
- `job_id`
- `author_membership_id`, nullable for system events
- `type`: `note`, `comment`, `status_change`, `assignment_change`, or `system`
- `body`, nullable
- `metadata`
- `created_at`

Updates are append-only in V1.

### 6.9 `job_assets`

- `id`
- `organisation_id`
- `job_id`
- `uploaded_by_membership_id`
- `kind`: `completion_photo`
- `storage_path`
- `mime_type`
- `size_bytes`
- `created_at`
- `archived_at`

## 7. Storage and uploads

Supabase Storage buckets:

- `avatars`: private, images only, 5 MB per object.
- `job-evidence`: private, images only, 10 MB per object.

Requirements:

- Validate size, declared MIME type, and detected image content before accepting metadata.
- Use non-guessable object names.
- Store objects under organisation-scoped paths.
- Issue short-lived signed URLs only after authorisation.
- Do not store public URLs in application tables.
- Clean up a newly uploaded object if the related database mutation fails.
- Archiving a database record does not immediately delete its object.

## 8. Architecture and security

### 8.1 Next.js

- Use Server Components for initial reads and role-specific page composition.
- Use Server Actions for authenticated mutations.
- Use client components only where browser state or interaction is required, including drag/drop, calendar manipulation, upload progress, and optimistic updates.
- Use the required root-level `proxy.ts` as the single Next.js Proxy entrypoint.
- Keep the root entrypoint thin: it imports and returns a project-native Supabase session helper from `lib/supabase/proxy.ts`.
- Preserve the verified S01 cookie propagation and route-gating contract in the project-native root `proxy.ts` and `lib/supabase/proxy.ts`; the original reference prototypes were consumed and removed after verification.
- Use Proxy for Supabase Auth cookie refresh and optimistic signed-in/signed-out redirects only.
- The Proxy matcher excludes Next.js static/image assets, favicon and image files, `/sw.js`, and `/manifest.webmanifest`.
- Public Auth routes remain reachable for invitation confirmation and password setup.
- Signed-out access to `/dashboard/:path*` redirects to `/login`; signed-in access to `/` or `/login` redirects to `/dashboard`.
- Proxy failure or route gating never replaces authoritative membership, role, status, organisation, or resource checks.
- Perform authoritative authentication and authorisation inside the data-access layer and every Server Action.
- Validate untrusted input with Zod.
- Revalidate affected paths or tags after successful mutations.

### 8.2 Supabase

- Use the publishable client for normal user-scoped reads and writes.
- Keep the secret/service-role key in server-only modules.
- Use the admin client only for invitations and explicitly privileged operations.
- Enable RLS on every application table.
- Owner policies allow organisation-wide access.
- Employee policies allow only their membership, roster, assigned jobs, related updates, and related assets.
- Storage policies mirror the database permissions.
- Cross-organisation identifiers must fail closed.

### 8.3 Email

- Resend is configured as Supabase Auth SMTP.
- V1 application email is limited to initial employee invitations.
- Assignment, feedback, roster, and completion notification emails are post-V1 work.
- Tests must not send real email.

### 8.4 Progressive Web App

- Use the App Router `app/manifest.ts` metadata convention.
- Register the service worker from a small client-only component mounted by the application shell.
- Keep service-worker behaviour deliberately minimal in V1: lifecycle and update handling only, with no authenticated data caching.
- Serve production and staging over HTTPS.
- Configure global and `/sw.js` security headers through `next.config.ts`.
- Treat install guidance as progressive enhancement; the web application remains fully usable without PWA support.
- Keep push subscriptions, VAPID keys, background sync, and offline application data outside the V1 implementation.

### 8.5 Environment configuration

- `.env.example` is the committed source of truth for every environment variable required by the application.
- `.env.example` contains variable names and safe empty/example placeholders only; it must never contain usable secret values.
- Local development values live in the ignored root `.env.local` file.
- Whenever implementation adds, renames, or removes an environment variable, the same branch must update `.env.example`, environment validation, relevant tests, and setup documentation.
- The implementing Codex task must explicitly tell the user which `.env.example` entries changed and instruct them to add the corresponding real values to `.env.local`; it must not assume that local values were updated.
- Variables prefixed with `NEXT_PUBLIC_` are treated as browser-visible, build-time configuration and must never contain secrets.
- Server-only Supabase, email, scheduler, or signing credentials must not use the `NEXT_PUBLIC_` prefix.
- Missing required configuration fails with a clear, non-secret error at the earliest appropriate server boundary.

### 8.6 Reference code

`components/ref-files` is reusable prototype and implementation source material. Its remaining files contain working styling, interaction patterns, assets, JSON helpers, email abstractions, and domain logic that should accelerate later feature delivery.

Each implementation step should inspect the relevant reference implementation before rebuilding equivalent behaviour. Where it matches this PRD, preserve its useful visual treatment, interaction behaviour, and available assets rather than recreating them without reason.

Future implementation may port:

- Kanban drag/drop and optimistic rollback concepts.
- Calendar slot positioning and drag interactions.
- Timezone conversion helpers.
- Resend sender abstractions.

S01 consumed and verified the Supabase browser, server, admin, environment,
session-cookie, and thin root Proxy prototypes. Those six obsolete reference
files were removed; their maintained production replacements are
`lib/supabase/browser.ts`, `lib/supabase/server.ts`,
`lib/supabase/admin.ts`, `lib/supabase/public-env.ts`,
`lib/supabase/server-env.ts`, `lib/supabase/proxy.ts`, and the root
`proxy.ts`.

Feature owners may clean, edit, split, move, rename, or remove reference files as they are absorbed into the application. The expected workflow is:

1. Identify the styling, assets, interactions, and logic that satisfy the relevant PRD stories.
2. Port or move those pieces into the appropriate production feature, `lib`, `app`, or shared component location.
3. Replace `@eva/*`, missing project imports, old domain names, incomplete actions, and obsolete types with this repository's contracts.
4. Simplify or remove unrelated legacy behaviour.
5. Add tests for the preserved behaviour and any cleaned-up logic.
6. Remove obsolete duplicates once the production implementation is verified.

Finished production modules must not depend on unresolved reference-only imports or require `components/ref-files` to remain in the runtime dependency graph. Reference files not yet consumed should remain excluded from TypeScript and ESLint production scope. Any reference file changed by more than one feature must be recorded in the integration ledger.

### 8.7 Project implementation skills

The repository includes versioned implementation guidance under `.agents/skills`, tracked by `skills-lock.json`.

- Use `playwright-best-practices` whenever configuring, writing, running, debugging, or maintaining Playwright tests.
- Use `supabase` for every Supabase Auth, SSR, Database, Storage, RLS, Cron, CLI, migration, or client task. Verify current Supabase documentation and changelog before implementation.
- Use `supabase-postgres-best-practices` for schema design, constraints, indexes, RLS performance, queries, locking, and database review.
- Use `vercel-react-best-practices` whenever writing or refactoring React components, Next.js pages, data fetching, rendering, or bundle-sensitive UI.
- Read each applicable `SKILL.md` before acting and follow its routing instructions to the relevant reference files.
- Skill guidance influences implementation quality but does not override this PRD's product behaviour.

## 9. Error, loading, and empty states

- Forms preserve valid user input after a recoverable error.
- Mutations show a pending state and prevent accidental duplicate submission.
- Optimistic drag/drop and calendar changes roll back when the server rejects them.
- Upload errors identify invalid type, excessive size, limit reached, or network failure.
- Empty dashboards, boards, directories, and calendars provide a relevant owner action.
- Unauthorised access returns a safe not-found or redirect response without exposing record existence.
- Route-level error boundaries offer retry where appropriate.

## 10. Accessibility and responsive behaviour

- All core workflows are keyboard accessible.
- Drag/drop actions have a non-drag alternative.
- Dialogs and drawers manage focus and have accessible names.
- Status and priority are not communicated by colour alone.
- Images have meaningful alt text or are marked decorative.
- Form fields have labels and associated validation messages.
- Desktop supports wide Kanban and calendar layouts.
- Employee jobs and evidence upload are designed mobile-first.
- Critical Playwright journeys run at desktop and mobile viewport sizes.

## 11. Testing strategy

### 11.1 Unit and component tests

Use Vitest and React Testing Library for:

- Job state transition rules.
- Evidence requirement validation.
- Role and organisation authorisation helpers.
- Board employee ordering.
- Dashboard statistic calculations.
- Roster overlap detection.
- Current-time indicator calculations.
- Organisation timezone conversion.
- Daily and weekly occurrence calculation.
- Schedule idempotency helpers.
- Form validation and core component interaction.
- Root Proxy cookie propagation, redirect, public-route, and matcher behaviour.
- PWA standalone-mode detection and installation-guidance visibility.
- Service-worker registration feature detection and failure handling.

### 11.2 Database tests

Use Supabase local development and database tests for:

- Owner and employee RLS policies.
- Cross-organisation isolation.
- Invite-to-membership linking.
- Active/inactive membership access.
- Roster overlap prevention.
- Schedule occurrence uniqueness.
- Job transition constraints where implemented in SQL.
- Private avatar and evidence storage policies.

### 11.3 End-to-end tests

Use the installed `@playwright/test` package and the project `playwright-best-practices` skill for:

1. Owner signs in.
2. Owner creates and invites an employee.
3. Employee accepts the invite, sets a password, and signs in.
4. Owner creates and assigns a job.
5. Owner reassigns a job through the board.
6. Employee starts the job, adds a note and photo, and submits it.
7. Owner comments and reopens/reassigns the job.
8. Employee sees the feedback and resubmits.
9. Owner archives the job.
10. Owner creates, moves, resizes, copies, and deletes roster shifts.
11. A template schedule produces exactly one job per occurrence.
12. Manifest, icons, and service worker are available with the required metadata and response headers.
13. The application remains usable when service workers are unavailable.
14. Signed-out dashboard requests redirect to login, signed-in login/root requests redirect to the dashboard, and public Auth/PWA resources remain reachable.

Outbound email is mocked while the invitation request, recipient, and callback URL are asserted.

Playwright architecture requirements:

- Use API/database-level tests for CRUD permutations, permissions, and data integrity; component tests for form states, accessibility, and isolated interactions; and E2E tests for critical cross-page journeys.
- Use custom fixtures for authenticated owner/employee sessions, Supabase-backed test data, and deterministic cleanup.
- Add page objects only for interaction-heavy pages reused by multiple test files.
- Prefer role, label, and visible-text locators with web-first assertions.
- Do not use arbitrary sleeps or fixed timing as synchronisation.
- Capture traces on retry and retain screenshots or video on failure.
- Start with Chromium for fast development feedback; add mobile projects for employee workflows and cross-browser projects for final readiness.
- Mock email delivery and other external side effects while exercising the real application and local Supabase boundaries.

### 11.4 CI quality gates

Every change must pass:

- ESLint
- TypeScript type-check
- Unit/component tests
- Supabase database tests
- Playwright critical journeys
- Next.js production build

## 12. Sequential implementation plan

Development proceeds through the following verified steps. Detailed tasks, status, prompts, and test gates live in `FEATURES.md`.

### Step 1: Platform foundation — complete

- [x] Establish clean lint, type-check, build, and test baselines.
- [x] Configure the installed Playwright package, deterministic fixtures, test scripts, reports, and local web-server lifecycle using the project Playwright skill.
- [x] Add Supabase local configuration, organisations, memberships, seeds, clients, session handling, root Proxy, data-access authorisation, and initial RLS.

### Step 2: Authentication and employees

- Implement login, invitation confirmation, password setup, and role-aware access.
- Implement employee directory, profile, invitation, deactivation, and avatar upload.

### Step 3: Progressive Web App shell

- Add the manifest, install assets and guidance, minimal service-worker lifecycle, and security headers.
- Verify installability and graceful degradation without offline application data or push notifications.

### Step 4: Owner jobs and Kanban

- Implement the job schema, transitions, owner creation flow, employee-column board, filters, and assignment/reassignment.

### Step 5: Employee job execution and owner review

- Implement start/resume, notes, evidence, submission, comments, review, reopen/reassign, and archive.

### Step 6: Roster data and calendar views

- Implement shift schema, RLS, overlap protection, employee week view, organisation day view, and employee shift summary.

### Step 7: Calendar interactions

- Add shift creation, exact editing, drag, resize, copy, delete, optimistic rollback, and current-time indicator.

### Step 8: Templates and schedules

- Implement templates and idempotent daily/weekly job generation with retry visibility.

### Step 9: Operational dashboards

- Compose the verified employee, job, and roster query contracts into owner and employee dashboards.

### Step 10: Integration and production hardening

- Resolve all deferred cross-step TODOs.
- Complete end-to-end coverage, responsive QA, accessibility checks, security verification, and staging readiness.

## 13. Prototype and production readiness

### Prototype acceptance

- Critical owner and employee Playwright journeys pass.
- Owner pages work at desktop width.
- Employee dashboard, jobs, notes, and photo upload work at a mobile viewport.
- RLS tests demonstrate role and organisation isolation.
- No real email is sent by automated tests.
- The deployed application passes manifest, icon, service-worker, and installability checks.
- Lint, type-check, unit tests, and production build pass.

### Production readiness

- A real invitation is delivered through Resend in staging.
- Auth redirect URLs and allowed origins are verified.
- Private storage and signed URL expiry are verified.
- Database backup and recovery procedures are documented.
- Error monitoring and server-side mutation logging are configured.
- Schedule processing has failure visibility and a safe retry path.
- HTTPS, PWA security headers, service-worker update behaviour, and installability are verified in staging.
- A staging smoke test passes before deployment.

## 14. Deferred work

The following are explicitly outside V1:

- Public owner signup and company onboarding.
- Multi-company switching.
- Payroll and timesheets.
- Clock-in and clock-out.
- Leave requests and availability management.
- Offline job, roster, evidence, and mutation support.
- Push notifications.
- Job and roster email notifications beyond Auth invitations.
- Non-image job attachments.
- Employee-to-employee profile or job visibility.
- Advanced recurrence rules.
- Shift-start-triggered job generation.
- Comment editing or deletion.

## 15. Open work after V1

- Add email or push notifications for assignment, reassignment, owner feedback, reopened jobs, and roster changes.
- Add platform-admin and multi-organisation support.
- Add configurable company onboarding and owner self-service signup.
- Add richer reporting, exports, and employee workload analytics.
- Add leave, availability, time tracking, and payroll integrations as separate product areas.
