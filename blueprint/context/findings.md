# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P1] fixed - Migration 0000 has no snapshot, so the next `db:generate` recreates all seven tables

**File:** packages/shared/drizzle/meta/_journal.json:1
**Found:** 2026-09-22 by /audit (scope: current; lens: quality)
**Why it matters:** The journal records entry `0000_adopt_repo_one_tables`, but
`meta/` holds only `_journal.json`. There is no `0000_snapshot.json`.
drizzle-kit builds its previous state only from the non-underscore files in
`meta/` (`prepareOutFolder`, bin.cjs:8135) and falls back to the empty schema
when that list is empty (bin.cjs:19864). So the next generate diffs the whole
schema against nothing.

Confirmed by running it, not inferred: `drizzle-kit generate` against a
scratchpad copy of the folder produced `0001_*.sql` containing seven bare
`CREATE TABLE` statements with no `IF NOT EXISTS`, and no trace of any real
delta. Applied to the live database, which migration 0000's own comment says
already holds all seven tables, that fails on the first statement.

`AGENTS.md:378` documents `db:generate` as the way this project evolves its
schema, and build-plan item 2 opens by adding `booking_link`,
`availability_rule`, `contact` and `lead`. That is when this fires, and it
fires quietly: the generated file looks like an ordinary migration.

The hand-written 0000 is the right call for adopting the first repo's database;
the gap is only that the ledger was never given the snapshot that makes the
next diff correct.

**Suggested fix:** Commit the missing `packages/shared/drizzle/meta/0000_snapshot.json`
describing the schema as of 0000. Generate it once in a throwaway folder from the
current `schema.ts`, keep only the snapshot, rename it to `0000_snapshot.json`,
and leave the committed `0000_adopt_repo_one_tables.sql` untouched. Then confirm
a following `db:generate` reports no changes.
**Resolution:** Fixed 2026-09-22 exactly as suggested. Generated a snapshot of
the current schema into a scratchpad folder with an empty `meta/`, which
produced a first-in-chain snapshot (`prevId` all zeros, version 7, all seven
tables, `organization.plan` with its `'agency'` default, and the
`member_organization_user_unique` index). Copied it in as
`packages/shared/drizzle/meta/0000_snapshot.json`;
`0000_adopt_repo_one_tables.sql` untouched. Verified by running the real
`npm run db:generate --workspace=@scheduleads-app/shared`, which now reports
"No schema changes, nothing to migrate" where the same command previously
emitted seven bare `CREATE TABLE` statements. No stray migration file was
produced.

### F-02 [P2] fixed - The one shared refusal shape cannot be reused, so two of four refusal sites hand-roll it

**File:** backend/src/lib/active-organization.ts:41
**Found:** 2026-09-22 by /audit (scope: current; lens: quality)
**Why it matters:** The spec's Data / contracts section says refusals use "the
same JSON error shape so later items do not each invent one. Fix the shape in
step 4 and reuse it." The type is exported but `refuse` is not, so no other
module can reach it. Both remaining refusal sites therefore build the object by
hand: `backend/src/lib/plan-gate.ts:48` returns `code: "plan_required"`, which
is not a member of `Refusal["error"]["code"]`, and `backend/src/index.ts:73`
re-types a `no_active_organization` literal that already exists three lines of
code away.

The result is that the contract is documented and not enforced. Every route
from item 2 to item 26 adds refusals, and a reader has three examples to copy,
only one of them typed. `frontend/lib/api.ts:79` already branches on these code
strings with nothing shared to check them against, so a later rename on the
server goes undetected on the client.

**Suggested fix:** Export `refuse`, add `plan_required` to the
`Refusal["error"]["code"]` union, and call `refuse` from `plan-gate.ts` and
`index.ts` instead of the two literals. Exporting the union from
`packages/shared` would also let `frontend/lib/api.ts` branch on a checked type,
but that is a larger move and item 2's RPC seam may supply it instead.
**Resolution:** Fixed 2026-09-22. `refuse` is now exported from
`active-organization.ts`, and the code union is extracted as a named
`RefusalCode` type with `plan_required` added as a fourth member, each code
carrying a one-line comment saying when it applies. `plan-gate.ts` and the
`/me` missing-organization branch in `index.ts` both call the helper instead
of hand-rolling the object, so all four refusal sites now go through one
function and every code is inside the union. Proved at runtime rather than by
the build alone: unauthenticated `/me` returns 401 `unauthenticated`, and
flipping a live organization to an unrecognised plan returns 403
`plan_required` with the shared shape, then 200 again once restored. The
shared-package move stays out of scope, as the finding suggests.

### F-03 [P2] open - `GET /me` resolves the session three times and reads the same organization row twice

**File:** backend/src/lib/active-organization.ts:130
**Found:** 2026-09-22 by /audit (scope: current; lens: performance)
**Why it matters:** `requireOrganization` resolves the session at line 125, then
calls `getActiveOrganization`, which resolves it again at line 63, then calls
`auth.api.getActiveMember`, whose `orgSessionMiddleware` runs `sessionMiddleware`
and resolves it a third time (`better-auth/dist/plugins/organization/call.mjs:11`).
`session.cookieCache` is not configured in `auth.ts`, so each of the three is a
database read rather than a cookie check.

Then `plan-gate.ts:38` selects `plan` from the organization row and
`index.ts:62` selects `name` and `slug` from that same row in a second query.
The comment at `index.ts:58` notices the duplication and leaves it.

This is not a hypothesis about latency, which was not measured; it is the call
count, read off the code. It matters because `/me` is the dashboard's bootstrap
on every load and because this middleware stack is the one every route from item
2 onward mounts, so the duplication is inherited rather than confined here. Local
development runs Postgres over an SSH tunnel, where per-query cost is exactly
what is felt first.

**Suggested fix:** Have `requireOrganization` pass the session it already
resolved into `getActiveOrganization` rather than letting it re-derive one, and
resolve the active member from the session's `activeOrganizationId` with the
membership query already in that file instead of going through
`auth.api.getActiveMember`. Separately, let `requireModule` select `plan`,
`name` and `slug` in its one query and put the row on the context for the
handler to read.
**Resolution:**

### F-04 [P3] fixed - The spec ticks step 1 including `transpilePackages`, which was deliberately dropped

**File:** blueprint/context/current-feature.md:96
**Found:** 2026-09-22 by /audit (scope: current; lens: quality)
**Why it matters:** Step 1 instructs adding `transpilePackages: ["@scheduleads-app/shared"]`
to the frontend config, and Files / areas lists `frontend/next.config.ts` for it.
The box is ticked and `frontend/next.config.ts` is untouched scaffold with no
`transpilePackages`; the file does not appear in the feature's diff at all.

The decision itself is sound and is recorded properly on the published build log
as `dropped`, with its reason, at `project-log.html:1455`. Nothing is hidden from
the person who reads the page. The gap is only in the spec, whose own preamble
records two other deviations "rather than quietly corrected" and is silent on
this third one. The spec is what `/complete` archives and what the review hash
pins, so it is the copy that outlives the page's current state.

**Suggested fix:** Add one line to the spec's Status preamble naming the dropped
piece and pointing at the build log entry, in the same form as the two
deviations already listed there.
**Resolution:** Fixed 2026-09-22. A third bullet added to the spec's Status
preamble naming `transpilePackages` as deliberately dropped, why it was
dropped (once `packages/shared` compiled to JavaScript the setting did
nothing), that `frontend/next.config.ts` is therefore untouched scaffold, and
that the build log carried it at the time while the preamble did not. Note
this changes the spec bytes, so the review receipt's spec hash no longer
matches and a fresh review is required regardless.
