# Pure Peninsula Honey

## Overview

Pure Peninsula Honey is a responsive workforce-operations app for one
organisation. It brings together team access, job execution, rostering,
evidence, review, and reusable schedules. Australia/Melbourne is the product
timezone.

## Roles and access

| Role | Features |
| --- | --- |
| Owner | Full organisation operations, team and role management, jobs, roster, templates, schedules, and review. Owners may be assigned their own work but cannot assign work to another owner. |
| Manager | Team operations: employee lifecycle, jobs, roster, templates, schedules, and employee-work review. Managers can complete assigned work but cannot manage owners or other managers. |
| Employee | Personal roster and assigned jobs. Can add notes and photos, comment, submit work, and view feedback; cannot view other employees or manage operations. |

All operational records are organisation-scoped. Application authorisation and
Row Level Security enforce role and organisation boundaries. There is always at
least one active owner and at most two invited-or-active owners.

## Team management

- Owners can invite employees, managers, and one additional owner; managers can
  invite employees.
- Invitees confirm their invitation and set a password.
- Authorised administrators can resend, deactivate, reactivate, or remove a
  pending invitation without deleting work history.
- Authorised users can manage employee profiles, access, roles, and upcoming
  work and shifts from the employee directory.

## Jobs and review

- Owners and managers can create work directly or from reusable templates,
  assign or reassign it to eligible workers, and manage it on the organisation
  job board. Employees see only their own work.
- Jobs move through `unassigned`, `assigned`, `in_progress`, `in_review`, and
  `archived`. Reopened work returns to an actionable state while retaining its
  history.
- Workers can start assigned work, add progress notes and required photos, and
  submit complete work for review.
- Employee work is reviewed by an active manager or owner; manager work is
  reviewed by an active owner. Self-review is not permitted.
- Reviewers can approve, comment, reopen, or reassign. The first valid review
  is retained alongside the complete evidence and activity history.

## Roster, templates, and schedules

- Owners and managers create and manage shifts in day and week roster views,
  attaching eligible jobs that have not started.
- Employees see their current, next, and upcoming shifts; authorised users can
  edit or archive shifts from employee profiles.
- Templates support repeatable job definitions. Schedules create daily or
  weekly recurring work idempotently, so retries do not duplicate jobs.

## Offline and notifications

- After sign-in, the app prepares the permitted role-scoped dashboard for
  offline use, including prepared-route navigation and queued permitted
  changes.
- Queued changes show local, syncing, and attention-needed states. Replay is
  idempotent and preserves local work when a conflict needs resolution.
- Signing out or losing access clears locally stored work data.
- The dashboard is installable as a PWA where supported. The Profile page
  manages browser push-notification settings when available and configured.

## Private media and data

- Avatars and job evidence are private, organisation-scoped media.
- Avatar links are stable authenticated app URLs and can be prepared for
  offline use. Job evidence is authorised per request and may use short-lived
  signed URLs.
- Application records do not keep public storage URLs. Operational records
  retain membership, review, job, roster, schedule, audit, notification, and
  offline-replay history according to their lifecycle.

## Main routes

| Route | Feature |
| --- | --- |
| `/login`, `/auth/confirm`, `/set-password`, `/reset-password` | Sign-in, activation, and recovery. |
| `/dashboard` | Role-scoped operations overview. |
| `/dashboard/jobs` | Job board, execution, evidence, and review. |
| `/dashboard/roster` | Team and personal roster. |
| `/dashboard/employees` | Authorised employee directory and profiles. |
| `/dashboard/templates` | Job templates and recurring schedules. |
| `/dashboard/profile` | Personal profile, offline storage, and notifications. |
| `/offline` | Recovery shell when a prepared dashboard is unavailable. |

## Out of scope

The product does not include public organisation signup, multi-organisation
switching, payroll, timesheets, clock-in/out, leave management, non-image job
attachments, or employee-to-employee visibility.
