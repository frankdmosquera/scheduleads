# Fix: flaky skills carry-over test

**Type:** Fix

**Size:** light - one test's setup scoped to its own business, and one note added to the plan;
proved by the test and the whole backend suite run repeatedly.

**Status:** verified

**Branch:** fix/flaky-skills-carry-over-test

## The problem

F-516 (P3, raised by the npm warnings fix's review, 2026-10-26): `skills-carry-over.test.ts`
replays migration 0033's carry-over statements over every business in `scheduleads_dev`, inside
a transaction it rolls back. Vitest runs the other backend files in parallel against the same
database, so when another file deletes its own business between the statements' read and their
foreign key check, the insert fails (`person_skill_organizationId_organization_id_fk`) and the
suite goes red, then passes on a rerun. Seen twice on 2026-10-26. The same unscoped insert also
holds locks on every other business's rows until the rollback. Frank's yes, 2026-10-26.

- `backend/lib/scheduling/skills-carry-over.test.ts`

Riding along (Frank, 2026-10-25): the messaging note in `blueprint/build-plan.md` "Named, not
planned" gains what was said that day: workers' texts about their day go by WhatsApp, SMS only as
a paid option; email also costs at volume, so every channel is a pick; turning on a paid one asks
a "make sure" confirmation showing its cost. The overview's plan fingerprint is recomputed with
it.

- `blueprint/build-plan.md`, `blueprint/context/project-overview.md` (fingerprint only)

## The fix

The test keeps replaying the real migration text, but before running each statement it adds
`"<outer table>"."organizationId" = '<the test's business>' AND` after the statement's top-level
`WHERE`, the outer table read from its top-level `FROM`. Every join inside the statements already
matches on `organizationId`, so a business's result does not depend on other businesses: scoping
the outer table changes nothing the test proves. A statement without a top-level `FROM` or
`WHERE` fails the test loudly, so a later change to the migration cannot slip past unscoped.

It must not break: what the test proves (the carry-over offers exactly who the old rule offered,
and everyone on can do it), and every other backend test.

## Build steps

- [x] 1. **Scope the carry-over test, add the messaging note.** **Done when:** the test passes
  alone; `npm run test --workspace=backend` passes 1098 of 1098 five runs in a row; the test
  still fails if the carry-over's first statement is removed from what it runs (checked once by
  hand, then put back); the plan carries the note and the overview fingerprint matches the plans.

## Verify

Run `npm run test --workspace=backend` a few times: it stays green.

## Implementation walkthrough

One step, as the spec planned (light), and one review round that passed and closed F-516.

### backend/lib/scheduling/skills-carry-over.test.ts

A small helper, `onlyThisBusiness`, runs over each carry-over statement the test reads from
migration 0033: it takes the statement's top-level `FROM` table (a line starting `FROM "`) and
adds `"<table>"."organizationId" = '<the test's business>' AND` after its top-level `WHERE` (a line
starting `WHERE `; the subqueries' `WHERE` lines are indented, so they are left alone). A statement
with neither throws, so the test fails rather than run unscoped. The test's business id moved
above the statements so the helper can use it. The three statements are scoped on
`booking_link_resource`, `booking_link` and `person_skill`.

Besides the race, the unscoped replay also held locks on other businesses' rows until its
rollback; the reviewer saw an organization row stay locked unscoped and stay free scoped.

The test still proves the carry-over: dropping any of the three statements, or changing `'person'`
to `'place'`, fails its assertion (checked by the builder for the first statement and by the
reviewer for all five changes, each restored byte for byte).

### blueprint/build-plan.md and the overview fingerprint

The messaging bullet in "Named, not planned" gains Frank's Oct 25 words: workers' texts about
their day (12g) by WhatsApp, SMS only as a paid option, every channel a pick, and a "make sure"
confirmation with its cost before a paid one goes on. The overview's `blueprint:source-hash` was
recomputed over the CRLF form of both plans (`be1b829e...` to `32fbadc4...`); nothing else in the
overview changed.

### limits, named

The guard only knows a top-level `WHERE` and `FROM` at the start of a line; a top-level `OR` or a
subquery at the start of a line would slip past it. Migration 0033 is released and does not
change, so this was left.

## Findings

### flaky-skills-carry-over-test/F-516 [P3] closed - The skills carry-over test runs migration 0033's insert over every business in the database, so a sibling test file deleting its own business mid-run fails it

**File:** backend/lib/scheduling/skills-carry-over.test.ts:97
**Found:** 2026-10-26 by /audit independent (review of fix/npm-audit-warnings at 2a42e92; lens: tests)
**Why it matters:** The test replays the carry-over statements unscoped (`INSERT INTO "person_skill" ... SELECT ... FROM "booking_link_resource"` with no organization filter) while Vitest runs the other backend files in parallel against the same `scheduleads_dev`. When another file's business is deleted between the SELECT and the foreign key check, the insert fails with `person_skill_organizationId_organization_id_fk` (23503). Seen once in this review's first `npm run test --workspace=backend` (1 failed, 1097 passed; the missing organization was not the test's own); the file passed alone and the whole suite passed 1098/1098 on the rerun. Not caused by this fix's lockfile change: the test and the migration predate the base commit (807203b), and nothing in the delta touches scheduling or Vitest's file parallelism. A red suite that passes on rerun teaches people to rerun instead of read.
**Suggested fix:** Scope the replayed statements to the test's own business (append an `organizationId` filter in the test before running them), or run this file on its own (for example a `describe.sequential` file isolated through Vitest's `poolMatchGlobs`/`fileParallelism` for it), so other files' rows never enter its transaction.
**Resolution:** fixed on fix/flaky-skills-carry-over-test: the test scopes each replayed statement to its own business (its top-level FROM table's organizationId) and fails loudly if a statement cannot be scoped; the backend suite passed 1098/1098 five runs in a row, and dropping the first statement still fails the test.
Closed 2026-10-26 by /audit independent (review of fix/flaky-skills-carry-over-test at c0be401): the three scoped statements read back as `WHERE "booking_link_resource"|"booking_link"|"person_skill"."organizationId" = '<own>' AND ...`, each at its top-level WHERE (the subqueries' FROM and WHERE are indented, so the line-start patterns skip them; the migration's CRLF does not change that). A scratch replay against `scheduleads_dev` with a second throwaway business holding an unskilled tick: the unscoped statements inserted a person_skill row for the sibling and left its organization row locked (a `FOR UPDATE` from a second connection timed out, 55P03), the scoped ones inserted only the own business's row and left the sibling free; both throwaway businesses were deleted afterwards. Mutations of the migration in place, restored byte for byte (SHA-256 2f89d08c... before and after, git clean): dropping statement 1, 2 or 3, or turning statement 1's `'person'` into `'place'`, each fails the test's assertion; indenting statement 1's WHERE fails the file with `cannot scope`. The test passes alone and the backend suite passed 1098/1098 five runs in a row in this review.

## Independent review

**Status:** passed
**Target commit:** c0be4017c09127b8f55c081b3e1739e65ba0a431
**Base commit:** 08690e49b566b4f10c4aa8cb00ecc20400bbffe6
**Base ref:** main
**Spec hash:** b5ee1eacaa6013ee96e23cf0e462ff8204e6761952d2a44538642c5c0963662f
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-26T05:18:16Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-26T05:31:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (32 files, 214 tests)
- `npm run test --workspace=backend`: pass, five runs in a row, 1098/1098 each (95 files)
- `npx vitest run lib/scheduling/skills-carry-over.test.ts` (in `backend`): pass alone
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (18 files, 98 tests)
- `npm run build --workspace=backend`: pass
- `npm run format:check`: pass

### Evidence

- Freshness: HEAD is c0be401 (target), `git merge-base HEAD main` is 08690e4 (base), SHA-256 of current-feature.md is b5ee1eac... (spec hash), and `git status --porcelain --untracked-files=all` shows only review.md before this receipt.
- Delta reviewed in full: `backend/lib/scheduling/skills-carry-over.test.ts`, `blueprint/build-plan.md`, `blueprint/context/project-overview.md`, `blueprint/context/current-feature.md`, `blueprint/context/findings.md`.
- Scoping: the three replayed statements of migration 0033 each get their filter at the top-level WHERE on their top-level FROM table (`booking_link_resource`, `booking_link`, `person_skill`); the subqueries are indented, so the line-start patterns never pick them; the CRLF migration reads the same. Precedence is safe (no top-level OR in any statement).
- Isolation, shown on `scheduleads_dev` with two throwaway businesses (own and sibling, each with an unskilled person tick), in rolled-back transactions: unscoped, a person_skill row was inserted for the sibling and its organization row stayed locked (a second connection's `FOR UPDATE` timed out, 55P03); scoped, only the own business got a row and the sibling stayed free. Both businesses deleted afterwards (0 left). This is the F-516 failure path and it is closed.
- Mutations of `packages/shared/migrations/0033_person_skill.sql` in place, each restored byte for byte from a scratch copy (SHA-256 2f89d08c4b89... before and after, git status clean): dropping statement 1, 2 or 3, or changing statement 1's `'person'` to `'place'`, each fails the test's `toEqual(oldRule)`; indenting statement 1's WHERE fails the file with `cannot scope`.
- Fingerprint: per `/overview`'s contract (project-plan bytes, a zero byte, build-plan with `- [x]` normalized) over the checked-out CRLF form gives 32fbadc4...76ca, matching project-overview.md:3; the same computation on the base plans gives the old be1b829e..., and project-plan.md is unchanged in the delta.
- Build-plan note: added inside the messaging bullet of "Named, not planned", says what the spec says, and 12g is indeed the texts item that holds worker texts (8c).
- Security: the only interpolated value in the raw SQL is the test's own `randomUUID()`; the test still refuses any non-local or non-`_dev` database. Performance: the scoped statements touch one business instead of the whole database.

### Findings

- F-516 (P3) moved from fixed to closed, evidence in its Resolution.
- No new findings.

### Remaining risk

- The "fails loudly" guard covers a statement with no line-start FROM or WHERE, not one whose top-level WHERE holds an OR or whose subquery starts at column 0. Migration 0033 is released and does not change, so this is not raised as a finding.
- F-517 (P3, from the previous fix) stays open and is outside this delta.
