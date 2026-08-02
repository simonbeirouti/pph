# Pure Peninsula Honey

Pure Peninsula Honey is a Next.js 16 workforce operations dashboard backed by
Supabase. It includes credential login, owner-managed employee invitations,
activation and access controls, private avatars, organisation-scoped Row Level
Security, and deterministic local test users.

## Local setup

Prerequisites:

- Docker Desktop
- pnpm
- Node.js

Install the pinned dependencies and confirm the existing Supabase stack:

```bash
pnpm install
pnpm exec supabase status
```

Do not run `supabase init`. This repository already owns its Supabase project
configuration and migrations.

Create `.env.local` from `.env.example`, then copy the corresponding local
values reported by:

```bash
pnpm exec supabase status -o env
```

Use these mappings:

| Application variable                   | Local Supabase output |
| -------------------------------------- | --------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `API_URL`             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY`     |
| `SUPABASE_SECRET_KEY`                  | `SECRET_KEY`          |

Never commit `.env.local` or any value printed by the status command. Restart
the Next.js development server after changing environment variables.

Reset, migrate, and seed the local database:

```bash
pnpm db:reset
```

The deterministic local fixtures use `Password123!` and these fictional
accounts:

- `owner@example.test`
- `employee@example.test`
- `inactive@example.test`
- `other-owner@example.test`

The invited employee is intentionally not login-capable until its invitation
has been accepted and a password has been set.

Start the application:

```bash
pnpm dev
```

The application is available at <http://127.0.0.1:4000>. Local email is
captured by the Supabase mail service rather than sent externally.

## Progressive Web App

The authenticated dashboard can be installed from supported browsers. Hosted
staging and production deployments must use HTTPS; localhost remains available
for local service-worker testing.

The V1 service worker manages installation and activation only. Jobs, rosters,
evidence, and mutations are not cached for offline use, and the application
does not request push-notification permission.

## Auth email setup

For a hosted Supabase project:

1. Set the Auth site URL to the deployed application origin.
2. Add `<application-origin>/auth/confirm` to the Auth redirect allow-list.
   The hosted project uses `https://pph-sage.vercel.app/auth/confirm`; local
   development uses `http://localhost:4000/auth/confirm`.
3. Configure Resend SMTP in Supabase Auth using the project’s Resend SMTP
   credentials. Supabase Auth sends invitation and account emails; the
   application does not send those messages directly.

Job-submission review emails are sent directly by the application through the
Resend API. Add `RESEND_API_KEY` and `RESEND_APP_FROM_EMAIL` to `.env.local`.
The from address must use a domain verified in Resend. A missing or rejected
Resend configuration never rolls back a job submission: the owner sees the
failed delivery in the review sheet and can retry it. 4. Copy `supabase/templates/invite.html` into the corresponding Supabase Auth
invite template. Keep the `token_hash` and `type=invite` callback parameters
intact.

Local Supabase loads those checked-in templates from `supabase/config.toml`.
Template changes require a local stack restart:

```bash
pnpm exec supabase stop
pnpm exec supabase start
```

Captured local invitations are available in Mailpit at
<http://127.0.0.1:54324>. Automated tests poll the Mailpit API and never send
real email.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:e2e
pnpm build
```

Playwright resolves credentials from the running local stack and tests
<http://127.0.0.1:4000>. It reuses a development server already running there,
or starts the repository's managed server when the port is free.

Database maintenance:

```bash
pnpm exec supabase db lint --local --schema public --level warning --fail-on warning
pnpm db:types
```
