# Pure Peninsula Honey

Pure Peninsula Honey is a Next.js and Supabase workforce-operations app for
rosters, jobs, evidence, review, schedules, offline-ready work, and browser
notifications. See [PRD.md](PRD.md) for the product features and workflows.

## Get running locally

### Prerequisites

- Docker Desktop running
- Node.js 20+ and pnpm (use the version expected by the repository's lockfile)

Install dependencies, start the local Supabase stack, then create local app
configuration:

```bash
pnpm install
./supa start
./supa status -o env
```

Copy `.env.example` to `.env.local`, then set the three local Supabase values
from `./supa status -o env`:

| `.env.local` variable                  | `supa status -o env` value |
| -------------------------------------- | -------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `API_URL`                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY`          |
| `SUPABASE_SECRET_KEY`                  | `SECRET_KEY`               |

`NEXT_PUBLIC_SUPABASE_URL` must point to the local API (`http://127.0.0.1:54321`),
not a hosted project. Do not commit `.env.local` or values printed by the
status command.

Apply the checked-in migrations and deterministic test data, then start the
app:

```bash
pnpm db:reset
pnpm dev
```

Open <http://127.0.0.1:4000>. Local emails are captured in Mailpit at
<http://127.0.0.1:54324>, and Supabase Studio is available at
<http://127.0.0.1:54323>.

The seeded local owner is `hello@simonbeirouti.com` with password
`Password123!`. Other roles and invitation scenarios are created by the test
suites; use the app or the relevant test fixture when you need them locally.

## Local Supabase workflow

Use the repository wrapper, `./supa`, for interactive Supabase CLI work. It
runs the project-local CLI from the repository root and loads optional local
CLI-only settings from `.env.supabase`. This keeps app configuration in
`.env.local` and avoids depending on a globally installed CLI.

Before using an unfamiliar command, discover the installed CLI syntax:

```bash
./supa --help
./supa db --help
./supa migration --help
```

### Everyday commands

| Need                                                     | Command                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Start or inspect the local stack                         | `./supa start` / `./supa status`                                           |
| Stop it                                                  | `./supa stop`                                                              |
| Reset local DB, apply migrations, and seed fixtures      | `pnpm db:reset`                                                            |
| Run database tests                                       | `pnpm test:db`                                                             |
| Create a migration                                       | `./supa migration new <descriptive_name>`                                  |
| Regenerate committed database types after schema changes | `pnpm db:types`                                                            |
| Check the local public schema                            | `./supa db lint --local --schema public --level warning --fail-on warning` |

Use `pnpm db:reset` only for your local database: it drops and recreates local
data. Never use it for a shared, staging, or production database. For a schema
change, create a new migration first, edit it, apply it locally, regenerate
types, and run the relevant database tests. Do not edit an existing migration
that belongs to an already delivered feature.

The local stack is configured by `supabase/config.toml`; migrations, seeds,
database tests, Auth email templates, and the web-push Edge Function live under
`supabase/`. Do not run `supabase init`—this repository already owns that
configuration.

### When to use `supa`

Use `./supa` when you need a CLI command that is not already wrapped by a pnpm
script: checking status, working with migrations, inspecting CLI help, running
local schema linting, or managing the local stack. Prefer the pnpm scripts for
the repeatable project workflows below, so CI and local development use the
same command.

## Environment variables

`.env.example` is the complete safe-to-commit variable contract. Add the
matching real values only to `.env.local` (and the hosted platform's secret
store):

| Group                      | Variables                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Supabase                   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |
| Job email                  | `RESEND_API_KEY`, `RESEND_APP_FROM_EMAIL`                                                 |
| Browser/Edge Function push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`  |

Never expose `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, or `VAPID_PRIVATE_KEY`
to the browser. Any variable beginning with `NEXT_PUBLIC_` is browser-visible.
Restart `pnpm dev` after changing environment variables.

## Email and hosted Supabase

Local Auth email uses the checked-in templates and Mailpit. Restart the local
stack after changing a template:

```bash
./supa stop
./supa start
```

For a hosted Supabase project, configure its Auth site URL and allow-list
`<application-origin>/auth/confirm`, then configure Resend SMTP in Supabase
Auth for invitations and account email. The application sends job-review email
through the Resend API using `RESEND_API_KEY` and `RESEND_APP_FROM_EMAIL`.

## Verification

Run the smallest relevant check while developing:

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:e2e
pnpm build
```

`pnpm check` runs lint, type-checking, unit tests, database tests, and a
production build. Playwright uses the local Supabase fixtures and targets
<http://127.0.0.1:4000>.
