# Independent Review

**Status:** passed
**Target commit:** ead8273e80e1facf662c342676ccea907b6ac666
**Base commit:** 931ecadd49bebb38bd9f02bf27a2deeab0236755
**Base ref:** main
**Spec hash:** 35eaa490686c4b2f66b031bf75dd48586d922eae884c9d49825feededa5cd1ad
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-09-25T23:40:42Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-25T23:48:30Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `931ecad..ead8273` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

This is a per-step review (`AGENTS.md`, "A review after every step"): feature 2
is built and approved one step at a time, so only step 2.1 is checked in the
spec and its status is not `verified`. The product code in this range is the
test-runner setup (`cb8e09c`) and step 2.1 (`ead8273`); the two earlier commits
are planning documents. Judge step 2.1 against its own `Done when`, not against
steps 2.2 to 2.6.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain`: pass (target, base and spec hash match; only `review.md` differed)
- `npm run test --workspace=@scheduleads-app/shared`: pass (2 files, 21 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npx prettier --check packages/shared/src backend/src`: pass
- `drizzle-kit generate` against a scratch copy of `packages/shared/drizzle`: pass ("No schema changes"), so the 0001 snapshot matches the schema
- Read-only queries and rolled-back insert probes against `scheduleads_dev`: pass (0 probe rows left)

## Evidence

- Migration 0001 contains the partial unique index `WHERE resourceId IS NULL`, the composite unique index, the composite foreign key, the row-kind check and the hand-written backfill; the ledger `drizzle.__scheduleads_app_migrations` holds 2 entries.
- `agency-dev` and `test-salon-dev` each have exactly one resource, kind `person`, named after the business.
- Probes refused by the database, each inside a rolled-back transaction: second business row (`availability_rule_business_unique`), second rule for one resource (`availability_rule_resource_unique`), rule naming another business's resource (`availability_rule_resource_fk`), time zone on a person's row, business row with no week, and holiday country on a person's row (all `availability_rule_row_kind_check`).
- better-auth 1.7.5 `organization/routes/crud-org.mjs:137` calls `afterCreateOrganization` after the organization and member are written, outside any transaction (`createOrganization` in `organization/adapter.mjs:141` uses no `runWithTransaction`), so the hook's separate insert sees the committed organization, as the comment in `auth-server.ts` says.
- No new routes, no client-supplied organization id, no secret handling in the delta; indexes cover every organization-scoped lookup the three tables will serve.

## Findings

- F-17 [P2] open - a database rebuilt from migrations and the seed has businesses with no first person (`packages/shared/scripts/seed-dev.ts:87`)
- F-18 [P3] open - several refinements in the business-row schema have no test (`availability-rule-validation-schema.ts:28`)

## Remaining risk

- "Creating a business through the API as the platform admin gives it its person" was not re-run live: it needs the API running and a platform-admin sign-in by emailed code, and would leave rows behind. The hook was verified by reading the code and the library's call site only.
- The database stores `weeklyHours` and `dateHours` as unchecked `jsonb` (a probe of malformed JSON on a person's row was accepted), so their shape depends on every writer using the Zod schemas; step 2.3's seeds and CLI are the first writers.
- Check was not required and was not run.
