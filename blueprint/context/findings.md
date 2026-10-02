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

### F-52 [P3] closed - holdTime and releaseTime cannot join a caller's transaction, which 5d and feature 7 need

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
**Resolution:** Closed 2026-10-02 by independent review of step 5d.2 (7846a1d..230181c): holdTime, releaseTime, findOrCreateContact and recordActivity take an optional executor, and holdTime runs each try in executor.transaction (postgres-js savepoint, rethrowing the original DrizzleQueryError so cause.code is still read); writing-as-one-transaction.test.ts proves a refused hold answers { held: false } with the caller's transaction committing its other rows, and a release plus a hold in one transaction invisible outside it until commit. A scratch probe (40 pairs of opposite-order holds, each inside its own db.transaction) saw 15 deadlocks in pg_stat_database, every pair still one held and one taken, every outer transaction still usable; the saved test for that path is F-77.

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
**Resolution:** Partly answered by step 5d.2, stays open: backend/lib/scheduling/is-room-free.ts is now the only copy of the rule and applyFreeTimesRules uses it (every 5c test unchanged and passing), and a room carrying its id still type-checks against RoomScheduleType, so 5d.3 can filter its own rooms. The booking, the second consumer this finding is about, does not exist yet; close it when bookTime picks its room with isRoomFree and a test shows it. See F-76 for the span the rule does not own.

### F-74 [P3] open - "Any available" answers an empty week when every person's calendar is unreadable

**File:** backend/lib/scheduling/find-free-times.ts:136 (test: backend/routes/public-booking-links-routes.test.ts:391-393)
**Found:** 2026-10-02 by the final independent review of feature 5c (scope: bf53ee6..bb2526d; lenses: all)
**Why it matters:** Decision 4 exists so "a broken calendar is never shown as
an empty week": a picked person's unreadable calendar answers 503. With "any
available" each unreadable person is left out (line 136-137 return `[]`), and
nothing checks whether anyone was left to answer. When every candidate is
left out, the route answers 200 with no start times, which a customer reads
as "fully booked". The route test asserts exactly this for a one-person
business (lines 391-393: 200, `startTimes: []`). For a one-person business
(Primo's shape) or a Google-wide outage, "any available" is then the empty
week decision 4 rules out for a pick, and the only trace is a console
warning. The code follows the spec's letter; the spec does not say what
happens when nobody is left.
**Suggested fix:** Decide it in the spec (5d, or feature 9, where the widget
chooses whether "any available" is its default): either answer 503
`unavailable` when every candidate was left out for an unreadable calendar,
or keep 200 and say so in decision 4. Then make the route test say which.
**Resolution:**

### F-75 [P2] fixed - Nothing in the schema or the plan makes "the same customer pressing Book twice gets one booking" hold when the two presses arrive together

**File:** packages/shared/db/booking-tables/booking-table.ts:64 (spec: blueprint/context/current-feature.md:66 and :184)
**Found:** 2026-10-02 by independent review of step 5d.1 (scope: 7510d47..65250fa; lenses: all)
**Why it matters:** For decision 7's lookup done one request after another,
`booking_starts_at_index` (organizationId, startsAt) is enough: the join through
`lead` to `contact.email` then touches a handful of rows. But nothing stops two
presses that overlap in time. `booking` has no contact column and no unique key
that could refuse a second booking for the same customer, service and start, and
5d.3 runs decision 7 "first, before the check", outside the transaction: a
check-then-insert, which the spec's own notes rule out without a constraint
behind it. Traced through the code that exists: A and B (same email, "any
available", two free people) both find no booking and both pass the check. A
inserts the contact; B's insert waits on `contact_organization_email_unique`
(find-or-create-contact.ts:49) until A commits, then reads A's contact, writes a
second lead and booking, is refused Ana by `commitment_no_overlap` and, by
decision 5, holds the next person. One customer, two practitioners blocked at the
same time. With a picked person B answers 409 `time_taken` to a customer who is
in fact booked, where decision 7 and the contract promise 201 with the same
booking. A double tap on a phone is the ordinary way this happens. 5d.3's Done
when tests "booking twice" only one after the other.
**Suggested fix:** Decide in 5d.3's plan, before it is built. Either (a) inside
the transaction, right after `findOrCreateContact`, lock the contact row
(`select ... for update`) and run decision 7's lookup again there, answering the
existing booking if one appeared, so two presses for one email queue behind each
other; or (b) while 0013 is unreleased, give `booking` the contact it is for and a
partial unique index (organizationId, bookingLinkId, startsAt, contactId) where
status is confirmed, so the database refuses the second (a contact without an
email is always new, so owner-made bookings still book every time). Add a test:
two identical "any available" requests at the same instant give one booking and
both answer it.
**Resolution:** Fixed 2026-10-02 with Frank's answer: neither suggested fix, because both refuse a parent booking two children for the same email, service and time. Instead a one-time requestKey per booking form (decision 7 rewritten): booking.requestKey with booking_request_key_unique on (organizationId, requestKey) where not null, migration 0014; the widget locks its Book button too (build plan item 9). The database test for the key is added and shown able to fail; 5d.3 handles a refused second copy and tests two copies at the same instant.

### F-76 [P3] fixed - The room rule is one function now, but the span it checks (the appointment plus both buffers) is still worked out only inside applyFreeTimesRules

**File:** backend/lib/scheduling/apply-free-times-rules.ts:79 (and backend/lib/scheduling/is-room-free.ts:11)
**Found:** 2026-10-02 by independent review of step 5d.2 (scope: 7846a1d..230181c; lenses: all)
**Why it matters:** `isRoomFree(room, date, spanStart, spanEnd)` takes the span
ready-made, so the buffers are not part of the one rule. The only code that
builds the span is lines 79-80 (`start - bufferBefore`, `start + duration +
bufferAfter`). 5d.3 must build the same span twice more, for `isRoomFree` and
for `holdTime`'s "buffers inside", and must load the rooms' busy time and
standby dates again with their ids, because `findFreeTimes` builds its rooms
without them (find-free-times.ts:112-115). F-64's own example of drift, "one
checking the buffers and one not", is exactly the part `isRoomFree` does not
guard: a booking whose span forgets `bufferAfterMinutes` would pass
`isRoomFree` for a room the free-time list refused, and the hold would then
also miss the buffer. Not observed: the booking code does not exist yet.
**Suggested fix:** In 5d.3, export one small helper for the span (for example
`appointmentSpan(start, service)` in its own file) used by
`applyFreeTimesRules`, the room check and the hold, and have a 5d.3 test book a
service with a buffer after next to a room taken only in that buffer.
**Resolution:** Fixed 2026-10-02: backend/lib/scheduling/appointment-span.ts, appointmentSpan(start, service), the one copy of the buffer before, the appointment and the buffer after; applyFreeTimesRules uses it, and 5d.3 must too (its Done when now names a room taken only during the buffer after). Tests added; with the buffer after dropped, 6 tests fail.

### F-77 [P3] fixed - No saved test covers the deadlock retry inside a caller's transaction, which this step promises

**File:** backend/lib/booking/writing-as-one-transaction.test.ts:67 (code: backend/lib/scheduling/hold-time.ts:45)
**Found:** 2026-10-02 by independent review of step 5d.2 (scope: 7846a1d..230181c; lenses: tests)
**Why it matters:** The spec (current-feature.md:172-173) and hold-time.ts's
header say a deadlock retry leaves the caller's transaction usable. The new
tests only exercise the `23P01` path inside a transaction; the existing
"many simultaneous holds" test uses the pool path only. The behaviour itself
holds: a scratch probe ran 40 pairs of opposite-order holds (`[ana, room]` and
`[room, ana]`), each inside its own `db.transaction` followed by a further
query on that transaction, and `pg_stat_database.deadlocks` rose by 15 during
the run; every pair gave one held and one taken, nothing threw, all 80 outer
transactions stayed usable. The same probe on the pool path saw 10 deadlocks,
all resolved. So nothing is broken, but a later change (for example dropping
the per-try `transaction()` on the pool path, or moving the retry outside the
savepoint) could break the in-transaction path with every test still green.
**Suggested fix:** Add the in-transaction twin of "many simultaneous holds"
to writing-as-one-transaction.test.ts: each hold inside its own
`db.transaction` that runs one more statement after it, asserting one held and
one taken per pair and no throw.
**Resolution:** Fixed 2026-10-02: writing-as-one-transaction.test.ts holds the same two people in opposite order inside two callers' transactions, ten times, each writing again after its hold; with the retry removed (ATTEMPTS = 1) it failed in 3 runs of 3.

### F-78 [P3] fixed - The spec still says rooms carry their resourceId, which the step deliberately dropped

**File:** blueprint/context/current-feature.md:176
**Found:** 2026-10-02 by independent review of step 5d.2 (scope: 7846a1d..230181c; lenses: quality)
**Why it matters:** Step 5d.2's text says "rooms carry their `resourceId`",
and the box is ticked, but `RoomScheduleType` (is-room-free.ts:9) has no id and
`findFreeTimes` builds its rooms without one. The build log records the
change ("the rooms did not have to carry their id"), but the commit only
ticked the box, and the project rule is that a spec found wrong is corrected
before the next step builds on it. 5d.3 is built from this file, which now
describes a room shape that does not exist.
**Suggested fix:** Amend 5d.2's bullet to what was built (`isRoomFree` takes any
room with `busy` and `standbyDates`; the booking filters its own id-carrying
rooms with it), and say in 5d.3 where those rooms and their ids are loaded.
**Resolution:** Fixed 2026-10-02: the spec's 5d.2 now says isRoomFree takes any room with its taken time and standby dates and a caller keeps its own ids, with appointmentSpan as the one span.
