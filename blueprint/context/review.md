# Independent Review

**Status:** passed
**Target commit:** 7b043167f89a08ba32efb1be094704a6015e2c3b
**Base commit:** 931ecadd49bebb38bd9f02bf27a2deeab0236755
**Base ref:** main
**Spec hash:** 6f17738663a61f2197ea457fe20e6d6ee6ae0db0c1561cad587351309102c3fb
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-09-26T04:49:33Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-26T04:54:33Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `931ecad..7b04316` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

This is a per-step review (`AGENTS.md`, "A review after every step"): feature 2
is built and approved one step at a time, so steps 2.1 to 2.3 are checked in
the spec and its status is not `verified`. Steps 2.1 and 2.2 were reviewed and
passed earlier; their review fixes (F-19, F-20, F-21 and F-18) are marked
`fixed` and are yours to close or reopen if you re-examine their files. The new
work is step 2.3, commit `7b04316` (`b4121a4..7b04316`): the dev seed
`packages/shared/scripts/seed-dev.ts`, spec and build-plan edits (a planned
command for real clients was dropped), and the build log page layout. Judge
2.3 against its own Done when as approved on 2026-09-25.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (target, base and spec hash match; only `review.md` differed)
- `npm run test --workspace=@scheduleads-app/shared`: pass (25 tests)
- `npm run test --workspace=backend`: pass (11 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npx prettier --check packages/shared/scripts backend/src`: pass
- `npx tsc --ignoreConfig --noEmit --strict --module nodenext ... scripts/seed-dev.ts` (from `packages/shared`): pass (the seed is outside every build)
- `npm run db:seed --workspace=@scheduleads-app/shared` (second run): pass, "(already there)" for both accounts
- Read-only `psql` probes of `scheduleads_dev` before and after the seed: pass
- Read-only `resolveAvailability` calls from `backend/dist` against the seeded rows: pass

## Evidence

- Freshness: HEAD `7b04316`, merge base `931ecad`, spec hash `6f177386...102c3fb`, all as recorded.
- 2.3 Done when: Summit Painting has 8 persons (first person, Marco, six painters), 1 business row, 1 person row, 3 links; Riverbend Clinic has 7 persons, 5 places, 1 business row, 4 person rows (Sofia, Luis, Priya, Daniel), 10 links; exactly one resource named after each business; both dev accounts own only their new business.
- Rebuild: both users, both businesses and all 20 resources share one creation timestamp from the seed transaction, and `agency-dev` / `test-salon-dev` are gone.
- Idempotency: md5 over every row of `user`, `organization`, `member`, `resource`, `availability_rule`, `booking_link` identical before and after a second `db:seed`.
- Validation: every hours row goes through `businessAvailabilityRuleValidationSchema` or `personAvailabilityRuleValidationSchema` (`.strict()`) before insert, inside one transaction.
- Spot check: Priya resolves `source: resource`, sat/sun; Daniel `source: organization`, the clinic's week plus 2026-10-18; a clinic person asked of the painting business resolves `null`.
- The ten clinic treatments and lengths match `face-and-body/data/servicesData.ts`.
- F-17 to F-21 re-examined in their files and closed (see findings).
- Security: the seed's local-and-`_dev` guard is unchanged; no secret or credential in the diff; no new route or trust boundary in 2.3.
- Performance: the seed issues a few dozen sequential queries once, in one transaction; no hot path touched.

## Findings

- F-22 [P3] open: fixed seed dates expire (Daniel's one-off date after Oct 18, closed dates in 2027)
- F-23 [P3] open: a seeded person with `dateHours` but no `weeklyHours` key is silently skipped
- F-24 [P3] open: seed types unexported; `PersonSeedType` also types rooms
- F-25 [P3] open: a dev database that was not rebuilt keeps the old businesses beside the new
- F-17, F-18, F-19, F-20, F-21 closed. No P0 or P1 open or fixed.

## Remaining risk

- Check was not required and was not run; no browser flow exists in 2.3.
- The fresh-database path (drop, `db:migrate`, `db:seed`) was not reproduced by this reviewer, since dropping the database was out of bounds; it is inferred from row timestamps.
- The F-19 mutation was traced by reading, not re-run from a copy.
- `seed-dev.ts` is type-checked by no build or script; it passed only the standalone check run here.
- No security scanner or dependency audit command exists; none was run.
- No `Verify` command or CI check exists.
