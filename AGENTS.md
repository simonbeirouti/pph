<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Product and feature delivery

- Read `PRD.md` before planning or implementing product behaviour. It is the product and architecture source of truth.
- Read `FEATURES.md` before starting feature work. Work only within the active feature's owned scope.
- Update the active feature status and integration TODO ledger in `FEATURES.md` as part of the branch.
- Record cross-feature or shared-file overlap immediately; do not silently redesign another feature's contract.
- Add new Supabase migrations instead of editing migrations owned by another merged feature.
- Inspect the relevant `components/ref-files/**` implementation before rebuilding equivalent styling or functionality; preserve and reuse suitable interactions, visual treatment, logic, and assets.
- You may clean, refactor, split, move, or remove reference code as it is absorbed into production, but finished production modules must use repository-native imports, types, permissions, and tests rather than unresolved `@eva/*` or reference-only dependencies.
- Implement Supabase session refresh through one root-level `proxy.ts` that delegates to project-native logic; clean and port `components/ref-files/supabase/proxy.ts` and `root-proxy.ts` into that production structure.
- Treat `.env.example` as the canonical environment-variable contract and keep it limited to names and safe empty/example placeholders.
- Never add real secrets to `.env.example` or assume `.env.local` has been updated.
- Whenever you add, rename, or remove an entry in `.env.example`, explicitly tell the user in the final response which variables changed and that the corresponding real values must be added to `.env.local`.
- A feature is complete only when its implementation, permissions, tests, and documented integration TODOs are complete.
