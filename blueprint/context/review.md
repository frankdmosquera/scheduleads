# Independent Review

**Status:** passed
**Target commit:** 2519644e2c6546da22e694dbc478250b69f11ff0
**Base commit:** 931ecadd49bebb38bd9f02bf27a2deeab0236755
**Base ref:** main
**Spec hash:** 5444ce8ca0cb30f487c319f0c307cd90f15cac335bdc5b8bf3d3016f9a9744cb
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-09-26T02:58:07Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-26T03:01:39Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `931ecad..2519644` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

This is a per-step review (`AGENTS.md`, "A review after every step"): feature 2
is built and approved one step at a time, so only steps 2.1 and 2.2 are checked
in the spec and its status is not `verified`. Step 2.1 (through `b4b39a5`) was
reviewed and passed on 2026-09-25; the new work is step 2.2, commit `2519644`
(`b4b39a5..2519644`). Judge step 2.2 against its own `Done when` as amended on
2026-09-25, not against steps 2.3 to 2.6. The same commit also changes the
build log's code drawer viewer (`blueprint/context/project-log.html`, Prism
replaced by Shiki loaded from jsdelivr) and adds `blueprint/scripts/code-theme.mjs`;
those are in scope too.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (target, base and spec hash match; only review.md differed)
- `npm run test --workspace=backend`: pass (1 file, 10 tests)
- `npm run test --workspace=@scheduleads-app/shared`: pass (2 files, 25 tests)
- `npm run build --workspace=backend`: pass (no test files in `dist/`)
- `npx prettier --check backend/src`: pass
- Mutation of `availability-rules.ts:67` in a scratch copy, run with the repo's Vitest: fail as a test signal, all 10 tests still pass (see F-19)
- `resolveAvailability` from `backend/dist` against rows added to `scheduleads_dev` with psql and deleted after: pass (database left at 0 rules and 2 resources, as found)

## Evidence

- Database half of the 2.2 Done when, at 2026-09-25 18:00Z: a business with no business row returns null; another business's person returns null; an unknown id returns null; the first person with no row gets the business's week (source organization); a person with their own row gets their own week and one-off date, and that one-off date removes Oct 12 from their closed dates while the business keeps it closed.
- Rules half: the 10 Vitest tests cover each of the eight Done when rules, plus today taken in the business's time zone and settings always from the business.
- The three new source files appear byte for byte in the 2.2 code drawer of `project-log.html`.
- The Shiki viewer builds spans with `textContent`, never `innerHTML`, from theme JSON inside the page; `code-drawer.mjs` only ever emits `typescript` and `sql`, and both are loaded.
- No `.only`, `.skip` or `.todo` in backend or shared tests; no em dashes in the new files.

## Findings

- F-19 [P2] open - no test catches a follower with a row losing the business's one-off dates
- F-20 [P3] open - `AvailabilityRuleRowType` is not exported
- F-21 [P3] open - the build log's "full diff" links follow the branch head
- F-17 and F-18 not re-examined: step 2.2 did not touch their files

## Remaining risk

- `resolveAvailability` returns hours for a resource with `active = false`; 2.2 does not say, and the first caller that picks a person must decide.
- jsonb read from the database (`weeklyHours`, `dateHours`, `closedDates`) is trusted as typed with no runtime validation; safe only while every writer validates (the 2.3 seed CLI, item 12).
- Test files are excluded from `tsc` and Vitest does not typecheck, so a type error in a test is never reported.
- The build log loads `shiki@3` and `mermaid@11` from jsdelivr by major version only, with no integrity hash; a new release runs on the page unreviewed.
- Up to three sequential queries per call for one person; unmeasured, worth a look once item 9 resolves many people.
- Frontend build and lint not run: 2.2 changed nothing in `frontend`.
- Dashboard activity state (`run.json`) not written: the reviewer was limited to findings.md and review.md.
