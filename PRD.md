# Employee Operations Dashboard V1

## Document status

- Status: Approved for implementation
- Version: 1.7
- Last updated: 27 July 2026
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

V1 supports one organisation per user and three roles:

- **Owner:** controls access and roles, manages all operations, and reviews
  employee and manager work. Owners are not operational job assignees.
- **Manager:** manages the employee lifecycle and operations, performs assigned
  work, and reviews employee work.
- **Employee:** sees their own roster and assigned jobs, records work, uploads photos, leaves notes and comments, and submits jobs for review.

The owner experience has five primary pages:

1. Dashboard
2. Jobs
3. Roster
4. Employees
5. Templates & schedules

Managers receive the organisation operations experience plus a personal assigned
work queue. Employees receive a self-scoped dashboard and job experience. They
do not have access to the team roster, employee directory, templates, schedules,
or other employees' work.

### 1.1 Problem statement

Operational work is often split between rosters, task boards, messaging, and photo storage. This makes it difficult for an owner to understand who is working, what needs attention, whether work was completed correctly, and where completion evidence is stored.

The product should provide a single, simple workflow from employee invitation through job completion and owner approval.

### 1.2 V1 goals

- Let owners invite employees, managers, and one backup owner, and let managers
  manage the employee lifecycle.
- Show who is currently working and who is rostered today.
- Let owners and managers create, assign, schedule, and reassign jobs.
- Give employees a mobile-friendly way to start jobs and submit notes and photos.
- Give eligible higher-level reviewers a shared queue containing the complete
  job history and evidence.
- Let owners build and maintain a seven-day roster.
- Provide reusable job templates and daily or weekly job schedules.
- Make the application installable as a Progressive Web App on supported desktop and mobile browsers.
- Let employees continue assigned job work during temporary connectivity loss
  with explicit local and synchronisation states.
- Establish automated tests that support fast progression from development to prototype and production.

### 1.3 Success criteria

V1 is successful when:

- An invited employee can activate their account without manual database intervention.
- An owner can create and assign a job in under one minute.
- An employee can start and submit a job from a mobile viewport.
- Evidence requirements prevent incomplete submissions.
- An owner can review, comment on, reopen, reassign, and archive submitted work.
- The jobs board clearly separates unassigned, assigned, and review-ready work.
- The roster accurately represents shifts in both week and day views.
- An employee can reopen a cached work pack, start work, add notes and photos,
  and queue submission during temporary connectivity loss.
- Retried offline operations do not create duplicate notes, assets, audit
  events, or transitions.
- The application exposes a valid manifest, install icons, and a securely served service worker so supported browsers can install it.
- Organisation and role boundaries are enforced by application checks and Supabase Row Level Security.
- Critical owner, manager, and employee journeys pass in automated tests.

## 2. Users, roles, and permissions

### 2.1 Owner

An owner can:

- View all organisation dashboard statistics.
- Create, edit, invite, deactivate, reactivate, and remove pending employees and
  managers, and invite one additional owner.
- Promote and demote roles while preserving at least one and at most two
  invited-or-active owners.
- View all employee profiles, shifts, jobs, comments, notes, and evidence.
- Create, edit, assign, reassign, archive, and review jobs.
- Create and manage job templates and schedules.
- Create shifts from the roster calendar, exactly edit and archive them from
  employee profiles, and assign not-started jobs while creating a shift.
- Comment on any job in their organisation.

An owner cannot be assigned operational jobs.

### 2.2 Manager

A manager can:

- View organisation dashboard statistics and team operations.
- Create, invite, edit, deactivate, reactivate, resend, and remove pending
  employee accounts.
- View team profiles required for jobs and rosters.
- Create, edit, assign, reassign, and archive jobs.
- Manage rosters, templates, and schedules.
- Perform jobs assigned to them.
- Review employee submissions.

A manager cannot:

- Change any membership role.
- Invite, edit access for, deactivate, or remove an owner or manager.
- Review a manager submission or their own work.
- Change organisation ownership or security settings.

### 2.3 Employee

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

### 2.4 Review hierarchy

Submitted work enters a shared review queue. Review eligibility is captured at
submission and is not weakened by later role changes:

- Employee work may be approved or reopened by an active manager or owner.
- Manager work may be approved or reopened only by an active owner.
- Self-review is prohibited.
- The first valid concurrent review wins under a database row lock.
- Every active eligible reviewer receives an idempotent submission notification.

### 2.5 Organisation boundary

Every operational record belongs to an organisation. V1 allows a user to belong to one organisation, but the schema and policies must use `organisation_id` so multi-organisation support can be added later.

No authenticated user may read or mutate records belonging to another organisation, even if they know a record identifier.

## 3. Core workflows and user stories

### 3.1 Authentication and employee invitations

The initial organisation and owner are provisioned manually in Supabase. There
is no public registration in V1. The initial owner may invite one additional
owner. At least one active owner must remain, and no organisation may have more
than two invited-or-active owners.

#### AUTH-01: Owner sign-in

As an owner, I want to sign in with email and password so that I can access company operations.

Acceptance criteria:

- The login form accepts email and password.
- Invalid credentials show a generic error without revealing whether an account exists.
- Successful login redirects to `/dashboard`.
- An authenticated user visiting `/login` is redirected to their permitted dashboard.
- A signed-out user visiting an authenticated route is redirected to `/login`.

#### AUTH-02: Team invitation

As an authorised team administrator, I want an invitation sent when I create a
team member so that they can activate their account.

Acceptance criteria:

- An owner may invite an employee, manager, or second owner.
- A manager may invite employees only.
- The authorised actor supplies first name, last name, email, phone, job title,
  role, and optional profile photo.
- Email is unique within the organisation, compared case-insensitively.
- The application creates an `invited` membership and profile before requesting
  the Auth invitation.
- The server calls Supabase Admin `inviteUserByEmail`.
- Supabase Auth sends the invitation through Resend SMTP.
- The callback returns to `/auth/confirm` and then `/set-password`.
- A failed invite remains visible as an invited team member and can be resent by
  an actor authorised to manage that role.
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
- Viewer-facing time calculations use the signed-in user's validated browser timezone.
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
- Times are formatted in the signed-in user's validated browser timezone.

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

#### JOB-01: Workflow board

As an owner, I want jobs grouped by workflow state so that I can see what needs assignment, what is being worked on, and what is ready for review.

The Workflow view has three fixed columns:

1. Unassigned
2. Assigned
3. To review

Acceptance criteria:

- An `assigned` job with no assignee appears in Unassigned.
- An `assigned` or `in_progress` job with an assignee appears in Assigned.
- An `in_review` job appears in To review and can enter that column only through employee submission.
- Assigned and review cards show the assignee, including inactive historical assignees.
- Inactive and invited employees are hidden from assignment targets.
- The Workflow and Archived filters sit with the create action; on mobile, the filters span the row beneath the create button.
- Archived displays one non-workflow column that matches a Workflow column's width on desktop.
- Cards show title, priority, status, scheduled/due time, and evidence requirement indicators.
- Columns fill the remaining viewport height and scroll their cards internally.
- On mobile, each column occupies the board width and horizontal scrolling snaps to the next column.

#### JOB-02: Job creation

As an owner, I want to create a job and optionally assign it so that work can enter the queue.

Job fields:

- Title
- Description
- Location
- Priority: `low`, `normal`, `high`, or `urgent`
- Optional assignee
- Optional rostered shift for the selected assignee
- Optional scheduled date and time
- Optional due date and time
- Whether a completion note is required
- Minimum completion photo count, from 0 to 10
- Optional source template

Acceptance criteria:

- Title is required.
- Due time cannot precede scheduled time.
- An assignee must be an active employee in the organisation.
- After an assignee is selected, the owner can choose from that employee's
  current and upcoming rostered shifts.
- Choosing a rostered shift sets the job's scheduled and due date/times from
  the server-authoritative shift start and end. Manual changes to either
  boundary remain available and clear the rostered-shift selection.
- Changing or clearing the assignee clears any selected rostered shift.
- An unassigned job is stored with status `assigned` and a null assignee.
- Creation produces an audit update.
- The new job appears without a full-page refresh.

#### JOB-03: Assign and reassign

As an owner, I want to move jobs between Unassigned and Assigned so that I can allocate and rebalance work quickly.

Acceptance criteria:

- Dropping an unassigned job in Assigned requires the owner to choose an active employee.
- Dropping in Unassigned clears the assignee.
- Cancelling employee selection leaves the job unassigned.
- To review is not a manual drop target.
- Cards provide an accessible non-drag assignment control for reassignment and mobile use.
- Assignment controls always display the employee name rather than an internal identifier.
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
- The assignee can upload JPEG, PNG, WebP, HEIC, and HEIF images, including
  files selected directly from supported iPhone and Android photo libraries.
- Evidence photos larger than 1 MiB are optimized in the browser before
  upload; HEIC and HEIF photos are always converted for browser compatibility.
- Optimization preserves orientation, removes embedded metadata, limits the
  long edge to 2,048 pixels, and targets no more than half the source byte size
  without blocking a valid upload when that target cannot be reached safely.
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
- A successful distinct submission emails the active owner who created the job
  with a direct link to the route-addressed review sheet.
- Email-delivery failure does not roll back submission; the failed delivery is
  recorded for owner visibility and retry.

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

### 3.7 Roster

Roster dates and times are displayed in the viewer's current browser timezone.
The validated IANA timezone is retained behind the scenes in the viewer context
so server-rendered ranges and client-side positioning use the same local-day
boundaries without exposing timezone in roster URLs.

#### CAL-01: Employee roster filter

As an owner, I want to filter the Team week to one employee so that I can plan
their week without switching calendar modes.

Acceptance criteria:

- The Team week employee selector offers All team and every active employee.
- Selecting an employee shows only that worker's shifts across all seven dates.
- Every date remains interactive while filtered.
- Creating while filtered preselects that employee; creating from All team
  requires the owner to choose the employee in the shift dialog.
- Shifts display start time, end time, duration, and optional notes.
- Previous week, next week, and Today controls are available.

#### CAL-02: Organisation week view

As an owner, I want a seven-day view of all rostered employees so that I can
see team coverage and overlaps across the week.

Acceptance criteria:

- Seven consecutive dates are shown with one shared time canvas per date rather
  than equal-width employee lanes.
- Day columns have persistent vertical separators, and mobile uses one fixed
  day width per viewport with mandatory day-to-day snapping.
- Every shift identifies its employee and remains selectable.
- Overlapping shifts are layered within the date: longer shifts render behind
  shorter shifts, with progressive inset exposing each overlapping layer.
- Multiple non-overlapping shifts for one employee can be shown.
- The view can move to the previous week, next week, or today.

#### CAL-03: Shift management

As an owner, I want to create shifts directly from the roster and complete
shift details in one form so that roster maintenance is quick.

Acceptance criteria:

- On desktop, dragging across empty calendar time selects an initial range in
  15-minute increments and opens the create-shift form on release.
- Holding Alt/Option allows desktop range selection to begin over an existing shift;
  the gesture creates a new shift draft instead of opening shift details.
- On mobile, tapping empty calendar time opens a one-hour shift beginning at
  the tapped quarter hour.
- The calendar form allows the owner to change the date, exact start and end
  times, active employee, notes, and optional not-started jobs before saving.
- The employee is inferred from the Team-week employee filter. Creating from
  All team leaves the employee unselected until the owner chooses one.
- Owners can also create and exactly edit an employee's shifts from the
  employee directory sheet.
- Exact shift forms accept start and end times to the minute.
- Changing a form's start time advances the end time by the currently selected
  duration, including across midnight.
- Clicking an existing calendar shift opens its details.
- Right-clicking an existing shift as an owner opens actions to lock or unlock,
  duplicate, edit, or delete it. Edit includes the assigned active employee,
  date, exact times, and notes; duplicate opens a new unsaved shift with those
  values prefilled and does not copy job allocations.
- Owners can drag an existing shift to another date/time while preserving its
  employee and duration.
- Owners can drag the visible top or bottom edge handle to change only the
  shift start or end. Move and resize gestures snap to 15-minute boundaries,
  keep at least 15 minutes of duration, and save only on pointer release.
- Calendar move and resize use the shift version observed by the owner; stale,
  overlapping, invalid, cross-organisation, archived, or inactive-employee
  changes fail safely and restore the authoritative shift.
- Locking freezes every shift mutation except unlocking. Locked shifts remain
  visible and selectable, and the database enforces the lock across calendar
  and employee-profile mutation paths.
- Historical shifts remain visible and owner-editable, duplicable, or
  deletable unless locked. Deletion remains a confirmed soft archive so roster
  history is retained.
- Employee read-only calendars do not expose move or resize interactions.
- Exact editing from the employee profile remains the keyboard-accessible
  fallback for calendar move and resize.
- Existing shifts are exactly edited or archived from the employee profile,
  and archive requires confirmation.
- The calendar form can select zero or more jobs that are still in `assigned`
  status. In-progress, review, and archived jobs are not eligible.
- Selected jobs are assigned to the shift employee, scheduled at the shift
  start, and due at the shift end.
- Shift creation and all selected job changes succeed or fail as one database
  transaction, with normal assignment and system audit history.
- Later shift changes do not automatically alter jobs previously scheduled
  from that shift.
- A shift must end after it starts.
- Overlapping shifts for the same employee are rejected server-side.

#### CAL-04: Current-time indicator

As an owner, I want to see the current time on today's roster so that I can understand live coverage.

Acceptance criteria:

- A horizontal line is shown only when the displayed date range contains today.
- Its position reflects the viewer's browser-local current time.
- It updates on the next minute boundary, at least once per minute afterward, and immediately when the tab becomes visible again.
- The roster always fits the complete 24-hour day into the available calendar height.

#### CAL-05: Employee roster

As an employee, I want a read-only weekly roster with my allocated jobs so that
I know when I am working and what work is assigned during each shift.

Acceptance criteria:

- Employees can open Roster from authenticated navigation.
- Employees see only their own seven-day roster and cannot select another
  employee or switch to the organisation Team-day view.
- Add, drag, tap, edit, archive, employee-selection, and job-assignment controls
  are not available to employees.
- Shift details include currently assigned jobs whose scheduled interval
  overlaps that shift, with links to the employee's permitted job detail.
- Previous week, next week, Today, viewer timezone, and live-current-time
  behaviour remain available.
- Existing employee self-read RLS remains the authoritative roster and job
  boundary.

### 3.8 Progressive Web App

V1 provides an installable application shell plus narrowly scoped offline job
execution for employees. Supabase remains authoritative; IndexedDB stores a
membership-scoped read cache, pending photo blobs, and an operation outbox.
Owner mutations, roster/calendar data, administration, push notifications, and
background-only synchronisation remain online-only or outside V1.

The implementation follows the [Next.js Progressive Web App guide](https://nextjs.org/docs/app/guides/progressive-web-apps).

#### PWA-01: Installable application

As an owner or employee, I want to install the dashboard on my device so that it launches like an application.

Acceptance criteria:

- `app/manifest.ts` returns a valid typed web app manifest.
- The manifest defines the product name, short name, description, `/dashboard` start URL, standalone display mode, portrait-primary orientation, theme colour, background colour, and relevant application categories.
- The application includes valid 192×192 and 512×512 PNG icons, including a maskable icon, plus an Apple touch icon.
- Production and staging serve the application over HTTPS.
- Supported browsers recognise the deployed application as installable.
- Authenticated employee pages provide non-blocking floating installation guidance when the application is not already running in standalone mode.
- iOS guidance explains the Share → Add to Home Screen flow.
- The UI does not depend exclusively on the non-standard `beforeinstallprompt` event.

#### PWA-02: Service worker lifecycle

As a user, I want installed application resources to update safely so that I do not remain on an obsolete application shell.

Acceptance criteria:

- A same-origin service worker is served from `/sw.js` and registered with scope `/`.
- Registration uses `updateViaCache: "none"`.
- The service worker has explicit install and activate lifecycle handling.
- The service worker does not cache authenticated API responses, Supabase requests, uploaded evidence, signed asset URLs, or mutation responses.
- Offline employee data is stored in membership-scoped IndexedDB rather than CacheStorage.
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

#### PWA-04: Offline employee work pack

As an employee, I want my assigned work available during temporary connectivity
loss so that I can continue completing a job in the field.

Acceptance criteria:

- While online, the application persists a minimal work pack containing the
  employee's assigned and in-progress jobs, evidence requirements, relevant
  notes, and the canonical version of each job.
- The cache is scoped to the current membership and organisation and is purged
  on logout, membership change, or successful online detection of deactivation.
- Cached work packs expire 24 hours after the last successful online refresh,
  show the last-updated timestamp, and are not presented as usable current work
  after expiry.
- An offline reload opens a generic application shell and then renders the
  available cached work pack without caching authenticated HTML or Supabase
  responses in the service worker.
- The interface clearly shows Offline, last updated, pending-change count, and
  per-operation `pending`, `syncing`, `failed`, or `needs_attention` state.
- Before offline storage is enabled, the employee is told that cached job data
  and pending photos remain readable to anyone who can use the unlocked device;
  V1 assumes a personally controlled, device-lock-protected browser profile and
  does not add a separate application PIN.
- Owner, employee administration, roster/calendar, templates, schedules,
  review, and archive mutations remain online-only.

#### PWA-05: Offline job actions and evidence

As an employee, I want to record job progress while offline so that notes and
photos are not lost when a worksite has poor connectivity.

Acceptance criteria:

- Starting an assigned job, adding a progress note, adding a completion photo,
  and requesting submission can be queued offline.
- Each queued operation receives a permanent client-generated UUID and records
  the job version it was based on.
- Operations are applied optimistically to the local view and persisted in an
  IndexedDB outbox before the UI reports them as queued.
- Photo blobs are stored separately from operation metadata, checked against
  available browser storage, and retain the existing image type, size, and
  per-job count limits.
- The application may request persistent browser storage where supported, but
  denial cannot block normal online operation.
- Signed evidence URLs are never cached; pending local blobs are discarded only
  after authoritative upload acknowledgement or explicit user-approved removal.
- A queued submission remains dependent on every required note and photo being
  acknowledged and is revalidated server-side before transition.

#### PWA-06: Idempotent foreground synchronisation

As an employee, I want queued work to synchronise safely when connectivity
returns so that retries do not duplicate or corrupt my job history.

Acceptance criteria:

- Foreground synchronisation runs on application launch, focus, a successful
  connectivity probe, and an explicit Sync now action.
- Synchronisation refreshes the Supabase session and revalidates active
  membership, organisation, current assignment, and job state before replay.
- Operations replay in dependency order through idempotent, transactional
  Supabase RPCs using `(membership_id, client_operation_id)` receipts.
- A repeated acknowledged operation returns its prior result without creating
  duplicate notes, assets, audit events, or state changes.
- Notes merge when the employee remains authorised; an already-started job
  treats a repeated start as success; photos use deterministic,
  non-overwriting paths.
- Version conflicts return a typed result. Reassigned or archived jobs and
  inactive memberships stop replay and preserve local work as Needs attention.
- Submission runs only after dependent evidence has synchronised and the server
  confirms all evidence requirements.
- Failed operations remain visible with a safe retry path; the application never
  claims queued work has reached the server before acknowledgement.
- Browser Background Sync may be added later as progressive enhancement but is
  not the primary or required synchronisation mechanism.

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

- Owners receive the employee-column Kanban board, filters, creation, and review tools.
- Employees receive their own active and review jobs in a mobile-friendly list.
- Job detail may use a nested route or route-addressable drawer, but direct linking and refresh must preserve the selected job.

### `/dashboard/templates`

- Owner-only route for reusable job templates and daily or weekly schedules.
- Owners can create, edit, activate, and deactivate templates.
- Owners can create, edit, pause, resume, inspect, retry, and soft-delete schedules.
- Employees cannot access the route or receive template, schedule, or occurrence
  data.

### `/dashboard/roster`

- Requires an active membership and is linked for owners and employees.
- Owners receive one editable layered organisation-week view with an optional
  employee filter.
- Employees receive a self-scoped, read-only week view with currently assigned
  jobs associated with the relevant shifts.

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
- `role`: `owner`, `manager`, or `employee`
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
- At least one active owner remains in each organisation.
- At most two owner memberships may be invited or active.
- Role and access transitions are performed through authorised transactional
  functions and recorded in an immutable role audit.

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
- `version`, incremented by every authoritative job mutation
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

### 6.10 `job_operation_receipts`

- `id`
- `organisation_id`
- `membership_id`
- `job_id`
- `client_operation_id`
- `operation_type`
- `result`
- `created_at`

Constraints:

- `(membership_id, client_operation_id)` is unique.
- Receipts are written atomically with the authoritative job mutation, audit
  update, and asset metadata they acknowledge.
- Employees can access receipts only for their own membership and assigned jobs;
  owners can inspect organisation receipts for support and audit purposes.

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
- Offline photo uploads use deterministic, non-overwriting storage paths derived
  from the operation UUID.
- Verify current Supabase upload guidance during S10 and use resumable uploads
  where required by the supported evidence size and network conditions.

## 8. Architecture and security

### 8.1 Next.js

- Use Server Components for initial reads and role-specific page composition.
- Use Server Actions for authenticated mutations.
- Use client components only where browser state or interaction is required, including drag/drop, calendar range selection, upload progress, and optimistic updates.
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
- Offline-capable employee mutations use idempotent RPCs that lock the job,
  verify membership and assignment, compare the expected job version, apply the
  mutation, append audit data, and record the operation receipt atomically.
- Receipt lookup never substitutes for current authorisation checks.

### 8.3 Email

- Resend is configured as Supabase Auth SMTP.
- Initial employee invitations continue to use Supabase Auth SMTP.
- The application uses the Resend API to notify the active job-creator owner
  after each distinct employee submission.
- Submission email includes job and submitter context plus a direct review
  link, but never attaches private evidence or embeds signed evidence URLs.
- Submission remains successful when delivery fails; delivery state is
  persisted and owners can retry failed notification email.
- Assignment, feedback, reopen, roster, and other completion notification
  emails remain post-V1 work.
- Tests must not send real email.

### 8.4 Progressive Web App

- Use the App Router `app/manifest.ts` metadata convention.
- Register the service worker from a small client-only component mounted by the application shell.
- Precache only versioned public application assets, icons, and a generic
  offline entry shell; never cache authenticated HTML, Supabase responses,
  signed URLs, or mutation responses in CacheStorage.
- Store employee work packs, outbox metadata, and pending photo blobs in
  versioned, membership-scoped IndexedDB stores.
- Purge local operational data on logout or membership change and after online
  confirmation that the employee is inactive.
- Use foreground/manual synchronisation as the reliable baseline. Treat browser
  Background Sync as a future progressive enhancement.
- Serve production and staging over HTTPS.
- Configure global and `/sw.js` security headers through `next.config.ts`.
- Treat install guidance as progressive enhancement; the web application remains fully usable without PWA support.
- Keep push subscriptions, VAPID keys, offline owner/admin/roster mutations,
  and background-only synchronisation outside V1.

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

The remaining schedule prototype cluster may still inform S08 recurrence,
occurrence positioning, optimistic schedule movement, and timezone-aware
generation. `query-provider.tsx` remains explicitly reserved for the S10
offline persistence audit, and `supabase/json.ts` remains as a generic JSON
payload reference.

S01 consumed and verified the Supabase browser, server, admin, environment,
session-cookie, and thin root Proxy prototypes. Those six obsolete reference
files were removed; their maintained production replacements are
`lib/supabase/browser.ts`, `lib/supabase/server.ts`,
`lib/supabase/admin.ts`, `lib/supabase/public-env.ts`,
`lib/supabase/server-env.ts`, `lib/supabase/proxy.ts`, and the root
`proxy.ts`.

S04 consumed the Kanban layout, drag/drop, filtering, optimistic movement, and
rollback concepts from `components/ref-files/dashboard-workspace.tsx`. The
verified production implementation now lives in the repository-native Jobs
modules, and the obsolete reference duplicate was removed.

S05–S07 established maintained production email, roster-time, calendar,
dialog/drawer, and route implementations. The superseded Resend examples,
duplicate roster-time helper, legacy login page, and legacy roster page wrapper
were removed. Production email delivery remains in `lib/email/**`; roster
timezone and calendar behaviour remain in `lib/roster/**`,
`components/roster-calendar.tsx`, and the `/dashboard/roster` route.

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
- Optimistic state changes roll back when the server rejects them; transactional
  calendar creation remains pending until the server confirms it.
- Upload errors identify invalid type, excessive size, limit reached, or network failure.
- Empty dashboards, boards, directories, and calendars provide a relevant owner action.
- Unauthorised access returns a safe not-found or redirect response without exposing record existence.
- Route-level error boundaries offer retry where appropriate.

## 10. Accessibility and responsive behaviour

- All core workflows are keyboard accessible.
- Drag/drop and calendar range-selection actions have a non-drag alternative.
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
- IndexedDB schema migration, work-pack expiry, outbox dependency ordering, and
  membership-scoped purge behaviour.
- Offline operation states, storage-quota handling, and typed conflict
  presentation.

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
- Job version increments and transactional operation receipts.
- Idempotent replay, concurrent-version conflicts, deactivation, reassignment,
  archive, and cross-organisation rejection.

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
12. Employee loads a work pack online, goes offline, reloads, starts work, adds
    a note and photo, and queues submission with visible pending state.
13. Connectivity returns and queued operations synchronise exactly once in
    dependency order before submission reaches review.
14. Reassignment, archive, deactivation, and version-conflict scenarios retain
    unsynchronised work as Needs attention without forcing a mutation.
15. Manifest, icons, generic offline shell, and service worker are available
    with the required metadata and response headers.
16. The application remains usable when service workers or persistent browser
    storage are unavailable.
17. Signed-out dashboard requests redirect to login, signed-in login/root
    requests redirect to the dashboard, and public Auth/PWA resources remain
    reachable.

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
- Verify installability and graceful degradation; offline operational behaviour
  is added separately in Step 10.

### Step 4: Owner jobs and Kanban

- Implement the job schema, transitions, owner creation flow, three-column workflow board, filters, and assignment/reassignment.

### Step 5: Employee job execution and owner review

- Implement start/resume, notes, evidence, submission, comments, review, reopen/reassign, and archive.

### Step 6: Roster data and views

- Implement shift schema, RLS, overlap protection, employee week view,
  layered organisation week view, and employee shift summary.

### Step 7: Roster interactions

- Add desktop drag-to-select and mobile tap-to-create on empty roster time,
  followed by an exact shift form with optional transactional assignment and
  scheduling of not-started jobs. Keep existing-shift edit/archive management
  in the employee profile.

### Step 8: Templates and schedules

- Implement templates and idempotent daily/weekly job generation with retry visibility.

### Step 9: Operational dashboards

- Compose the verified employee, job, and roster query contracts into owner and employee dashboards.

### Step 10: Owner, manager, and employee access governance

- Add the database-enforced role hierarchy, owner invariants, role audit, and
  least-privilege membership transitions.
- Let managers manage employees and operations while remaining assignable
  workers whose submissions require owner review.
- Add shared hierarchical review queues and per-recipient idempotent
  notifications.
- Verify owner, manager, employee, inactive, and cross-organisation boundaries
  in database, server, component, and browser tests.

### Step 11: Offline assigned-worker job completion

- Add the membership-scoped IndexedDB work pack, pending-photo store, operation
  outbox, generic offline shell, and visible synchronisation states.
- Add versioned, idempotent Supabase RPCs and operation receipts for offline
  start, note, photo, and submission replay.
- Verify foreground/manual sync, conflict handling, logout/deactivation purge,
  storage-pressure failure, reload recovery, and exactly-once behaviour.

### Step 12: Integration and production hardening

- Resolve all deferred cross-step TODOs.
- Complete end-to-end coverage, responsive QA, accessibility checks, security verification, and staging readiness.

## 13. Prototype and production readiness

### Prototype acceptance

- Critical owner, manager, and employee Playwright journeys pass.
- Owner pages work at desktop width.
- Employee dashboard, jobs, notes, and photo upload work at a mobile viewport.
- Employee offline start, notes, photos, queued submission, foreground sync, and
  Needs attention recovery work at a mobile viewport.
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
- Offline work-pack expiry, logout purge, storage-pressure handling, and
  exactly-once replay are verified in staging on supported mobile browsers.
- A staging smoke test passes before deployment.

## 14. Deferred work

The following are explicitly outside V1:

- Public owner signup and company onboarding.
- Multi-company switching.
- Payroll and timesheets.
- Clock-in and clock-out.
- Leave requests and availability management.
- Offline roster/calendar, owner, review, administration, template, and
  schedule support.
- Background-only synchronisation.
- Push notifications.
- Job email notifications beyond submission-to-review, and all roster email
  notifications.
- Non-image job attachments.
- Employee-to-employee profile or job visibility.
- Advanced recurrence rules.
- Shift-start-triggered job generation.
- Comment editing or deletion.

## 15. Open work after V1

- Add email or push notifications for assignment, reassignment, owner
  feedback, reopened jobs, and roster changes.
- Add platform-admin and multi-organisation support.
- Add configurable company onboarding and owner self-service signup.
- Add richer reporting, exports, and employee workload analytics.
- Add leave, availability, time tracking, and payroll integrations as separate product areas.
- Add Background Sync as a progressive enhancement where browser support and
  product policy permit it.
