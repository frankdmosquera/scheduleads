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
