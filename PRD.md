# Pure Peninsula Honey V1

## Document status

- Status: Approved for implementation
- Version: 1.9
- Last updated: 29 July 2026
- Product timezone default: Australia/Melbourne
- Technical stack: Next.js 16, TypeScript, Supabase, Resend, Tailwind CSS, shadcn/ui, Playwright

### Development control

This document is the single source of truth for product scope, behaviour,
acceptance criteria, architecture, implementation status, and delivery
readiness. It consolidates the former `FEATURES.md` implementation register.

- Only one implementation step is active at a time. A step must be implemented, tested, documented, and checkpointed before the next step begins.
- Every step links its work to story identifiers and updates the delivery
  register in section 12.
- Installed project skills under `.agents/skills` are part of the implementation standard and must be used for matching Playwright, Supabase, Postgres, React, and Next.js work.
- Product decisions, implementation progress, cross-step TODOs, verification
  evidence, and production approval are all recorded here.
- When implementation exposes a missing or conflicting requirement, record the
  TODO immediately and update this document before resolving it in code.

## 1. Product overview

Pure Peninsula Honey is a responsive web application for companies that need to roster employees, assign operational jobs, collect completion evidence, and review completed work.

V1 supports one organisation per user and three roles:

- **Owner:** controls access and roles, manages all operations, and reviews
  employee and manager work. Owners may assign operational jobs to themselves.
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
- Let every signed-in role continue permitted operational work during temporary
  connectivity loss, including navigation to automatically prepared pages and
  queued mutations with explicit local and synchronisation states.
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
- After one successful sign-in and automatic preparation, an owner, manager, or
  employee can reopen any permitted dashboard route, navigate the application,
  and continue permitted operational work during temporary connectivity loss.
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
- Assign operational jobs to their own active membership.
- Create and manage job templates and schedules.
- Create shifts from the roster calendar, exactly edit and archive them from
  employee profiles, and assign not-started jobs while creating a shift.
- Comment on any job in their organisation.

An owner cannot assign an operational job to another owner.

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

#### AUTH-05: Password recovery

As a user, I want to request a password reset so that I can recover access
without an administrator changing my account.

Acceptance criteria:

- The login form sends a recovery link to the entered email and does not reveal
  whether the account exists.
- An authorised people manager can send a recovery link for an active account
  from the employee sheet; invited and inactive memberships do not offer it.
- Recovery verification redirects to a dedicated password-reset form and never
  activates or changes a membership.
- A successful reset signs the recovery session out and returns the user to
  login.
- A successful reset globally revokes the user's Supabase sessions. Connected
  application requests validate live Auth state so other browsers are rejected
  on their next online request; an offline browser is rejected when it
  reconnects.

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
- An assignee must be an active employee or manager in the organisation, or the
  active owner assigning the job to themselves.
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

V1 provides an installable, offline-first authenticated dashboard for every
role. Supabase remains authoritative; IndexedDB stores a membership-scoped
normalised replica, pending media blobs, an operation outbox, conflicts, and
sync metadata. After one successful sign-in and automatic preparation, every
permitted dashboard route and operational control remains usable during
temporary connectivity loss. First sign-in, account recovery, password changes,
and browser push enrolment remain connection-dependent.

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
- On an authenticated dashboard launch, a browser whose push permission is
  still `default` receives an immediate in-app opt-in prompt on every dashboard
  route. Its explicit Enable action requests browser permission and, when
  approved, creates and persists the device subscription; dismissal, denial,
  unsupported capability, or enrolment failure never blocks the standard
  application.
- Profile controls remain available to disable or re-enable push on the current
  browser. A granted browser with no subscription remains disabled until the
  user re-enables it from Profile.

#### PWA-04: Automatic role-scoped offline replica

As a signed-in user, I want every permitted dashboard page prepared
automatically so that an unexpected connection loss does not stop navigation or
hide operational context.

Acceptance criteria:

- A successful sign-in automatically stores all structured data the active role
  may access, all image thumbnails, and full-resolution media for active jobs.
- The replica includes dashboard aggregates, jobs and timelines, roster,
  employees visible to the role, templates, schedules, and the current profile.
- The replica is scoped to membership and organisation and is purged on logout,
  identity change, or online confirmation that access was revoked.
- The internal offline state reaches `Offline ready` only after the required
  structured data and media working set are durable; routine preparation and
  synchronisation state is not shown in the application chrome.
- The service worker caches a versioned public dashboard shell and immutable
  assets. It never caches authenticated HTML, API or Supabase responses, signed
  URLs, or mutation responses.
- Any `/dashboard/**` reload or deep link can restore the public shell and
  render the requested permitted route from IndexedDB without a server-rendered
  navigation.
- Cached organisational access remains usable for seven days after the most
  recent successful authorisation refresh. Expiry retains pending work but
  locks organisational views until access is revalidated.
- A device that has never completed preparation displays a clear
  connection-required state rather than an empty or misleading dashboard.
- Local data remains readable to anyone who can use the unlocked browser
  profile; V1 assumes a personally controlled, device-lock-protected device and
  purges operational data during logout rather than providing a separate
  application PIN or Profile storage control.

#### PWA-05: Offline navigation and optimistic operations

As a signed-in user, I want permitted pages and controls to behave consistently
offline so that work can continue in the field.

Acceptance criteria:

- Dashboard navigation, route-addressed details, filters, dialogs, forms,
  calendar controls, and browser back/forward use the local application shell
  and repository without requiring a React Server Component response.
- Every permitted job, roster, people, template, schedule, and profile database
  mutation can be queued offline. Invitation and email retry requests queue
  where safe; first sign-in, password/account recovery, and push enrolment
  explain that a connection is required.
- Each queued operation receives a permanent client UUID, typed entity
  reference, dependency list, expected entity version, payload, and creation
  time.
- Offline-created records use client UUID references until the server returns
  canonical bigint identifiers; dependent records are rewritten atomically.
- Operations are persisted before the UI reports success and are applied
  optimistically to the same view used online.
- Pending photos and avatars are stored separately, checked against available
  storage, and retain existing type, size, and count limits.
- Storage priority is pending user uploads, structured data, active-job
  originals, then thumbnails. Insufficient capacity prevents a false
  `Offline ready` state and retains the failure internally for retry.
- Connectivity, preparation, pending, sync, storage, lease, and conflict checks
  run behind the scenes without a global offline badge, popover, or Profile
  storage card.
- Offline logout immediately locks the application and purges organisational
  data; a non-sensitive marker completes server sign-out after reconnection.

#### PWA-06: Idempotent foreground synchronisation and conflicts

As a signed-in user, I want queued work to synchronise safely when connectivity
returns so that retries and concurrent edits do not duplicate or overwrite
work.

Acceptance criteria:

- Foreground synchronisation runs on application launch, focus, browser online,
  successful reachability probes while work is pending, and Realtime
  invalidation while connected.
- Synchronisation refreshes the session and revalidates active membership,
  organisation, role, permissions, and current entity versions before replay.
- Operations replay in deterministic dependency order through transactional
  Supabase RPCs using `(membership_id, client_operation_id)` receipts.
- Repeated acknowledged operations return their prior result without duplicate
  records, audit events, assets, deliveries, or transitions.
- Independent remote and local changes merge. A true same-record version
  conflict preserves both representations in a durable conflict record and
  never silently chooses a winner.
- A role change, deactivation, reassignment, archive, lock, or other permission
  failure stops the affected replay and preserves recoverable local work.
- Submission and other dependent transitions run only after their prerequisites
  are acknowledged and are revalidated by the server.
- Sync returns canonical entity changes, deletion tombstones, conflict results,
  client-to-server ID mappings, the organisation revision, and a renewed
  seven-day access lease.
- Browser Background Sync may remain a progressive enhancement; foreground
  synchronisation is the required correctness path.

## 4. Navigation and route acceptance

### `/login`

- Public route containing email/password login and password-recovery dispatch.
- No public signup or social login controls.
- Authenticated users are redirected to `/dashboard`.

### `/auth/confirm`

- Public callback route for Supabase invitation and password-recovery verification.
- Invitation verification links the pending membership and redirects to password setup.
- Recovery verification redirects to password reset without changing membership state.
- Displays a safe recovery state for invalid or expired verification data.

### `/set-password`

- Requires a valid invited-user session.
- Requires password and confirmation.
- Activates the employee membership and redirects to `/dashboard`.

### `/reset-password`

- Requires a valid password-recovery session.
- Requires password and confirmation using the application password policy.
- Updates the password, signs out the recovery session, and redirects to login.

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

### 6.10 `offline_operation_receipts`

- `id`
- `organisation_id`
- `membership_id`
- `entity_type`
- `entity_id`, nullable for locally created records until acknowledgement
- `client_operation_id`
- `operation_type`
- `result`
- `created_at`

Constraints:

- `(membership_id, client_operation_id)` is unique.
- Receipts are written atomically with the authoritative mutation and related
  audit or asset metadata they acknowledge.
- Users can access only receipts for their own membership; owners can inspect
  organisation receipts through authorised support tooling.

### 6.11 `organisation_sync_changes`

- `revision`, monotonically increasing bigint primary key
- `organisation_id`
- `entity_type`
- `entity_id`
- `operation`: `upsert` or `delete`
- `changed_at`

Constraints:

- Authoritative entity changes and deletion tombstones are recorded in the same
  transaction as their source mutation.
- Role-scoped sync functions filter the feed and returned canonical entities
  using the current active membership and normal application permissions.
- `(organisation_id, revision)` is indexed for incremental foreground sync.

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

- Use a Server Component boundary to authenticate the initial dashboard request
  and provide the minimal serialisable identity/bootstrap context.
- Render authenticated dashboard routes through one persistent Client Component
  application shell backed by the role-scoped local repository.
- Use non-cached Route Handlers for bootstrap, foreground sync, media tickets,
  and connection-dependent operations. Authenticate and authorise every handler
  independently.
- Use client-side history navigation inside `/dashboard/**` so routine route
  changes do not depend on a new RSC payload.
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
- Offline-capable mutations use typed idempotent RPCs that lock affected rows in
  deterministic identifier order, verify membership and permission, compare
  expected entity versions, apply the mutation, append audit/change-feed data,
  and record the operation receipt atomically.
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
- Precache only versioned public application assets, icons, and the public
  dashboard shell; never cache authenticated HTML, API or Supabase responses,
  signed URLs, or mutation responses in CacheStorage.
- Store normalised role-scoped entities, sync metadata, operation receipts,
  conflicts, ID mappings, cached media, and pending blobs in a versioned,
  membership-scoped IndexedDB database.
- Automatically prepare every role after sign-in and purge operational data on
  logout, membership/organisation change, or online confirmation that access is
  inactive.
- Use automatic foreground synchronisation as the reliable baseline, with
  manual recovery reserved for actionable failures or conflicts. Treat browser
  Background Sync as a future progressive enhancement.
- Serve production and staging over HTTPS.
- Configure global and `/sw.js` security headers through `next.config.ts`.
- Treat install guidance as progressive enhancement; the web application remains fully usable without PWA support.
- Keep background-only synchronisation outside V1. Web-push subscriptions are
  an opt-in connection-dependent capability for affected job assignees,
  rostered employees, and eligible job reviewers.

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
generation. `supabase/json.ts` remains as a generic JSON payload reference.

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
- IndexedDB schema migration, seven-day access expiry, normalised entity
  persistence, outbox dependency ordering, local-ID rewriting, and
  membership-scoped purge behaviour.
- Offline operation states, optimistic reducers, storage-priority/quota
  handling, sync-status presentation, and typed conflict recovery.

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
- Entity version increments, transactional operation receipts, sync revisions,
  and hard-deletion tombstones.
- Role-scoped bootstrap/change feeds and idempotent replay across job, roster,
  people, template, schedule, and profile mutations.
- Dependency ordering, local-ID mapping, concurrent-version conflicts,
  deactivation, role changes, reassignment, archive, locks, and
  cross-organisation rejection.

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
12. Each role completes automatic preparation, goes offline before visiting
    other pages, then navigates, reloads, and deep-links through every permitted
    dashboard route.
13. Each role performs representative job, roster, people, template, schedule,
    profile, and photo mutations offline with visible optimistic/pending state.
14. Connectivity returns and queued operations synchronise exactly once in
    dependency order, including locally created dependent records.
15. Concurrent edits, reassignment, archive, locks, deactivation, role changes,
    and version conflicts retain recoverable local work as Needs attention.
16. Seven-day expiry, cold-device preparation, storage pressure, offline logout,
    schema/service-worker upgrade, and revoked-access purge behave safely.
17. Manifest, icons, dashboard shell, and service worker are available with the
    required metadata and response headers.
18. The application remains usable online when service workers or persistent
    browser storage are unavailable.
19. Signed-out dashboard requests redirect to login, signed-in login/root
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

Development proceeds through the following verified steps. This register owns
step status, checkpoints, verification evidence, and cross-step TODOs.

At most one step may be `in_progress`. A step is `complete` only when its
implementation, permissions, tests, documentation, and checkpoint verification
are complete. `Verified` is reserved for confirmation during the final
integrated V1 release review.

Current release decision: **NO-GO**. S11 is complete and S12 is in progress, so
the application is not yet approved for production.

| Step | Capability                             | Status        | Checkpoint   | Verification summary                                                                                               |
| ---- | -------------------------------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| S00  | Product and implementation baseline    | `complete`    | `8a07533`    | Baseline documents, environment contract, and reference assets recorded                                            |
| S01  | Platform foundation                    | `complete`    | `2e26642`    | Lint, types, unit, database, desktop/mobile E2E, and build passed                                                  |
| S02  | Authentication and employees           | `complete`    | `049a0e9`    | Invitation, activation, employee lifecycle, storage, and isolation passed                                          |
| S03  | Progressive Web App shell              | `complete`    | `b43f944`    | Manifest, install assets, service-worker lifecycle, headers, and degradation passed                                |
| S04  | Owner jobs and Kanban                  | `complete`    | `f00c938`    | Workflow, assignment, permissions, and desktop/mobile board journeys passed                                        |
| S05  | Employee execution and owner review    | `complete`    | `ef897ef`    | Evidence, submission, review, notification, and private-storage checks passed                                      |
| S06  | Roster data and views                  | `complete`    | `ca99a70`    | Organisation and employee views, time handling, and scheduling passed                                              |
| S07  | Roster interactions                    | `complete`    | `18c1987`    | Desktop/mobile creation, exact editing, archive, and transactional assignment passed                               |
| S08  | Templates and job schedules            | `complete`    | `26e65e6`    | Timezone generation, uniqueness, retry, RLS, and desktop/mobile journeys passed                                    |
| S09  | Operational dashboards                 | `complete`    | `26e65e6`    | Role-specific composition, filters, loading states, and responsive journeys passed                                 |
| S10  | Access governance and review hierarchy | `complete`    | `f8431ee`    | Role hierarchy, owner invariants, review locking, notifications, and multi-user journeys passed                    |
| S11  | Offline assigned-worker completion     | `complete`    | working tree | 15 database, 165 unit, and 20 production desktop/mobile PWA checks passed; lint, types, build passed               |
| S12  | Integration and production hardening   | `in_progress` | working tree | Offline photo forced-400 retry passes in desktop/mobile Chromium; native Safari/Android staging acceptance remains |

### Step 1: Platform foundation — complete

- [x] Establish clean lint, type-check, build, and test baselines.
- [x] Configure the installed Playwright package, deterministic fixtures, test scripts, reports, and local web-server lifecycle using the project Playwright skill.
- [x] Add Supabase local configuration, organisations, memberships, seeds, clients, session handling, root Proxy, data-access authorisation, and initial RLS.

### Step 2: Authentication and employees — complete

- Implement login, invitation confirmation, password setup, and role-aware access.
- Implement employee directory, profile, invitation, deactivation, and avatar upload.

### Step 3: Progressive Web App shell — complete

- Add the manifest, install assets and guidance, minimal service-worker lifecycle, and security headers.
- Verify installability and graceful degradation; offline operational behaviour
  is added separately in Step 11.

### Step 4: Owner jobs and Kanban — complete

- Implement the job schema, transitions, owner creation flow, three-column workflow board, filters, and assignment/reassignment.

### Step 5: Employee job execution and owner review — complete

- Implement start/resume, notes, evidence, submission, comments, review, reopen/reassign, and archive.

### Step 6: Roster data and views — complete

- Implement shift schema, RLS, overlap protection, employee week view,
  layered organisation week view, and employee shift summary.

### Step 7: Roster interactions — complete

- Add desktop drag-to-select and mobile tap-to-create on empty roster time,
  followed by an exact shift form with optional transactional assignment and
  scheduling of not-started jobs. Keep existing-shift edit/archive management
  in the employee profile.

### Step 8: Templates and schedules — complete

- Implement templates and idempotent daily/weekly job generation with retry visibility.

### Step 9: Operational dashboards — complete

- Compose the verified employee, job, and roster query contracts into owner and employee dashboards.

### Step 10: Owner, manager, and employee access governance — complete

- Add the database-enforced role hierarchy, owner invariants, role audit, and
  least-privilege membership transitions.
- Let managers manage employees and operations while remaining assignable
  workers whose submissions require owner review.
- Add shared hierarchical review queues and per-recipient idempotent
  notifications.
- Verify owner, manager, employee, inactive, and cross-organisation boundaries
  in database, server, component, and browser tests.

### Step 11: Offline assigned-worker job completion — complete

- Add the membership-scoped IndexedDB work pack, pending-photo store, operation
  outbox, generic offline shell, and visible synchronisation states.
- Add versioned, idempotent Supabase RPCs and operation receipts for offline
  start, note, photo, and submission replay.
- Verify foreground/manual sync, conflict handling, logout/deactivation purge,
  storage-pressure failure, reload recovery, and exactly-once behaviour.
- Do not begin S12 until offline database, unit/component, desktop/mobile
  Playwright, online regression, lint, type-check, and build checks pass.

Checkpoint evidence (2026-07-29):

- Added the offline assigned-worker portion of the squashed release-candidate
  migration `20260729074337_offline_push_realtime_hardening.sql`, regenerated
  combined Supabase types, and passed all 15 targeted database assertions
  covering versioning, idempotency, conflicts, dependencies, assignment,
  membership, and organisation boundaries.
- Added the membership-scoped TanStack work pack, four isolated/versioned
  IndexedDB databases, consent and purge controls, durable ordered operation
  outbox, separate photo blobs, deterministic signed resumable uploads, and the
  production-only offline entry-shell recovery route.
- Passed 36 unit files / 165 tests, TypeScript, targeted and repository ESLint,
  the production build, and 20 desktop/mobile production-runtime PWA journeys.
  The end-to-end offline journey verified reload recovery and exactly one
  authoritative start, note, photo, and submission receipt.
- Used the Supabase, Supabase Postgres, Vercel React/Next.js, and Playwright
  project skills. Consumed the reserved query-provider persistence reference
  contract into repository-native modules and removed the reference duplicate.
  No environment variables changed.
- Resolved TODO-014. Foreground/manual synchronisation remains the reliable
  baseline; Background Sync remains deferred.

### Step 12: Integration and production hardening — in progress

- Resolve all deferred cross-step TODOs.
- Replace the assigned-worker-only offline work pack with the approved
  all-role, automatically prepared offline-first dashboard, generalised
  operation outbox, conflict centre, and seven-day role-scoped access lease.
- Add role-scoped bootstrap/incremental sync, organisation revisions and
  deletion tombstones, generalised receipts, entity versioning, and typed
  replay for every current operational domain.
- Add launch-time web-push enrolment with Profile opt-out/re-enable controls for
  job assignment/reassignment, roster assignment/change, and job submission,
  approval, and reopen review events. Exclude the actor, persist subscriptions
  and delivery attempts, and keep push failure non-blocking for the underlying
  mutation.
- Reconcile navigation, dependencies, headers, fixtures, shared UI, generated
  Supabase types, environment variables, and remaining reference code.
- Complete end-to-end coverage, responsive QA, accessibility checks, security
  verification, operational documentation, and staging readiness.
- Record every automated result and manual reviewer decision in section 13.

Automated implementation evidence (2026-07-29):

- Added the web-push schema, Realtime invalidation hardening, and subscription
  grants to the squashed release-candidate migration
  `20260729074337_offline_push_realtime_hardening.sql`; regenerated combined
  types; and passed all 10 pgTAP files / 316 assertions plus schema lint.
- Added active-membership/RLS-scoped multi-device push subscriptions,
  transactionally deduplicated job and roster events/deliveries, actor
  exclusion, generic same-origin payloads, Profile opt-in/out, denied and
  unsupported states, service-worker deep links, and the JWT-protected
  `dispatch-web-push` Edge Function. The Edge runtime bundled and served the
  dispatcher successfully.
- Added retry/permanent-failure delivery state, `404`/`410` subscription
  deactivation, non-blocking delivery semantics, safe mutation logging, and the
  deployment/backup/rollback/incident runbook.
- Reconciled the lockfile and generated types; hardened Proxy exclusions,
  service-worker/global headers, Realtime version invalidations, roster
  submissions, collision-safe database/browser fixtures, and production
  App-Router assertions.
- Passed frozen-lockfile install, diff check, ESLint, TypeScript, 38 unit files /
  174 tests, 10 database files / 316 assertions, production build, and the full
  production-runtime Playwright gate: 84 passed and 4 intentional
  project-level skips across desktop/mobile.
- Added `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to `.env.example`; removed example
  Supabase key values. Real values still require local/deployment/Edge secrets.
- Resolved TODO-003, TODO-004, TODO-007, TODO-008, TODO-010, and TODO-011.
  S12 remains in progress until the named manual staging and real-device review
  below is completed.
- Responsive QA remediation removed redundant outer cards from the owner
  dashboard job, submitted, and roster sections, and replaced the mobile
  sidebar toggle path with an explicit 44px touch target that opens the
  navigation drawer. Targeted component and mobile-browser verification is
  recorded with the working-tree release candidate.
- Mobile/PWA interaction remediation moved Next.js static assets from
  cache-first to network-first service-worker handling and rotated the public
  shell cache. This prevents updated server markup from hydrating against stale
  React/Base UI bundles. Normal development now unregisters production service
  workers and removes their shell caches so Turbopack updates cannot be
  intercepted, while production and the explicit PWA test server retain the
  worker lifecycle.
- Consumed the reference localized-rendering contract into a repository-native
  deterministic timezone formatter. Server and Safari now produce identical
  date/time markup, preventing the dashboard-wide hydration failure that made
  client components appear unresponsive. The Playwright matrix now includes an
  iPhone WebKit project, and targeted touch tests cover shared buttons, tabs,
  selects, and the navigation drawer.
- The production build passed. The four critical mobile interaction,
  service-worker registration, cache-rotation, and deliberately poisoned-cache
  checks then passed five consecutive runs in both Mobile Chrome and Mobile
  Safari/WebKit (40/40).
- Removed the temporary pre-hydration mobile interaction instrumentation,
  hydration marker, diagnostic API, and its tests after the component and
  real-device interaction issues were isolated. No interaction-debugging client
  hooks or diagnostic endpoint ship in the release candidate.
- Real-device offline remediation removed persistent online/offline and
  Realtime-reconnecting chrome, prevents Realtime refresh/channel activity
  while offline, and keeps the assigned-work shell local-only until a browser
  online event or successful same-origin reachability probe. Queued operations
  retry automatically without a routine Sync control, while failed and
  `needs_attention` work remains visible beside the affected job.
- The browser Supabase client now replaces a loopback hostname with the page
  hostname only during LAN development, so Realtime and resumable uploads do
  not point back at a physical phone. Production URLs are never rewritten.
- Rotated the shell cache to `pph-shell-v5` and changed failed navigation from
  a second offline redirect to a direct cached-document response, preserving
  the requested job URL and avoiding WebKit's second-navigation failure mode.
- The isolated production PWA check passed 21 targeted mobile checks with one
  intentional WebKit service-worker replay skip. Mobile Chrome asserted zero
  Supabase requests while offline and exactly-once automatic replay after
  reconnect. Playwright does not cover this WebKit service-worker acceptance
  boundary, so real Safari over trusted HTTPS remains a required manual staging
  check.
- Hosted-backend preparation (2026-07-29): linked the `Management` Supabase
  project, applied the nine release migrations without a remote reset, and
  verified matching migration history, RLS on every public table, both private
  Storage buckets, the job-schedule Cron, and the active JWT-protected
  `dispatch-web-push` Edge Function. Loaded the deterministic test seed once for
  remote PWA/offline review and verified four Auth users, two organisations,
  five memberships and profiles, one roster shift, four jobs, four job updates,
  and successful hosted password authentication for the seeded owner and
  employee. Full application staging and manual review remain pending.
- Product contract expansion (2026-07-29): real-device testing demonstrated
  that the deliberately narrow assigned-work fallback made navigation and
  unprepared pages unusable after connection loss. S12 now owns the complete
  offline-first redesign in PWA-04–PWA-06. The prior S11 implementation remains
  a backward-compatible base until the v2 shell, repository, sync RPCs, and
  all-role acceptance suites replace it.
- Offline-v2 implementation checkpoint (2026-07-29): added automatic
  role-scoped bootstrap and general sync routes, a membership-scoped versioned
  IndexedDB repository, seven-day lease, durable outbox/blob/media/conflict
  stores, organisation change feed/tombstones, general receipts, entity
  versions, and local-ID mappings. The worker now caches only the public
  versioned dashboard shell and immutable assets, returns that shell for failed
  `/dashboard/**` navigations, and excludes authenticated HTML, API responses,
  and Supabase responses from CacheStorage.
- Replaced the employee consent/work-pack interface with background preparation
  after sign-in for every role. Removed the reachable and source-level
  `Enable offline work` flow, retired its query provider and assigned-work
  component, and made `Offline ready` contingent on structured data, promised
  media, the v7 shell cache, and current service-worker control.
- Converted current job, roster, people, template/schedule, and profile
  mutations to typed optimistic operations, including durable photos and
  avatars. Offline action handlers no longer request server-component
  refreshes; sidebar, filters, dialogs, close actions, and detail transitions
  use client history, and rapid consecutive work composes against the latest
  local snapshot.
- Added visible connectivity, pending, sync, storage, lease, and conflict
  states; the conflict popover preserves and displays local and server
  versions. Automatic sync runs after sign-in, reconnect, foreground return,
  and Realtime invalidation. Offline logout purges organisational data while
  retaining only a non-sensitive deferred sign-out marker.
- Folded the offline-first synchronization schema, receipt claims, delete-scope
  correction, and manager participant access into the release migration
  `20260729074337_offline_push_realtime_hardening.sql`; reset and seeded both
  local and linked environments from the canonical migration history.
  All 11 pgTAP files / 330 assertions and all 40 unit files / 180 assertions
  pass, as do ESLint and TypeScript.
- Targeted isolated production-runtime verification passes five desktop
  Chromium and five mobile-Chromium offline-v2 journeys. Coverage includes
  automatic bootstrap for owner/manager/employee, unseen permitted
  client-history routes, cold-device messaging, and employee
  start/note/photo/submit with reconnect and four exactly-once general
  receipts. Browser-engine offline emulation cannot certify a terminated PWA
  launch or native WebKit navigation fallback; installed iOS and Android
  staging reload/deep-link, upgrade, lease, revocation, storage-pressure, and
  conflict-resolution acceptance remain required. The release stays
  **NO-GO** and TODO-015 remains in progress.
- Hosted real-device reconnect follow-up (2026-07-29): the worker start and
  note receipts applied, but a failed signed Storage upload was still sent to
  replay without a `storagePath`. The photo receipt consequently failed, its
  dependent submission was withheld, and the client replaced the optimistic
  job with the partial server snapshot while leaving `Changes pending`.
  Remediation serialises refresh/sync, withholds unprepared uploads and their
  dependants from replay, verifies ambiguous signed-upload outcomes, retries
  transient work automatically, preserves the latest IndexedDB dependency
  chain, and reapplies pending job/photo/submission state over each canonical
  snapshot. Automated tests were intentionally not run for this follow-up at
  the product owner's request; deployed real-device replay remains pending.
- Job and navigation UI remediation (2026-07-29): mobile sidebar links now
  close the navigation drawer; assigned-worker job detail puts expanded history
  first, stages notes and photos behind a conditional Save action, uses an
  accessible full-width dashed photo picker, and closes with an immediate local
  transition. Requirement-satisfied assigned-work cards now own review
  submission, backed by filtered Supabase relationship counts and authoritative
  server validation. This deliberately overlaps the active offline optimistic
  action work in `components/offline-v2-provider.tsx` and
  `lib/offline-v2/optimistic.ts`; pending note/photo operations update the new
  optional card counts without changing the existing replay contract.
- Targeted remediation verification passed: ESLint for changed files,
  `pnpm typecheck`, 3 Vitest files / 27 tests, the execution/review Chromium
  journey (including its Pixel 7 worker flow), and the sidebar navigation check
  in both Mobile Chrome and Mobile Safari. No migration, RLS, environment, or
  public-route change was required.
- Offline photo reconnect remediation (2026-07-30): a hosted mobile retry could
  hide its pending image and satisfied requirements because reconnect switched
  rendering back to stale server data before the outbox was acknowledged.
  IndexedDB could also restore the upload body without its validated image MIME
  type, producing the observed signed Storage HTTP 400. A retry split across
  batches additionally treated an already-acknowledged and removed dependency
  as outstanding.
- Added a session-sticky local-repository view, separate from connectivity, so
  dashboard rendering, navigation, and mutation queuing continue against the
  optimistic IndexedDB snapshot after reconnect. Photo preparation now
  validates the MIME/extension pair, reconstructs a canonical `File`, verifies
  deterministic object paths before and after ambiguous uploads, retains
  retryable blobs and optimistic counts, and withholds dependent submission
  until photo acknowledgement. Cross-batch replay now blocks only dependencies
  still present in that batch.
- Verification passed changed-file ESLint, TypeScript, 4 focused Vitest files /
  25 tests, `git diff --check`, and the repaired staged note/photo plus Save
  journey in desktop Chromium and Mobile Chrome. The journey forces the first
  signed upload to return HTTP 400, proves the local photo, counts, and
  submitted state remain visible, then proves one successful retry produces
  exactly one note, asset, submission update, and receipt per operation before
  clearing the blob/outbox and surviving an authoritative reload. No database
  migration, RLS, environment-variable, or public-route change was required.
  Installed iOS Safari over trusted staging HTTPS remains the required
  real-device acceptance, so S12 and TODO-015 remain `in_progress`.
- Evidence presentation follow-up (2026-07-30): hosted Storage inspection
  confirmed the reported employee and owner tiles referenced valid PNG objects
  whose bytes matched the selected portrait screenshots; sync had not replaced
  or corrupted them. The shared gallery's square `object-cover` thumbnails were
  instead zooming tall evidence into a misleading centre crop. Evidence
  thumbnails now use contained scaling and open an accessible full-size viewer
  for both roles. Changed-file ESLint, TypeScript, the 10-test job-detail suite,
  `git diff --check`, and the employee Pixel 7 plus desktop-owner
  execution/review journey pass with decoded-image assertions in both viewers.
- Shared job-detail hierarchy follow-up (2026-07-30): reviewer sheets and
  assigned-worker dialogs/drawers now use the same decision-oriented order:
  job details, work and evidence, then history. The later UI-refinement
  checkpoint removed the separate comment composer in favour of the employee
  work-note surface labelled “Work note or comment”; legacy comments remain
  visible in collapsed History, and stored comment/offline contracts remain
  compatible without migration.
  The compact metadata grid sits immediately below the header divider without
  a redundant visible section title while retaining an accessible region name.
  Changed-file ESLint, TypeScript, 12 focused job-detail component checks, and
  `git diff --check` pass for both role-specific surfaces and the shared order.
- Dashboard/offline/push UI remediation (2026-07-30): removed the employee
  dashboard's nested roster/work section cards while retaining its greeting,
  plain headings, current shift, single next shift, and individual job cards.
  Owner and manager dashboards remain unchanged. Removed the global offline
  badge/popover from both dashboard shells and the Profile offline-storage card;
  automatic preparation, hidden provider state, queuing, replay, conflict
  retention, offline navigation, and logout purge remain intact.
- Push enrolment now runs once at the authenticated dashboard client boundary.
  A `default` permission immediately presents an in-app opt-in action and its
  user gesture requests browser access and persists approval; denied,
  dismissed, unsupported, and failed states remain non-blocking.
  Existing subscriptions are retained, while granted browsers without a
  subscription remain opted out until Profile re-enables them.
- Verification passed changed-file ESLint, `pnpm typecheck`, 2 focused Vitest
  files / 12 tests, 6 push Playwright checks across desktop Chromium, Mobile
  Chrome, and Mobile Safari, and 10 hidden-state offline checks across desktop
  Chromium and Mobile Chrome. No database migration, RLS, environment-variable,
  public-route, or reference-file change was required. Used the Vercel
  React/Next.js and Playwright project skills. S12 remains `in_progress` for the
  existing manual staging and real-device gates.
- Push permission-prompt remediation (2026-07-31): replaced the automatic
  hydration-time browser permission request with a visible dashboard-wide
  opt-in action so browser permission is requested from a user gesture. Profile
  now explains how to recover a browser-blocked site permission and keeps an
  active check-and-enable action available after the setting is changed.
  Changed-file ESLint, `pnpm typecheck`, 2 focused Vitest files / 15 tests, and
  `git diff --check` pass. The focused Chromium Playwright check could not enter
  the app because the configured `employee@example.test` account returned
  invalid login credentials; rerun remains part of the existing S12 integration
  gate. No database, RLS, environment-variable, public-route, or reference-file
  change was required. Used the Vercel React/Next.js and Playwright project
  skills; S12 remains `in_progress`.
- UI refinement checkpoint — dashboard (2026-07-30): aligned the dashboard
  route fallback with the flat operational-section presentation while retaining
  statistic and row-card geometry plus the accessible busy state. Changed-file
  ESLint and the 7-test loading-state component suite pass. No database,
  permission, environment-variable, public-route, or reference-file change was
  required. Used the Vercel React/Next.js and Playwright project skills; S12
  remains `in_progress`.
- UI refinement checkpoint — jobs (2026-07-30): added the mobile capped,
  scrollable creation drawer, scroll-safe desktop create/edit dialogs, a
  split-button template launcher, compact paired fields, capitalised priority
  display, a 0–10 completion-photo select, the shortened Require note control,
  and query-keyed employee detail remounting. Work notes are the single
  authoring surface while legacy comments remain in History. Changed-file
  ESLint, TypeScript, 21 focused component tests, and the desktop Chromium
  create/filter/reassign journey pass; the combined mobile browser checkpoint
  is recorded below. No schema, migration, RLS, permission, environment,
  offline-operation, or route contract changed.
- Job form refinement follow-up (2026-07-31): standardised employee-sheet
  profile field spacing; replaced inline job-form validation messages with a
  specific error toast and red invalid controls; aligned Require note with the
  adjacent control; and changed the assignment contract so an active owner is
  available to assign jobs to their own membership while other owners remain
  excluded. Added a new collision-safe Supabase migration plus focused
  component and database coverage. Changed-file ESLint, TypeScript, 10 focused
  component tests, and `git diff --check` pass. The focused database migration
  and pgTAP check remain deferred because Docker Desktop and the local Supabase
  stack were unavailable. No environment-variable or public-route change was
  required. Used the Vercel React/Next.js, Playwright, Supabase, and Supabase
  Postgres skills; S12 remains `in_progress`.
- Dashboard realtime correction (2026-07-31): restored the debounced App Router
  refresh that had been replaced by an offline-cache-only invalidation, while
  retaining the same coalesced event for the IndexedDB snapshot. Valid job,
  roster, membership, profile, evidence, review, template, and schedule
  broadcasts now refresh the mounted server screen and background offline
  replica together; malformed events, private role-scoped topics, reconnect
  recovery, stale-tab recovery, and channel cleanup remain enforced. The
  database trigger and manager-topic audit found complete existing coverage, so
  no migration, RLS, permission, environment-variable, or public-route change
  was required. Twelve focused realtime unit tests, changed-file ESLint,
  TypeScript, Prettier, and `git diff --check` pass. The expanded multi-user
  dashboard/jobs/roster Playwright journey and focused pgTAP checks are ready
  but remain deferred because the local Supabase database is unavailable.
  Used the Supabase, Supabase Postgres, Vercel React/Next.js, and Playwright
  project skills; S12 remains `in_progress`.
- UI refinement checkpoint — employees (2026-07-30): employee creation now
  uses a capped scrollable drawer on mobile and a scroll-safe dialog on
  desktop, with a centred circular photo picker, compact name/contact rows,
  capitalised role display, and a full-width Create and invite action.
  Changed-file ESLint, TypeScript, and 2 focused component tests pass.
- Employee UI refinement follow-up (2026-07-30): removed the job-title control
  and display from employee-directory create and detail surfaces while
  preserving existing stored titles and assigning new profiles a role-derived
  internal fallback. First/last name and email/phone now use paired 50/50 rows
  in both the desktop dialog and mobile drawer, with added field-label spacing;
  role remains full width. Directory and profile status presentation now uses
  one state label: Active for active memberships and Invite pending for invited
  memberships. Changed-file ESLint, TypeScript, 2 focused Vitest files / 3
  tests, and 3 focused desktop/mobile Chromium Playwright checks pass. No
  schema, migration, RLS, permission, environment-variable, public-route, or
  reference-file change was required. Used the Vercel React/Next.js and
  Playwright project skills; S12 remains `in_progress`.
- UI refinement checkpoint — roster (2026-07-30): paired employee/date in the
  create-shift form, expanded Create shift to full width, and allowed the
  employee filter to span mobile width while retaining its compact desktop
  width. Changed-file ESLint and all 19 focused roster-calendar component tests
  pass.
- UI refinement checkpoint — roster date and time (2026-08-02): anchored the
  date calendar beneath the complete date field rather than its calendar icon,
  so clicking anywhere in the field opens an aligned calendar. Replaced the
  browser-native time chooser in roster create/edit forms with the themed
  hour/minute picker while retaining precise typed `HH:MM` entry. Changed-file
  ESLint, TypeScript, and all 21 focused roster-calendar component tests pass.
  No schema, migration, RLS, permission, environment-variable, public-route,
  or reference-file change was required. Used the Vercel React/Next.js project
  skill; S12 remains `in_progress` for existing staging and real-device gates.
- UI refinement checkpoint — job and roster pickers (2026-08-02): constrained
  roster-picker choices to full-width hourly and quarter-hour controls, while
  retaining precise typed `HH:MM` entry. Scheduled and Due date-time popovers
  now open above their Jobs form controls. Changed-file ESLint, TypeScript,
  Prettier, and 33 focused roster/job component tests pass. No schema,
  migration, RLS, permission, environment-variable, public-route, or
  reference-file change was required. Used the Vercel React/Next.js project
  skill; S12 remains `in_progress` for existing staging and real-device gates.
- UI refinement checkpoint — profile (2026-07-30): capped the profile form
  section at `max-w-7xl` and made its identity/logout header stack on narrow
  screens so the logout action remains visible for every active role. Changed-
  file ESLint passes. No database, permission, environment-variable,
  public-route, or reference-file change was required; S12 remains
  `in_progress`.
- UI refinement checkpoint — self-profile (2026-07-30): made the header avatar
  the profile-photo picker, removed the separate replacement field, redundant
  dashboard return action, and sign-in identity explanation, and now reveals
  Save profile only after a field or photo changes. The existing online server
  action and unreachable/offline queued profile mutation remain authoritative
  for their respective connectivity states; push-notification settings remain
  independent. Changed-file ESLint, TypeScript, and four focused self-profile
  Playwright checks pass across desktop Chromium and Mobile Chrome; S12 remains
  `in_progress`.
- The jobs, employees, and roster UI checkpoints used the Vercel React/Next.js
  and Playwright project skills. They required no database, permission,
  environment-variable, public-route, or reference-file changes. S12 remains
  `in_progress` for the existing staging and real-device gates.
- UI refinement browser checkpoint (2026-07-30): 12 focused Playwright checks
  pass across desktop Chromium, Mobile Chrome, and Mobile Safari. Coverage
  proves desktop dialog versus mobile drawer selection, viewport-capped and
  scroll-reachable job/employee forms, split-template prefill, immediate
  employee job opening after client-side query navigation, the merged work-note
  copy, employee avatar preview/upload handling, and responsive roster form and
  filter controls. The existing full invitation lifecycle also reached and
  persisted the new employee/avatar successfully, then failed later at its
  unrelated generated invite callback (`/auth/confirm/error?reason=invalid`);
  that pre-existing integration gate remains deferred and does not change this
  UI checkpoint's result.
- Unified dashboard/offline correction (2026-07-30): this checkpoint explicitly
  replaces the preceding “IndexedDB is the normal mounted dashboard read
  source” and “online edits use the durable outbox” contracts. The authenticated
  App Router route, server-fetched view-model, normal Next navigation, server
  action, validation response, and `router.refresh()` are authoritative while
  the origin is reachable. A successful online mutation does not create an
  outbox operation or receipt. IndexedDB is a background role-scoped snapshot
  cache and an offline/unreachable mutation outbox only.
- Dashboard home, jobs and job detail, roster, employees and employee detail,
  templates/schedules, and self-profile now render shared production screen
  components from either server or cached view-models. The authenticated layout
  and the prepared `/offline` document share one dashboard chrome, including
  sidebar, responsive header, breadcrumb, install guidance, profile navigation,
  notification settings, logout, dialogs, drawers, filters, permissions,
  validation, and empty states. `/dashboard/employees/new` is retained only as
  a compatibility redirect to the employee directory's shared create dialog.
  Cache bootstrap no longer replaces or unmounts an online screen.
- The client state now separates `viewSource`, `networkReachability`,
  `canQueueOfflineMutation`, and `navigationMode`. Dashboard links use browser
  history only in cached mode. Pending operations and conflicts keep the shared
  cached screen mounted through reconnect until replay acknowledgement;
  successful replay applies canonical mappings and patches before refreshing the
  App Router. A confirmed same-origin failure retries as `unreachable`, while an
  online server-action failure is never automatically duplicated into the
  outbox. Development service-worker cleanup and registration now share one
  policy, and the consolidated public shell cache is version 8; private data,
  media, and mutations remain in IndexedDB.
- Verification passed changed-file ESLint, TypeScript, 6 focused Vitest files /
  27 tests, the production build, and all 14 affected offline-dashboard
  Playwright checks across desktop Chromium and Mobile Chrome. The online App
  Router navigation, server-action/outbox-empty, and delayed-bootstrap
  form-preservation regressions each passed five consecutive runs on both
  projects (30/30 repeat checks). The cold-device shell-registration regression
  also passes on both projects. One broader unit run produced 224 passing tests
  and one transient status-select interaction failure; its isolated 5-test file
  passed immediately on rerun. No migration, RLS, environment-variable, public
  route, or private-media CacheStorage contract changed. Used the Supabase,
  Vercel React/Next.js, and Playwright project skills. S12 and TODO-015 remain
  `in_progress` for the existing native iOS/Android staging gates, so the release
  remains **NO-GO**.
- Production diagnostics cleanup (2026-07-30): removed the development-only
  dashboard payload logger so role, job, roster, and timezone summaries are no
  longer emitted to the server console. Changed-file ESLint, TypeScript, and a
  repository search for the debug marker pass; no behaviour, schema, permission,
  environment-variable, or route contract changed.
- Invitation email refinement (2026-07-30): restyled the Supabase invite
  template with the product's yellow and neutral palette, the centred
  transparent bee logo, borderless email-safe table
  layout, centred copy, clear acceptance action, and unexpected-invitation
  guidance. The existing token-hash invite route remains unchanged. Template
  validation and `git diff --check` pass; no schema, permission,
  environment-variable, public-route, or reference-file change was required.
- Owner submission-email refinement (2026-08-02): audited the only V1
  application email sent to an owner (the job-submission review notification)
  and restyled it to match the invitation email's yellow and neutral palette,
  centred bee logo, borderless email-safe table layout, clear completion
  summary, and prominent review action. The recipient, direct review link,
  idempotent delivery ledger, and private-evidence exclusion are unchanged.
  The focused Vitest template checks, changed-file ESLint, and `git diff
--check` pass; no schema, permission, environment-variable, public-route, or
  reference-file change was required. S12 remains `in_progress` for the
  existing native iOS/Android staging gates.
- Password-recovery email refinement (2026-08-02): added and configured the
  Supabase Auth recovery template with the same yellow and neutral palette,
  centred bee logo, email-safe table layout, reset-password action, and safe
  unexpected-request guidance as the invitation email. The standard Supabase
  `{{ .ConfirmationURL }}` recovery flow is preserved. Prettier template
  validation, configuration/path placeholder checks, and `git diff --check`
  pass; no schema, permission, environment-variable, public-route, or
  reference-file change was required. S12 remains `in_progress` for the
  existing native iOS/Android staging gates.
- Password-recovery application flow (2026-08-02): added non-enumerating
  recovery dispatch from the cardless login form, active-account recovery from
  the employee sheet, explicit recovery-token verification, an HTTP-only
  recovery marker, and the dedicated `/reset-password` flow without changing
  invitation activation or membership state. Changed-file ESLint, TypeScript,
  4 focused Vitest files / 17 tests, the production build, template checks, and
  `git diff --check` pass. The targeted Chromium authentication check remains
  blocked before browser launch because the local Supabase container is not
  running. A broader Vitest invocation produced 235 passing tests and the
  previously documented transient employee-status select interaction failure;
  the exact affected password-recovery suite passes. No schema, migration,
  environment-variable, or offline-queue contract changed. S12 remains
  `in_progress` for the existing native iOS/Android staging gates.
- Password-reset form styling refinement (2026-08-02): removed the recovery
  form card and matched the login screen's centred white heading treatment
  without changing recovery-session, validation, or password-update behaviour.
- Authentication layout consistency refinement (2026-08-03): moved login,
  invitation password setup, password reset, and invalid-or-expired-link states
  into one shared centred `max-w-sm` shell. The remaining setup and link-error
  cards are removed, leaving text, inputs, alerts, and actions only; no Auth
  session, validation, recovery, invitation, permission, environment-variable,
  or route behaviour changed. Changed-file ESLint, TypeScript, four focused
  component test files / nine tests, and `git diff --check` pass. S12 remains
  `in_progress` for the existing native iOS/Android staging gates.
- Employee reset-control refinement (2026-08-02): reduced the active-account
  reset action to a one-fifth icon control with an accessible password-reset
  label and hover/focus tooltip; delivery and access behaviour are unchanged.
- Employee action independence correction (2026-08-02): separated reset-email
  and access-management transition state so each control disables only while
  its own operation is pending and adjacent actions remain clickable.
- Password-reset session invalidation hardening (2026-08-02): made recovery
  sign-out explicitly global and replaced locally verified claims with live
  Supabase Auth user validation at the root proxy and server membership
  boundaries. Revoked browsers are redirected on their next connected request;
  offline clients retain the established reconnect-time validation contract.
  Three focused Vitest files / eight tests, changed-file ESLint, TypeScript, the
  production build, and `git diff --check` pass; no schema, migration, or
  environment-variable change was required.
- Brand refinement (2026-08-02): changed the user-facing product name to Pure
  Peninsula Hone across root metadata, Apple web-app metadata, PWA manifest and
  install guidance, service-worker notification copy, Auth email subjects and
  templates, job-submission email image text, documentation, and the local
  seeded organisation. Focused manifest, PWA-install, and submission-email
  tests pass; no schema, permission, environment-variable, or route contract
  changed. S12 remains `in_progress` for the existing native iOS/Android
  staging gates.
- PWA install-name refinement (2026-08-02): the manifest `short_name` and
  Apple web-app title are now `PPH`, while the full product name remains Pure
  Peninsula Honey. The focused manifest Vitest check passes; the configured
  browser check remains blocked because the local Supabase Docker container is
  unavailable. No schema, permission, environment-variable, or route contract
  changed. S12 remains `in_progress` for the existing native iOS/Android
  staging gates.
- Hosted seed maintenance (2026-07-30): added `hello@simonbeirouti.com` as the
  sole seeded user and active owner of the Pure Peninsula Honey organisation.
- Sidebar identity refinement (2026-07-30): replaced the generated building
  icon with the checked-in `public/logo.png` asset and removed the current
  user's role from the organisation header. The logo fills the complete 32px
  icon tile in both expanded and collapsed states, covering the button hover
  background consistently with the previous organisation icon treatment.
  Changed-file ESLint passes; no schema, permission, environment-variable,
  public-route, or reference-file change was required. S12 remains
  `in_progress` for the existing native iOS/Android staging gates.
  Removed all deterministic example users, organisations, shifts, jobs, and job
  updates from the seed. The repository `supa` wrapper reset the linked remote
  database, replayed all migrations, and applied `supabase/seed.sql`; a linked
  read-only query verified the owner and absence of example records.
- Auth origin maintenance (2026-07-30): invitation callbacks remain derived
  from the incoming request origin rather than a hard-coded deployment URL.
  Local Supabase Auth uses `http://localhost:4000`; the hosted project uses
  `https://pph-sage.vercel.app`, with each origin's exact `/auth/confirm`
  callback in the redirect allow-list.
- Local-first employee access correction (2026-07-30): restored the existing
  create-and-invite dialog to the hydrated local-repository employee directory
  used during normal online operation. Owners retain role selection and managers
  retain employee-only creation; queued creation continues to use the existing
  durable membership operation.
- Archived-jobs refinement (2026-07-30): replaced the archived Kanban-style
  column and its full-height wrapper with the same open responsive card grid
  used by Templates. Each compact card identifies the completed job, assignee,
  and archive time, and links to the preserved job detail. The server jobs page
  now requests an exact archived count and only the selected 15-row range while
  retaining the complete non-archived workflow; URL-backed Previous/Next
  controls reject invalid or out-of-range archive pages. Changed-file ESLint,
  TypeScript, all 9 focused job-workspace component tests, and
  `git diff --check` pass. A read-only hosted Supabase query also verified the
  exact-count, stable-order, inclusive `range(0, 14)` contract against the
  configured production project (0 current archived rows). No migration, RLS,
  permission, environment-variable, or public-route change was required; S12
  remains `in_progress`.
- Job deletion restoration (2026-07-31): replaced each editable job card's
  inline edit control with a three-dot menu containing Edit and Delete. Delete
  requires confirmation and is limited to operations roles deleting unsubmitted,
  unscheduled jobs; the protected database RPC removes unfinished activity and
  evidence metadata, then the server action removes related private storage.
  Submitted/review and schedule-managed jobs remain preserved history. Added a
  migration and focused component/database coverage. Changed-file ESLint,
  TypeScript, and the focused component suite pass; local database migration and
  pgTAP verification are deferred because the local Postgres service is not
  running. S12 remains `in_progress`.
- Instant PWA job opening (2026-08-02): added the authenticated dynamic
  `GET /api/jobs/[jobId]` route with private no-store responses and existing
  membership/RLS job access, and changed Jobs-screen Open Job links to retain
  their accessible deep-link `href` while opening prepared IndexedDB detail in
  place. Online opens show the cached detail immediately, make one background
  detail request without a Jobs RSC navigation, suppress stale responses, retain
  cached content with a retry affordance on refresh failure, and write a fresh
  authorised response back without replacing pending optimistic job work.
  Offline clicks remain on the established local-repository history path and
  use the prepared snapshot only. Evidence previews now lazy-load and decode
  asynchronously. The additive
  `20260802135303_offline_job_detail_sync_targets.sql` migration adds parent
  job targeting to the private sync feed/RPC for jobs, updates, assets, and
  notification deliveries; delta sync now fetches, patches, and prepares media
  for only affected job details, with legacy feed rows retaining the full-detail
  fallback. Initial media preparation now uses a three-request bounded pool.
  Added focused route, controller, patch, database, and delayed-endpoint PWA
  coverage (the new PWA journey runs in both desktop and mobile Chromium
  projects). Focused Vitest (38 tests), changed-file ESLint, TypeScript,
  `git diff --check`, and production build pass. On 2026-08-03, deployed this
  migration together with the already-merged
  `20260731000325_allow_owner_self_job_assignment` migration to the linked
  remote database. `./supa migration list --linked` confirms both remote
  history entries, and a read-only remote query confirms both
  `organisation_sync_changes.related_job_id` and the matching
  `get_offline_sync_changes` RPC return field. `pnpm exec supabase test db`
  and the Chromium Playwright journey remain blocked because the local Docker
  daemon (and therefore the local Postgres service) is unavailable; the new
  pgTAP and production-PWA checks plus the existing native iOS/Android staging
  validation remain deferred. No environment variables changed; S12 remains
  `in_progress`.
- Open Job presentation correction (2026-08-03): the instant-open custom Link
  now forwards the Base UI Button's injected class, data, accessibility, and
  ref props to its anchor. This restores the original styled button appearance
  and button semantics while retaining the instant cached-open controller.
  Changed-file ESLint, TypeScript, two focused component suites (15 tests), and
  `git diff --check` pass; no database, permission, route, or environment
  change was required.
- Remote-data localhost browser checkpoint (2026-08-03): exercised the owner,
  manager, and employee accounts through `http://localhost:4000` against the
  linked Supabase project. Sixteen browser-verifiable checks pass, including
  role navigation and denial, remote job create/reload/delete, roster
  create/edit/delete, employee start/note/submit, owner approve/archive,
  profile/logout, mobile-width layout, and clean browser-console collection.
  The run intentionally archived `Basic Job`; its temporary job and shift were
  cleaned up. Two product defects remain: the roster creation UI offers a
  manager whom the authoritative RPC rejects, and an open job detail retains
  stale status/actions after successful start or approve/archive until it is
  reopened. `STAGING-GO-LIVE-CHECKLIST.md` records the evidence, partial checks,
  remote-data ledger, and manual physical-device/infrastructure gates. S12
  remains `in_progress` and the release remains **NO-GO**.
- Staging checkpoint follow-up (2026-08-03): user-confirmed INVITE-01/02,
  PWA-01/02, and OFFLINE-01 pass; real-device push delivery remains failed.
  The roster mismatch is corrected by exposing only active employee-role
  members in owner/manager roster projections while preserving manager job
  assignment and zero-job shifts. Online job mutations now revalidate the open
  detail as well as the board, and global toast visibility is reduced to 2.5
  seconds. Focused Vitest (23 tests), changed-file ESLint, and `git diff
--check` pass. A public hosted-origin header audit confirms HTTP-to-HTTPS,
  HSTS, nosniff, frame denial, referrer policy, and permissions policy; a
  general HTML CSP and the authenticated cookie/origin/secret-store review
  remain outstanding. `STAGING-GO-LIVE-CHECKLIST.md` now defines the exact
  JOB-03, CACHE-01, storage, recovery, accessibility, and release evidence
  required. TODO-015 remains `in_progress`; S12 and release remain **NO-GO**
  pending push, fixed-flow regression, security/operations completion, and the
  remaining named manual gates.
- Roster fix browser regression (2026-08-03): localhost against the linked
  remote project confirmed both owner and manager Add shift selectors now show
  only the two active employee-role members. The manager created a zero-job
  shift for Axel, verified it on the following week, and deleted it; the toast
  was no longer present after its shortened duration. Temporary remote data was
  cleaned up and the browser was signed out. The job-detail mutation fix has
  focused component coverage but still needs a fresh mutable browser job to
  close its staging regression. S12 remains `in_progress` and **NO-GO**.
- Pushed staging regression (2026-08-03): the in-app browser exercised
  `https://pph-sage.vercel.app` against the remote project. Owner and manager
  roster selectors exposed only Axel and Bill; manager zero-job shift
  create/delete passed. A disposable manager-assigned job then proved both
  stale-detail corrections: Start immediately changed the still-open detail to
  `in_progress` and removed Start, while owner approval immediately changed the
  still-open detail to `archived` and removed approval. The temporary shift was
  deleted and the browser signed out. The lifecycle job remains archived
  because archived jobs intentionally have no permanent-delete UI. Both fixed
  browser regressions are now closed; S12 remains `in_progress` and **NO-GO**
  for the outstanding push, security/operations, and named manual gates.
- JOB-03 and profile-media follow-up (2026-08-03): pushed staging manager
  create/assign-to-Bill/reassign-to-manager/unassign/delete passed and the
  temporary job was removed. Together with the completed manager personal-work
  lifecycle and owner-only review, JOB-03 is accepted. Profile photo selection
  now invokes the existing server/offline-aware profile mutation immediately,
  shows an accessible upload state, refreshes the signed avatar after success,
  and no longer makes the profile form dirty or requires Save for the image.
  Focused profile component coverage, changed-file ESLint, TypeScript, and
  `git diff --check` pass. Fresh private-media signed URLs on page load remain
  intentional; expiry and cross-role/cross-organisation storage denial evidence
  is still required. OPS-01 is accepted from reliable Resend delivery without
  fabricating a production failure. S12 remains `in_progress` and **NO-GO**.
- Local-first dashboard restoration (2026-08-04): this checkpoint explicitly
  supersedes the 2026-07-30 “Unified dashboard/offline correction.” A prepared,
  lease-valid IndexedDB repository is again the normal mounted dashboard read
  and mutation substrate online and offline. Authenticated SSR remains the cold
  bootstrap and recovery fallback; preparation preserves usable SSR content,
  does not make the page inert, and a mutation initiated during that handoff
  waits for the writable repository before entering the same durable outbox.
  Realtime, reconnect, foreground, mutation, launch, and stale-navigation
  triggers coalesce through repository sync without `router.refresh()` replacing
  valid cached content.
- The public shell cache is version 10. A non-private readiness marker is written
  only after the snapshot, outbox, media working set, schema, lease, and shell
  are durable. Prepared `/dashboard/**` documents are shell-first while keeping
  their requested URL; unprepared documents remain network-first. Logout,
  identity/schema purge, and online authorization failure clear the marker and
  organisational repository. The opening IndexedDB frame is visually neutral
  and no longer shows the false “Connect once” state; that message appears only
  after preparation is genuinely unavailable.
- Focused verification passes changed-file ESLint, TypeScript, eight Vitest
  files / 37 tests, the production build, and `git diff --check`. Localhost
  against the configured remote project confirmed manager prepared reload into
  `ready/cache/idle` with no cold message or skeleton, warm local Jobs navigation,
  enabled controls, and logout purge/redirect. The updated role Playwright spec
  is discoverable in remote-data mode; execution against the isolated seeded
  stack remains blocked locally because Docker/Supabase is not running. No
  database migration or environment-variable change was required. S12 and
  TODO-015 remain `in_progress`, and the release remains **NO-GO** for the
  existing push, native staging, security/storage, and release gates.

## 13. Prototype and production readiness

Production deployment requires all S11 and S12 gates below to be checked, an
identified reviewer for each manual review group, and a final **GO** decision.
An unchecked, failed, or undocumented required item is a release blocker. A
waiver must identify its owner, reason, risk, expiry, and follow-up issue; scope
must not be silently reduced to obtain approval.

### Prototype acceptance

- [x] Critical owner, manager, and employee Playwright journeys pass.
- [x] Owner pages work at desktop width.
- [x] Employee dashboard, jobs, notes, and photo upload work at a mobile viewport.
- [ ] Owner, manager, and employee can navigate every permitted prepared route,
      continue representative work, foreground-sync exactly once, and recover
      Needs attention conflicts at desktop and mobile viewports.
- [x] RLS tests demonstrate role and organisation isolation.
- [x] No real email is sent by automated tests.
- [ ] The deployed application passes manifest, icon, service-worker, and installability checks.
- [x] Lint, type-check, unit tests, and production build pass.

### 13.1 Automated pre-production gate

Run from a clean checkout against the release candidate. Record the commit,
date, environment, command output or CI URL, and reviewer. Do not reset a
shared or production database.

| Gate                | Command or evidence                                                                    | Required result                                                            | Status/evidence                                                                          |
| ------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Working tree        | `git status --short` and `git diff --check`                                            | No unintended changes or whitespace errors                                 | [x] 2026-07-29 local                                                                     |
| Dependencies        | Lockfile install in CI                                                                 | Reproducible install with no unexplained lockfile drift                    | [x] frozen install                                                                       |
| Static quality      | `pnpm lint` and `pnpm typecheck`                                                       | Both exit successfully                                                     | [x] pass                                                                                 |
| Unit/components     | `pnpm test:unit`                                                                       | All tests pass with no unexpected skips                                    | [x] 180 pass                                                                             |
| Database            | `pnpm test:db`                                                                         | All pgTAP tests pass against the release schema                            | [x] 330 pass                                                                             |
| Schema lint         | `pnpm exec supabase db lint --local --schema public --level warning --fail-on warning` | No warnings or errors                                                      | [x] no errors                                                                            |
| Generated types     | `pnpm db:types`, followed by diff review                                               | Generated types match the committed release schema                         | [x] regenerated                                                                          |
| Production build    | `pnpm build`                                                                           | Clean Next.js production build                                             | [x] pass                                                                                 |
| Critical journeys   | `pnpm test:e2e`                                                                        | Desktop and mobile projects pass; only documented intentional skips remain | [x] 84 pass, 4 intentional skips                                                         |
| Offline/idempotency | S12 offline-v2 database and Playwright suites                                          | Every role navigates and replays exactly once; conflicts retain local work | [ ] 10 targeted checks pass; native reload/deep-link/conflict staging acceptance pending |
| Security            | Role, RLS, storage, cross-organisation, self-review, and owner-invariant suites        | All boundaries reject unauthorised access                                  | [x] pass                                                                                 |
| Release artifact    | Deployment build provenance                                                            | Artifact maps to the reviewed commit and migration set                     | [ ]                                                                                      |

If `pnpm db:types` changes the checked-in file, review and commit the change,
then rerun the affected checks. The final gate must run against that exact
commit.

### 13.2 Manual staging review

Each group needs a named reviewer and dated evidence such as a staging URL,
screenshot, trace, monitoring event, or runbook link.

#### Product journeys

- [ ] Owner invitation is delivered through Resend; acceptance, password setup,
      sign-in, resend, deactivation, and reactivation work.
- [ ] Owner creates, assigns, reassigns, reviews, reopens, comments on, and
      archives a job.
- [ ] Manager manages employees and operations, completes assigned work, reviews
      employee work, and cannot review manager or self-authored work.
- [ ] Employee sees only personal data, completes online and offline work,
      recovers from Needs attention, and cannot reach privileged routes.
- [ ] Roster creation/edit/archive, templates, schedules, generated jobs,
      dashboards, filters, loading, empty, and error states behave as specified.

#### Responsive, accessibility, and PWA

- [ ] Desktop owner/manager layouts and supported mobile employee layouts have
      no clipped actions, trapped scrolling, or unusable overlays.
- [ ] Core journeys work by keyboard with visible focus; dialogs/drawers restore
      focus and drag operations have non-drag alternatives.
- [ ] Labels, errors, status changes, headings, landmarks, contrast, zoom, and
      screen-reader announcements receive an accessibility review.
- [ ] Install, launch, update, offline shell, storage denial, quota pressure,
      stale work-pack, logout purge, and service-worker-disabled behaviour pass on
      supported staging devices. Physical-device PWA checks use a trusted HTTPS
      origin; plain-HTTP LAN addresses are not valid service-worker acceptance
      environments.
- [ ] Launch-time notification opt-in, Profile opt-out/re-enable, denied and
      unsupported states, job and roster deep links, and real-device delivery
      pass without private payload content.

#### Security and data

- [ ] Auth redirect URLs, allowed origins, HTTPS, CSP/security headers, cookie
      behaviour, and secrets/configuration are reviewed in staging.
- [ ] Private avatar/evidence access and signed URL expiry are checked using
      owner, manager, employee, inactive, and cross-organisation accounts.
- [ ] Migration order, scheduler permissions, occurrence retry, realtime
      invalidation, job locks, audit history, and notification idempotency are
      inspected with representative staging data.
- [ ] `.env.example` matches deployment configuration names and contains no
      usable secret; real values are present only in the deployment secret store.

#### Operations and release

- [ ] Error monitoring and server-side mutation logging receive a deliberate
      staging test and contain enough context to investigate without exposing
      sensitive content.
- [ ] Database backup, restore rehearsal, migration recovery, scheduler failure,
      email failure, and rollback procedures are documented and reviewed.
- [ ] Release owner confirms migration window, rollback trigger, on-call owner,
      post-deploy smoke test, and monitoring window.
- [ ] A final staging smoke test passes against the exact release artifact.

### 13.3 Release decision record

| Field                       | Value                                                          |
| --------------------------- | -------------------------------------------------------------- |
| Release commit              | Pending                                                        |
| Staging deployment          | Pending                                                        |
| Automated-gate evidence     | 2026-07-29 local gate passed                                   |
| Product reviewer/date       | Pending                                                        |
| Accessibility reviewer/date | Pending                                                        |
| Security/data reviewer/date | Pending                                                        |
| Operations reviewer/date    | Pending                                                        |
| Waivers and expiries        | None recorded                                                  |
| Decision                    | **NO-GO — manual staging review and release artifact pending** |

### Production readiness

- [ ] A real invitation is delivered through Resend in staging.
- [ ] Auth redirect URLs and allowed origins are verified.
- [ ] Private storage and signed URL expiry are verified.
- [ ] Database backup and recovery procedures are documented.
- [ ] Error monitoring and server-side mutation logging are configured.
- [ ] Schedule processing has failure visibility and a safe retry path.
- [ ] HTTPS, PWA security headers, service-worker update behaviour, and installability are verified in staging.
- [ ] Seven-day offline lease, all-role route restoration, logout purge,
      storage-pressure handling, and exactly-once replay are verified in
      staging on supported mobile browsers.
- [ ] A staging smoke test passes before deployment.

## 14. Deferred integration TODO ledger

Add a TODO as soon as an active step identifies work owned by a later step.
Resolve it only when the integrated behaviour and its regression test pass. If
resolution changes product behaviour, update this document first.

| ID       | Introduced      | Target | Work                                                                                              | Status        |
| -------- | --------------- | ------ | ------------------------------------------------------------------------------------------------- | ------------- |
| TODO-003 | Schema steps    | S12    | Regenerate and verify final combined Supabase types                                               | `complete`    |
| TODO-004 | All steps       | S12    | Reconcile dependencies and remove unused packages                                                 | `complete`    |
| TODO-007 | All steps       | S12    | Consolidate shared Supabase and Playwright fixtures without weakening isolation                   | `complete`    |
| TODO-008 | S04/S07         | S12    | Consolidate repeated mutation, date, dialog, and upload patterns where reuse is justified         | `complete`    |
| TODO-010 | All steps       | S12    | Reconcile `.env.example`, runtime validation, deployment variables, and `.env.local` instructions | `complete`    |
| TODO-011 | S01/S04/S06/S07 | S12    | Remove superseded reference duplicates and verify repository-native imports                       | `complete`    |
| TODO-014 | S03/S05/S10     | S11    | Add the original IndexedDB work pack, outbox, idempotent replay, and offline security boundaries  | `complete`    |
| TODO-015 | S11/real-device | S12    | Validate the complete all-role local-first dashboard and sync through native staging acceptance   | `in_progress` |
| TODO-016 | S12/realtime    | S12    | Run the expanded multi-user realtime browser journey and focused pgTAP checks on the local stack  | `in_progress` |

Completed integration items: TODO-001, TODO-002, TODO-005, TODO-006, TODO-009,
TODO-012, and TODO-013.

Checkpoint evidence for a completed step must record:

- commit and stories verified;
- commands passed and their result counts;
- database migrations and generated types;
- environment-variable changes;
- project skills and references used;
- reference files reused, cleaned, moved, or removed;
- TODOs added or resolved; and
- known limitations.

## 15. Deferred work

The following are explicitly outside V1:

- Public owner signup and company onboarding.
- Multi-company switching.
- Payroll and timesheets.
- Clock-in and clock-out.
- Leave requests and availability management.
- Background-only synchronisation.
- Job email notifications beyond submission-to-review, and all roster email
  notifications.
- Non-image job attachments.
- Employee-to-employee profile or job visibility.
- Advanced recurrence rules.
- Shift-start-triggered job generation.
- Comment editing or deletion.

## 16. Open work after V1

- Add email notifications for assignment, reassignment, owner feedback,
  reopened jobs, and roster changes, plus configurable push preferences and
  additional push event categories beyond the V1 affected-user contract.
- Add platform-admin and multi-organisation support.
- Add configurable company onboarding and owner self-service signup.
- Add richer reporting, exports, and employee workload analytics.
- Add leave, availability, time tracking, and payroll integrations as separate product areas.
- Add Background Sync as a progressive enhancement where browser support and
  product policy permit it.
