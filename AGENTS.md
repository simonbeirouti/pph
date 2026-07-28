<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Product and feature delivery

- Read `PRD.md` before planning or implementing product behaviour. It is the
  single product, architecture, implementation, and production-readiness source
  of truth.
- Read the delivery register in `PRD.md` before starting implementation. Work
  only within the single active step and complete it before beginning the next
  step.
- Use the checked-in project skills in `.agents/skills` whenever their descriptions match the active work, read each applicable `SKILL.md` completely, and follow its reference-routing instructions.
- Use `playwright-best-practices` for every Playwright configuration, test, fixture, debugging, mobile, upload, drag/drop, time, PWA, or CI task.
- Use `supabase` for every Supabase task and `supabase-postgres-best-practices` for schema, query, index, RLS, locking, or database-performance work.
- Use `vercel-react-best-practices` for React/Next.js components, pages, rendering, data fetching, server actions, bundle, and performance work.
- Update the active step status, verification results, and deferred integration
  TODOs in `PRD.md` as part of the implementation.
- Record cross-step or shared-file overlap immediately; do not silently redesign a completed step's contract.
- Add new Supabase migrations instead of editing migrations owned by another merged feature.
- Do not reset the local database during feature development or test passes. Apply migrations in place and let collision-safe test data accumulate; reserve canonical database resets for the production checkpoint.
- For small changes, run verification only for the changed files; do not run the full test suite. This keeps context usage low and response times fast.
- Inspect the relevant remaining `components/ref-files/**` implementation before rebuilding equivalent styling or functionality; preserve and reuse suitable interactions, visual treatment, logic, and assets.
- You may clean, refactor, split, move, or remove reference code as it is absorbed into production, but finished production modules must use repository-native imports, types, permissions, and tests rather than unresolved `@eva/*` or reference-only dependencies. Record consumed and removed references in `PRD.md`.
- Maintain Supabase session refresh through the S01 production contract: one root-level `proxy.ts` delegates to `lib/supabase/proxy.ts`. Extend those project-native modules directly; the consumed Supabase client and Proxy prototypes have been removed from `components/ref-files`.
- Treat `.env.example` as the canonical environment-variable contract and keep it limited to names and safe empty/example placeholders.
- Never add real secrets to `.env.example` or assume `.env.local` has been updated.
- Whenever you add, rename, or remove an entry in `.env.example`, explicitly tell the user in the final response which variables changed and that the corresponding real values must be added to `.env.local`.
- A step is complete only when its implementation, permissions, tests, documentation, and checkpoint verification are complete.
