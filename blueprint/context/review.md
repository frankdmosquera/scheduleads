# Independent Review

**Status:** passed
**Target commit:** 5a30d472e59621b62e5b88bae2e5532978d913a3
**Base commit:** 931ecadd49bebb38bd9f02bf27a2deeab0236755
**Base ref:** main
**Spec hash:** 072b404b016a35ef9a82d6205bc75cf19236b0ef241131e4d5b8b5e8297f1bf0
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-09-28T13:34:06Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-28T13:40:13Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `931ecad..5a30d47` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

This is a per-step review (`AGENTS.md`, "A review after every step"): feature 2
is built and approved one step at a time. The last receipt passed at `78370d9`
(step 2.5). New since then (`78370d9..5a30d47`): the F-29 and F-30 fixes
(`b86c70c`, `b2c5856`, marked `fixed`, yours to close or reopen); docs and
build-log chores (`3292f91` to `de03970`), including `4cbc707`, which split the
shared tables one per file and renamed the validation folders (behaviour
unchanged, `db:generate` found no change), and `1e45d8d`, a comment sweep; and
step 2.6 itself, commit `5a30d47` (`de03970..5a30d47`).

Step 2.6, "Holidays the owner picks", as rewritten and approved on 2026-09-28
(spec, step 2.6, Part 1 pieces 1 to 5 and the Done when). The rule behind it,
new project plan decision 30: the product never decides a business's schedule;
nothing is closed by default. What it adds: `date-holidays ^3.37.0` in the
backend only (Frank's yes); `closedHolidays` (jsonb, not null, default `[]`)
on `availability_rule`, with the row-kind check keeping it empty on a person's
row and a new check that picks need a country, migration
`0002_closed_holidays.sql`; the form check's `closedHolidays`;
`backend/lib/bookable-hours/closed-holidays.ts` turning picked names into dates
from the province's and the country's lists, throwing on an unknown country,
province or name (the package silently falls back to the national list for an
unknown province); `applyBookableHoursRules` adding them to the closed dates
before one-off dates open any; the dev seed's picks (painting all nine,
clinic four, set on existing rows too); 8 rules tests and 4 form-check tests.
By-hand checks (planted faults, database refusals, the public routes' closed
dates on Sep 28, the seed run twice, the frontend bundle) are recorded on the
build log page, not in the repo; the routes can be re-read by building the
backend and calling `app.request` from `backend/dist/app.js` against the seeded
local `scheduleads_dev`.

**Working tree note.** Four files are modified in the working tree but are not
part of the target and were not made by the builder: `AGENTS.md`,
`blueprint/context/ai-interaction.md`, `.claude/skills/complete/SKILL.md` and
`.claude/skills/continuous/SKILL.md` (someone else's uncommitted edits, left
untouched). Exclude them from the review and record them under Remaining risk
rather than treating the target as stale.

## Commands

- `git rev-parse HEAD`: pass (`5a30d472e59621b62e5b88bae2e5532978d913a3`, equals Target commit)
- `git merge-base main HEAD`: pass (`931ecadd49bebb38bd9f02bf27a2deeab0236755`, equals Base commit)
- SHA-256 of `blueprint/context/current-feature.md`: pass (equals Spec hash)
- `npm run test --workspace=@scheduleads-app/shared`: pass (2 files, 29 tests)
- `npm run test --workspace=backend`: pass (2 files, 38 tests, against the seeded local `scheduleads_dev`)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass
- Planted faults in `closed-holidays.ts` (temporary edit, restored byte-for-byte, SHA-256 compared, `git status` unchanged): pass, each caught by exactly one test
- Holiday probe against `backend/dist` and `date-holidays` 3.37.0: pass
- Database probe in one transaction, rolled back; public detail route via `app.request` from `backend/dist/app.js`: pass

## Evidence

- Freshness: HEAD, merge base against local `main` and spec hash all match the request. The only other paths differing from the target are the four files named in the working-tree note plus this file; excluded as instructed.
- Step 2.6 against its Done when: rules tests cover no picks, Family Day on Feb 16 2026 and Feb 15 2027, all nine closing exactly nine 2026 dates, the national-only Sep 30 for an Alberta business, Heritage Day unpicked staying open, a one-off date opening a picked Canada Day for that person only, a horizon across New Year, and an unknown name and province throwing (`apply-bookable-hours-rules.test.ts:172-268`); 4 new form-check tests (`availability-validation-schemas.test.ts:131-154`).
- Planted faults: removing the province check failed only the unknown-name/province test; dropping the national list failed only the national-only test; limiting the year loop to the first year failed only the New Year test.
- Probe: unknown country `ZZ`, unknown province `CA-ZZ` and lowercase `ab` throw; picks with no country throw; no picks with no country return nothing; no name in any Canadian province's list has a different date from the national list in 2026 to 2030.
- Database (rolled back): `closedHolidays` is `jsonb not null default '[]'`; picks on a person's row, picks with no country on the business row, and a null `closedHolidays` are all refused; clearing picks and country together is allowed; the row was unchanged after rollback.
- Public detail route today (2026-09-28): `painting-dev` closes `2026-10-12` (Thanksgiving) and `2026-11-11` (Remembrance Day); `clinic-dev` closes `2026-09-30`, `2026-12-25` and `2027-01-01` and not Thanksgiving; neither answer contains `organizationId` or `source`.
- Lockfile: step 2.6 adds `date-holidays` and twelve helper entries and removes nothing; the frontend's `.next/static` contains no `date-holidays` code.
- Migration `0002_closed_holidays.sql` adds the column before re-adding the row-kind check and adds the picks-need-country check; the Drizzle table matches it.
- Earlier commits in the delta: F-29 and F-30 repairs re-read and closed; `4cbc707` (tables one per file, validation folders renamed) and `1e45d8d` (comment sweep) change no behaviour in the code read (exports, drizzle glob, package exports; the builds and tests pass); no em dashes and no AI attribution in the step's code or commit.

## Findings

- F-29 closed (repair verified)
- F-30 closed (repair verified)
- F-31 [P3] open: holiday dates recomputed per public request, work grows with an unbounded `horizonDays`
- F-32 [P3] unverified: picks are the package's display names; a renamed holiday would 500 the business's public detail route
- F-33 [P3] open: spec still says step 2.6 is "not agreed yet", with no approval or built record and a stale Files / areas list

## Remaining risk

- Four files outside the target are modified in the working tree by someone else and were not reviewed: `AGENTS.md`, `blueprint/context/ai-interaction.md`, `.claude/skills/complete/SKILL.md`, `.claude/skills/continuous/SKILL.md`. Seen in passing: they switch `/complete` and `/continuous` to deleting the merged feature branch, which contradicts the workspace `CLAUDE.md` rule "Never delete a branch" and the committed `AGENTS.md`.
- Check was not required and was not run; no dev server or browser was started. The F-29 live check and the step's by-hand checks (seed run twice, browser) are the builder's and were not repeated; this pass re-read the public route through `app.request` instead.
- The throw on an unknown pick answers `500` on a public route by design (step 2.6 piece 4); nothing yet alerts on it.
- The dashboard activity record (`blueprint/.state/run.json`) was not written: this reviewer was limited to `findings.md` and `review.md`.
- Rate limiting the public routes remains out of scope (spec), which F-31's cost makes slightly more relevant once owners set their own horizon.
