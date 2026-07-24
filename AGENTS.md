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
- Treat `components/ref-files/**` as read-only reference code and never import it directly into production.
- A feature is complete only when its implementation, permissions, tests, and documented integration TODOs are complete.
