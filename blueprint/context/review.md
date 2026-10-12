# Independent Review

**Status:** passed
**Target commit:** 88292e5d0d61dbd5a22e80bdc6f8c204abe291ce
**Base commit:** d4cc8837041288c0f84a013ee3f05ecb1505a76b
**Base ref:** main
**Spec hash:** fffdf6c6a6d10126c8de733b2cba81d451a9ff129080ac42f58737ccb080f64b
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-12T19:19:22Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-12T19:23:48Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `d4cc8837041288c0f84a013ee3f05ecb1505a76b..88292e5d0d61dbd5a22e80bdc6f8c204abe291ce` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (188 tests)
- `npm run test --workspace=backend`: pass (88 files, 1010 tests, local Postgres)
- `npm run build --workspace=frontend`: pass (`/settings/calendar` built)
- `npm run lint --workspace=frontend`: pass

## Evidence

- Freshness: `HEAD` = target, `git merge-base main HEAD` = base, spec SHA-256 matches, only `review.md` differs among tracked paths.
- Whole delta read (32 files): migration 0030 and table column, busy-calendars schema and its test, the third scope and `hasEveryCalendarScope`, `listCalendars` and multi-id `findBusyBlocks`, `getBusyTimes` pick, keep-or-reset pick in `saveCalendarConnection` (`excluded."accountEmail"` against the old row), `findCalendarChoices`, `saveBusyCalendars` (allowed = listed plus already ticked, update guarded by connection id, organization, person and account), the two routes under `/calendar/*` CORS, CSRF and no-store, callback to `/settings/calendar`, the Calendar page, card move and pick list.
- Contract points checked against the spec: 409 `no_connection`/`reconnect_needed`/`no_person`, 503 on Google failure, 400 with `field: "calendarIds"`, strict schema (repeats, 50, 1-1024), ids rendered as React text, bookings still written to `primary` only.
- Every test the spec's Testing section names exists and passes; consumers of `getBusyTimes` (`find-free-times.ts`, `find-booking-choices.ts`, `calendar-check.ts`) handle the joined, possibly overlapping blocks.

## Findings

- F-407 [P3] open: Calendar page says "only your main calendar counts" for a connection that needs reconnecting
- F-408 [P3] open: nothing ticked still renews the key and still blocks a person with a lapsed connection
- F-409 [P3] open: a moved booking's span is crossed off every ticked calendar, not only the main one

## Remaining risk

- No run against real Google: the consent with `calendar.calendarlist.readonly`, the real calendarList and multi-calendar free/busy shapes (including the key Google files `primary` under) are proved only against fakes; moved to 10b by Frank's decision.
- `/check` not run (not required); the Calendar page was not exercised in a browser by this review.
- `listCalendars` paging (nextPageToken, 10-page cap) has no test.
- The untracked `blueprint/ai-voice-proposal.md` (Frank's Oct 2 proposal note, not code) sits in the working tree outside the target; it does not touch the reviewed code.
