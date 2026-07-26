# Employee Operations Dashboard

The S01 foundation is a Next.js 16 application backed by the repository's
existing local Supabase Docker stack. The local database includes
organisation-scoped memberships, employee profiles, Row Level Security, and
deterministic test users.

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

| Application variable | Local Supabase output |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` |
| `SUPABASE_SECRET_KEY` | `SECRET_KEY` |

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

The invited employee is intentionally not login-capable. The S01 login
presentation does not submit credentials yet; functional credential login is
owned by S02.

Start the application:

```bash
pnpm dev
```

The application is available at <http://127.0.0.1:3000>. Local email is
captured by the Supabase mail service rather than sent externally.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:e2e
pnpm build
```

Playwright resolves credentials from the running local stack and starts an
isolated managed Next.js server on port 3100. This allows the browser suite to
run while the normal development server remains active on port 3000.

Database maintenance:

```bash
pnpm exec supabase db lint --local --schema public --level warning --fail-on warning
pnpm db:types
```
