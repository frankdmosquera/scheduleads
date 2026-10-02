# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-32 [P3] unverified - A pick is the package's display name, so a renamed holiday would take a business's booking page down

**File:** backend/lib/bookable-hours/closed-holidays.ts:58
**Found:** 2026-09-28 by /audit independent (scope: current; lens: quality)
**Why it matters:** `closedHolidays` stores `date-holidays`' English display
names (`"Thanksgiving"`, `"St. Patrick’s Day"` with a typographic apostrophe),
and a name the list no longer has throws, as step 2.6 piece 4 decided. The
throw propagates out of `applyBookableHoursRules` and the public detail route
answers `500` for that business until its row is corrected. The names are not a
stable identifier: the dependency is `^3.37.0`, so a lockfile refresh can pull
a minor release that renames or drops a holiday, and a province can abolish
one, after which every business that picked it loses its public booking page,
not just that one closure. The saved tests pin the nine Alberta names and
National Day for Truth and Reconciliation, so a rename of those would fail the
tests on upgrade; any other name a feature 12 picker offers would not. Not
observed: no rename exists in 3.37.0, and the probe found no name that differs
in date between Alberta's list and the national one in 2026 to 2030, for any
province.
**Suggested fix:** Decide in feature 12, when the picker writes names: either
validate picks against the list at write time and keep a test over every name
the picker can offer, or store a stable key (the package's `rule` string) with
the display name. Worth a note on feature 12 now so it is not rediscovered.
**Resolution:** Carried to feature 12 on Frank's call, 2026-09-28, noted on
item 12 in `build-plan.md`. Stays unverified until then.

### F-47 [P3] open - The spec says accepting an invitation is refused, but Better Auth checks no role for it

**File:** blueprint/context/current-feature.md:328
**Found:** 2026-09-30 by /audit independent (scope: step 3b.2; lens: security)
**Why it matters:** Data / contracts says `invite-member` "(and accepting
one): refused, no role holds an invitation permission". Better Auth 1.7.5's
`/organization/accept-invitation` checks only that the invitation is pending,
unexpired and addressed to the signed-in user (`crud-invites.mjs:264-268`), never
the inviter's or anyone's role. Closing `invitation` stops new invitations, so
accepting is closed in practice only once no pending one exists. An invitation
made before this change stays acceptable until it expires (48 hours by
default), and its acceptance puts a client in a second business. Real clients
cannot reach the product yet, so the live risk is close to nil.
**Suggested fix:** Reword the contract line (accepting is closed because no
invitation can be made any more), and before the first client-facing deploy
confirm the production `invitation` table holds no pending row.
**Resolution:**
Carried on Frank's call, 2026-09-30: checked on the live database before the first client-facing deploy (the `invitation` table must be empty, or its rows cancelled). Nothing in code to change.

### F-52 [P3] open - holdTime and releaseTime cannot join a caller's transaction, which 5d and feature 7 need

**File:** backend/lib/scheduling/hold-time.ts:33
**Found:** 2026-10-01 by /audit independent (scope: step 5a.2, 1def0b9..d5175ae; lens: quality)
**Why it matters:** The declared deviation holds for this step: one
`INSERT ... VALUES` is atomic in Postgres, and its foreign key checks run
inside the same statement, so a refused row takes the whole hold with it (the
cross-business test proves `mine.ana` gets no row). But both functions always
use the global `db`. 5d writes the booking, its commitments and the timeline
entry together, and feature 7's reschedule must release the old time and hold
the new one together; neither can be all-or-nothing through these functions as
written. Inside a transaction, a `23P01` also aborts the whole transaction, so
answering `{ held: false }` there needs a savepoint.
**Suggested fix:** Nothing to change in 5a. Decide in 5d's spec: let both take
an optional executor (`db` or a transaction) and hold inside a nested
transaction (savepoint) so "taken" leaves the caller's transaction usable.
**Resolution:**

### F-58 [P3] open - The seed never gives an existing Chemical Peel its 15-minute step, so a migrated (not rebuilt) dev database keeps it empty

**File:** packages/shared/scripts/seed-dev.ts:485
**Found:** 2026-10-02 by independent review of step 5c.1 (scope: bf53ee6..d5a5878; lenses: all)
**Why it matters:** The seed's find-or-make inserts a service only when its
slug is missing (`if (!existingLink)`), so `slotIntervalMinutes: 15` reaches
the database only on a fresh build. Checked read-only on the local
`scheduleads_dev` after this step: migration 0012 is applied, yet every
clinic service, Chemical Peel included, has `slotIntervalMinutes` null. The
build log says so, and dev databases are disposable, so nothing is wrong in
5c.1 itself. The risk is 5c.4 and 5c.5, whose tests run "on the seeded
clinic": any test that leans on the peel's seeded 15 passes on a rebuilt
database and fails on this one, or on any machine that only ran `db:migrate`
and `db:seed`.
**Suggested fix:** Nothing to change in 5c.1. Before 5c.4, rebuild the local
`scheduleads_dev` (drop, migrate, seed), and have the 5c.4/5c.5 tests that
need a step set it on a service they create themselves rather than read the
seed's value.
**Resolution:**

### F-59 [P3] fixed - On the spring clock change an appointment can run past the end of its bookable window

**File:** backend/lib/scheduling/apply-free-times-rules.ts:68
**Found:** 2026-10-02 by independent review of step 5c.2 (scope: cb29f51..b5bf8c4; lenses: all)
**Why it matters:** The window fit is checked in clock minutes
(`minute + durationMinutes <= endMinute`), while decision 6 says lengths are
real minutes. On the day the clock skips an hour, a start before the skip
whose appointment crosses it ends one hour later on the clock than the check
assumes. Probe: America/Denver, Sunday 2027-03-14, window 1:30 to 3:00, a
60-minute service: 1:30 (08:30Z) is offered, and it ends at 09:30Z, which is
3:30 on the clock, 30 minutes after the window closes. The code matches the
contract formula as written, so this is a gap between the contract and
decision 6, not a broken contract. Only windows that span the skipped hour
(around 2am, one day a year) are affected, so the practical risk is very low.
**Suggested fix:** Either also require the real end to be no later than the
window's end moment (`localTimeToMoment(date, window.endMinute)`, falling back
to the clock check when that is null), or record in the spec that the fit is
in clock minutes and accept it.
**Resolution:** Fixed in 5c.2 review fixes: a start must also end, in real minutes, by the window end as a moment (when that moment exists); test "the spring change cannot stretch an appointment past its window" (Denver, 2027-03-14, 1:30 to 3:00, 60 minutes, now offers nothing), shown able to fail.

### F-60 [P3] fixed - local-time.ts holds three exports and is now imported across areas, against one file per export

**File:** backend/lib/scheduling/local-time.ts:36
**Found:** 2026-10-02 by independent review of step 5c.2 (scope: cb29f51..b5bf8c4; lenses: all)
**Why it matters:** The backend standard is kind, then area, then one file
per export, and a helper used across several areas goes in a shared place.
`local-time.ts` exports `localDate`, `addDays` and `localTimeToMoment`; it is
the only backend lib file besides `auth-server.ts` with more than one exported
function. Moving `localDate` and `addDays` here also makes
`lib/bookable-hours/apply-bookable-hours-rules.ts:6` (feature 2) import from
`lib/scheduling` (feature 5), so the older area now depends on the newer one.
Behaviour is unchanged (the bookable-hours tests pass), so this is about
finding things by file name, which is how Frank navigates.
**Suggested fix:** Split into one file per function (for example
`local-date.ts`, `add-days.ts`, `local-time-to-moment.ts`), and put the two
that both areas use where shared helpers go, or say in the spec that
`local-time.ts` is a deliberate exception.
**Resolution:** Fixed in 5c.2 review fixes: split into backend/lib/local-time/ with one export per file (clock-as-utc, local-date, add-days, local-time-to-moment) and a test beside each; feature 2 and 5c both import from there, so neither reaches into the other area.

### F-61 [P3] fixed - A few edges of the free-time rules have no test: the room over the buffers, a block ending at the start, the last horizon date, a window ending at midnight

**File:** backend/lib/scheduling/apply-free-times-rules.test.ts:134
**Found:** 2026-10-02 by independent review of step 5c.2 (scope: cb29f51..b5bf8c4; lenses: all)
**Why it matters:** All the Done-when cases are covered and pass, but these
mutations would still pass the suite: a room checked over the appointment
only instead of the span with both buffers; a busy block that ends exactly at
a start being treated as blocking (only the "starts as the appointment ends"
side is tested); `date < lastDate` in place of `<=`, because the horizon test
proves Oct 12 is out but never that the last day (Oct 9) is in; and a window
ending at minute 1440. Probes show the current code handles all four
correctly, so this is a guard for later edits, not a defect.
**Suggested fix:** Add four small cases: a room whose busy block touches only
the after-buffer; busy ending at 9:00 with a 9:00 start offered; a horizon
whose last date has hours and is offered; a 22:00 to 24:00 window offering
22:00 and 23:00.
**Resolution:** Fixed in 5c.2 review fixes: five cases added (a room checked over the buffers, busy time ending at the start, the horizon's last date, a window to midnight, and F-59's spring case); each shown able to fail by breaking its rule on purpose.

### F-62 [P3] unverified - Each start costs four Intl calls, repeated for every person, which grows "any available" on a public route

**File:** backend/lib/scheduling/apply-free-times-rules.ts:71
**Found:** 2026-10-02 by independent review of step 5c.2 (scope: cb29f51..b5bf8c4; lenses: all)
**Why it matters:** `localTimeToMoment` runs `formatToParts` four times per
candidate start (about 12 microseconds each call here). Measured on this
laptop: 31 days of all-day windows with a 15-minute step is about 40 ms for
one person; ordinary office hours (8 to 18, weekdays) about 10 ms. 5c.4
applies the rules per person, so "any available" over six practitioners
repeats identical date and minute conversions six times, roughly 60 ms
typical and 250 ms worst case of synchronous work per public request, on a
route with no rate limit yet. Unverified because no real request has been
timed; 5c.4 does not exist yet.
**Suggested fix:** When 5c.4 is built, time an "any available" request on the
seeded clinic. If it matters, convert each (date, minute) once per request
and share it across people, or work out each date's offset once and only fall
back to `localTimeToMoment` on clock-change days.
**Resolution:**
