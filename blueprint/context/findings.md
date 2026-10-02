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

### F-59 [P3] closed - On the spring clock change an appointment can run past the end of its bookable window

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
**Resolution:** Fixed in 5c.2 review fixes: a start must also end, in real minutes, by the window end as a moment (when that moment exists); test "the spring change cannot stretch an appointment past its window" (Denver, 2027-03-14, 1:30 to 3:00, 60 minutes, now offers nothing), shown able to fail. Closed by independent review of step 5c.3 (2026-10-02): the check at apply-free-times-rules.ts:79 compares the real end with the window end as a moment; a scratch copy with that check disabled fails exactly this test (it offers 2027-03-14T08:30Z). Autumn and midnight window ends resolve to real moments (first occurrence, minute 1440), so no new refusal or offer appears; a window ending inside the skipped hour falls back to the clock count, as its comment says. No new defect.

### F-60 [P3] closed - local-time.ts holds three exports and is now imported across areas, against one file per export

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
**Resolution:** Fixed in 5c.2 review fixes: split into backend/lib/local-time/ with one export per file (clock-as-utc, local-date, add-days, local-time-to-moment) and a test beside each; feature 2 and 5c both import from there, so neither reaches into the other area. Closed by independent review of step 5c.3 (2026-10-02): backend/lib/scheduling/local-time.ts is gone, backend/lib/local-time/ holds one export per file, nothing imports the old path (grep), and the full backend suite (256 tests) passes. One small inaccuracy above: clock-as-utc.ts has no test of its own; it is covered through the three helpers' tests. No new defect.

### F-61 [P3] closed - A few edges of the free-time rules have no test: the room over the buffers, a block ending at the start, the last horizon date, a window ending at midnight

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
**Resolution:** Fixed in 5c.2 review fixes: five cases added (a room checked over the buffers, busy time ending at the start, the horizon's last date, a window to midnight, and F-59's spring case); each shown able to fail by breaking its rule on purpose. Closed by independent review of step 5c.3 (2026-10-02): re-broken in a scratch copy, each case failed as claimed (room checked over the appointment only; busy end treated as blocking with `>=`; `date < lastDate`; the spring check removed). No new defect.

### F-62 [P3] open - Each start costs four Intl calls, repeated for every person, which grows "any available" on a public route

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
**Resolution:** Confirmed (unverified to open) by independent review of step 5c.4 (2026-10-02). The cost is real and is synchronous work, so reading people side by side (Promise.all) shortens the database and Google waits but not this: each person's applyFreeTimesRules still runs one after another on the event loop. Measured in a scratch copy, the rules alone for 7 people over 31 dates (30 minutes, 15 after, one room): weekdays 9 to 17 every 15 minutes, about 73 ms; every day all day every 15 minutes, about 416 ms; every day all day every 5 minutes, about 1.15 s. The build log's 75 ms for the dev clinic matches the first case, so that request is almost all this work, not the reads. Fine for the four tenants' daytime hours; it grows with long windows and a small step (the database allows any step above 0), on a public route with no rate limit yet. Stays a P3, for feature 9 (first public traffic) or feature 12 (where an owner sets the step): work out each date's offset once per request and share it across people, or put a floor on the step.

### F-63 [P3] closed - A booking is counted on the day its buffer starts, not the day its appointment starts, and the counting helper is not in the spec

**File:** backend/lib/scheduling/count-bookings-that-day.ts:14
**Found:** 2026-10-02 by independent review of step 5c.3 (scope: 4d6d1ce..4858600; lenses: all)
**Why it matters:** The comment says "A booking belongs to the day it starts
on", but a booking commitment's `startsAt` already includes the buffer before
(commitment-table.ts:24, hold-time.ts:16). Probe: an appointment at 00:10 on
Tuesday Oct 6 in Edmonton with 15 minutes before has a commitment starting
Monday 23:55, and `countBookingsThatDay` counts it on Monday, not Tuesday. The
code matches decision 2's literal wording ("booking commitments on that
date"), so this is a wording gap, and only bookings within a buffer of
midnight are affected, so the practical risk is very low. Separately,
`count-bookings-that-day.ts` is not named in the spec's step 5c.3, Files /
areas, or Data / contracts, although 5d will need it to produce
`bookingsThatDay`.
**Suggested fix:** Correct the comment to say the day the commitment starts
(buffer included), or say in decision 2 which start counts; and add
`countBookingsThatDay(commitments, date, timezone)` to the spec's files and
contracts so 5d calls it as specified.
**Resolution:** Fixed in 5c.3 review fixes: the comment now says a booking belongs to the day its commitment starts on, buffer before included (only a buffer reaching back over midnight moves it), matching decision 2's wording; the spec's decision 2 says which start counts, and countBookingsThatDay is in step 5c.3, Files / areas and Data / contracts. Closed by independent review of step 5c.4 (2026-10-02): count-bookings-that-day.ts:14-15 now says the commitment's start, buffer before included, which is what the code does (localDate of startsAt) and what decision 2 now says; the helper and its contract are in the spec's step 5c.3, Files / areas and Data / contracts. No new defect.

### F-64 [P3] open - chooseAnyAvailable needs "only the free rooms", but no code says which rooms are free, so 5d would rebuild the room rule

**File:** backend/lib/scheduling/apply-free-times-rules.ts:87
**Found:** 2026-10-02 by independent review of step 5c.3 (scope: 4d6d1ce..4858600; lenses: all)
**Why it matters:** The contract trusts the caller to pass only free people
and only free rooms. Free people can be found by running
`applyFreeTimesRules` for one person and one date and checking the start is
in the answer. Free rooms cannot: the room rule (not on standby that date,
and no busy block over the appointment plus both buffers, half-open) lives
inline at lines 87 to 95, and `FreeTimesRoomType` (line 20) has no
`resourceId`, so nothing returns which rooms passed. 5d would have to write
that rule a second time, and two copies of it can drift (for example one
checking the buffers and one not), which would let a booking take a room the
free-time list never offered.
**Suggested fix:** When 5d is specced, name how it gets the free rooms: pull
the room check out into one exported helper (for example
`isRoomFree(room, date, spanStart, spanEnd)` in its own file) used by both
`applyFreeTimesRules` and 5d, with `resourceId` on the room input.
**Resolution:**

### F-65 [P3] closed - Step and decision history in the new code comments

**File:** backend/lib/scheduling/count-bookings-that-day.ts:2
**Found:** 2026-10-02 by independent review of step 5c.3 (scope: 4d6d1ce..4858600; lenses: all)
**Why it matters:** The comments standard says no history in code comments
(step numbers, finding numbers): that lives in the build log.
`count-bookings-that-day.ts:2` says "(5c.3)" and
`choose-any-available.ts:1` says "(decision 2, Frank, 2026-10-02)". Feature
references elsewhere in the backend are common, but a step number and a dated
decision are the history the standard names.
**Suggested fix:** Drop "(5c.3)" and the date; keep the rule itself in the
comment ("the fewest bookings that day, ties by name then id").
**Resolution:** Fixed in 5c.3 review fixes: the step number and the date are gone from both headers; the rule stays. Closed by independent review of step 5c.4 (2026-10-02): count-bookings-that-day.ts and choose-any-available.ts carry no step number or date, and the rule is kept. The same kind of comment remains in test files (choose-any-available.test.ts:6 and :15, and the new find-free-times.test.ts:1), recorded as F-69.

### F-66 [P3] closed - No test subtracts Google busy time or reaches the edges of the read window

**File:** backend/lib/scheduling/find-free-times.test.ts:1 (code: find-free-times.ts:85-89 and :129)
**Found:** 2026-10-02 by independent review of step 5c.4 (scope: 577bab2..d6ef7d9; lenses: all)
**Why it matters:** Google busy time is half of what this step subtracts, yet
no test gives a person a Google busy block: every test person is unconnected
or needs reconnecting. Mutation probes in a scratch copy: dropping
`...googleBusy` from the busy list (line 129) passes all 8 tests, and so does
narrowing the read window by a day on each side (`- DAY_MS` removed, `2 *
DAY_MS` to `DAY_MS`). The second would miss a booking or Google busy time on
an Edmonton evening (after 18:00 local is the next UTC day) and offer a time
that is taken. The code is right today; nothing would catch a later edit. The
other probes (union, picked throw, picked not offered, rooms, standby, busy
per person, the warning line) each fail a test, and dropping the service's
active check is a double guard findServiceResources also holds.
**Suggested fix:** Add two cases: a connected person with Google faked the way
get-busy-times.test.ts does (a stubbed fetch and a saved connection), whose
busy block removes a start; and a commitment late on the last date (an
evening window, after midnight UTC) that removes the time it covers.
**Resolution:** Fixed in 5c.4 review fixes: two tests added, a person's faked Google busy time removing the time it covers, and taken time late on the last date (Tuesday in UTC) still seen; each shown able to fail by dropping Google's busy time and by narrowing the read window by a day. Closed by independent review of step 5c.5 (2026-10-02): both tests are in find-free-times.test.ts at ac66226 and pass.

### F-67 [P3] closed - A picked person's unreadable calendar leaves no log line, and the reason is dropped

**File:** backend/lib/scheduling/find-free-times.ts:118
**Found:** 2026-10-02 by independent review of step 5c.4 (scope: 577bab2..d6ef7d9; lenses: all)
**Why it matters:** With "any available" the failure is logged with its
reason (needs reconnecting, Google's status, a bad token key, a database
fault). When the customer picked that person, the same failure becomes a bare
`CalendarUnavailableError` with no `cause` and nothing logged, so 5c.5 answers
503 and whoever looks later cannot tell why; the route cannot log it either,
since the reason is gone. For a one-person business every request is a picked
one.
**Suggested fix:** Log the same one warning line before throwing, or pass the
original as `cause` (the constructor taking `ErrorOptions`) so 5c.5 logs it
with `safeErrorReason`.
**Resolution:** Fixed in 5c.4 review fixes: a picked person's unreadable calendar now logs the same one-line warning before throwing, and the original error travels as the CalendarUnavailableError's cause; the test checks both. Closed by independent review of step 5c.5 (2026-10-02): the warning and the cause are still in find-free-times.ts at ac66226, and the test passes.

### F-68 [P3] closed - A range whose last date is before its first throws a database error, and 5c.5's clamp can make one

**File:** backend/lib/scheduling/find-free-times.ts:85
**Found:** 2026-10-02 by independent review of step 5c.4 (scope: 577bab2..d6ef7d9; lenses: all)
**Why it matters:** The read window is built from the raw dates, so when
`fromDate` is more than about two days after `toDate` the window is inverted
and `findCommitments` fails ("Reading time failed: database error 22000",
probed in a scratch copy with Oct 12 to Oct 5), a 500; were that read to pass,
getBusyTimes would refuse the range too, which a picked person turns into a
misleading 503. The route's Zod rule (`from <= to`) stops a raw inverted
request, but decision 5 then clamps the range to today through today plus the
horizon: a request wholly in the past (Sep 1 to Sep 15, clamped to start
today) or wholly past the horizon inverts after clamping. Unclamped, Google
and the commitments are also read for dates the rules will discard.
**Suggested fix:** In 5c.5, answer an empty clamped range with no start times
before calling findFreeTimes, and add that case to its Done when; or have
findFreeTimes answer `startTimes: []` when `fromDate > toDate`, and say which
in the spec's contract.
**Resolution:** Fixed in 5c.4 review fixes: findFreeTimes answers no times, without reading anything, when fromDate is after toDate; test added and shown able to fail. Closed by independent review of step 5c.5 (2026-10-02): the guard still answers before any read at ac66226; the route never sends an inverted range (Zod refuses one), and its unclamped reads are recorded as F-70.

### F-69 [P3] closed - Step numbers in test file comments

**File:** backend/lib/scheduling/find-free-times.test.ts:1
**Found:** 2026-10-02 by independent review of step 5c.4 (scope: 577bab2..d6ef7d9; lenses: all)
**Why it matters:** The comments standard says no history in code comments,
step numbers included. The new test's header says "every reader 5c.4
gathers", and two from step 5c.3 remain in choose-any-available.test.ts:6
("step 5c.3's simulation") and :15 ("the commitment rows 5c.4 will read").
**Suggested fix:** Drop the step numbers and keep what each comment says (for
example "every reader free times gathers", "the commitment rows the free-time
read gathers").
**Resolution:** Fixed in 5c.4 review fixes: the step numbers are gone from the two test files' comments. Closed by independent review of step 5c.5 (2026-10-02): no step number in any comment under backend/lib, backend/routes or the new shared schema at ac66226.

### F-70 [P2] fixed - The route passes the asked dates unclamped, so a valid date near 9999 is a 500 and far-off dates still read Google

**File:** backend/routes/public-booking-links-routes.ts:123 (reads: backend/lib/scheduling/find-free-times.ts:87-91)
**Found:** 2026-10-02 by independent review of step 5c.5 (scope: 5368e0c..ac66226; lenses: all)
**Why it matters:** Decision 5 says a request is "clamped to today through
today plus the horizon"; the route instead sends the dates as asked and relies
on the rules to clamp the answer. The reads before the rules are built from
the raw dates. Probed through the real app against `clinic-dev`:
`?from=9999-12-30&to=9999-12-30` (and `9999-12-31`) answers 500, with
"Reading time failed: database error 22009" from `findCommitments`, because
the read window ends two days later, in year 10000, which Postgres refuses;
`9999-12-29` answers 200. `z.iso.date` accepts every year 0000 to 9999, so a
stranger reaches this with a query the schema calls valid, against the
contract's 200/400/404/503. The same unclamped window means
`?from=2099-01-01&to=2099-01-31` (200, no times) still reads every candidate's
commitments and, for a connected person, Google's busy times, for dates the
rules then discard (F-68 already named this; its fix covered only the inverted
range).
**Suggested fix:** Clamp before reading: in findFreeTimes, from the business
hours already resolved there, take `max(fromDate, today)` and
`min(toDate, today + horizonDays)` in the business's zone (or the largest
horizon among the candidates, if a person's can be longer), then let the
existing `fromDate > toDate` guard answer no times without reading. Add route
tests for a range wholly past the horizon (200, no times) and for 9999-12-31
(not 500). Correct the route comment at line 123 to match.
**Resolution:** Fixed 2026-10-02: findFreeTimes now cuts the dates to today through the business's horizon (a person's rules never carry their own) before any read; a range left empty answers no times unread. Route test for 9999-12-30 to 9999-12-31 (200, no times) added; removing the clamp makes it fail with the 500.

### F-71 [P3] fixed - A repeated person in the query answers Zod's own English message

**File:** packages/shared/zod-validation/booking-links-validation-schemas/free-times-query-validation-schema.ts:17
**Found:** 2026-10-02 by independent review of step 5c.5 (scope: 5368e0c..ac66226; lenses: all)
**Why it matters:** Hono's query validator turns a repeated key into an array.
Probed through the real app: `?from=2026-10-09&to=2026-10-12&person=a&person=b`
answers 400 with `"Invalid input: expected string, received array"`, the
library's wording, where every other refusal on the public routes is the
project's own sentence. A repeated `from` or `to` is fine ("Use a real date,
YYYY-MM-DD.") because `z.iso.date` carries its message for every issue; the
`.regex` message on `person` covers only the pattern, not the type. The status
is right; only the message leaks the library.
**Suggested fix:** Give the string itself the message,
`z.string({ error: "That is not a person id." }).regex(...)`, and add a schema
test with `person: ["a", "b"]`.
**Resolution:** Fixed 2026-10-02: the person rule carries its message on the string itself, so a person asked for twice reads "That is not a person id.". Schema test added; removing the message makes it fail.

### F-72 [P3] fixed - The coding standard says a public answer carries nothing about people, but the times route names them

**File:** blueprint/context/coding-standards.md:213
**Found:** 2026-10-02 by independent review of step 5c.5 (scope: 5368e0c..ac66226; lenses: all)
**Why it matters:** The public-route rule ends "The answer never carries
`organizationId` or anything about people or logins". Decision 7 deliberately
lets the times route name the people a customer can pick (id and name), and
the route does. The code follows the spec, so the standard is now wrong, and
a later reviewer reading it would flag the route, or a later route would be
built to the stricter line. The rule in AGENTS.md is to correct a wrong plan
file before the next step builds on it.
**Suggested fix:** Amend the line to: never `organizationId` or anything
about logins; about people, only the id and name of those offered for a
service, never standby, hours or calendar details (decision 7).
**Resolution:** Fixed 2026-10-02: coding-standards.md now says a public answer names, of people, only the id and name of those a customer can pick for a service, never standby, a calendar or contact details (decision 7).

### F-73 [P3] fixed - The route tests call the seeded clinic with no guard against a real Google connection

**File:** backend/routes/public-booking-links-routes.test.ts:249
**Found:** 2026-10-02 by independent review of step 5c.5 (scope: 5368e0c..ac66226; lenses: tests)
**Why it matters:** The spec says Google is never called in tests. The
free-times route tests read the seeded `clinic-dev`, whose facial
practitioners have no connection today, so nothing reaches Google; but nothing
enforces it. The dev database already carries a real connected Google
calendar on `painting-dev` (status `connected`, made from the dashboard), and
the seed links `owner@example.com` to Sofia, one of the three facial
practitioners. Once that login connects a calendar the same way, these tests
send Sofia's real tokens to Google on every run, and their answers depend on
her real calendar and on Google being reachable (an expired grant turns the
picked-person test for her into a 503). `find-free-times.test.ts` avoids this
by stubbing `fetch` to throw on any URL.
**Suggested fix:** In the "free times for a service" describe, stub `fetch`
to throw (as find-free-times.test.ts does), or assert in its `beforeAll` that
no `clinic-dev` person has a calendar connection and fail with "the seed
clinic has a calendar connected".
**Resolution:** Fixed 2026-10-02: the free-times route tests stub fetch to throw for their whole block, so a calendar connected by a dev login can never reach Google; it would fail the test loudly instead.
