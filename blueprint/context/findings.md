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

### F-64 [P3] closed - chooseAnyAvailable needs "only the free rooms", but no code says which rooms are free, so 5d would rebuild the room rule

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
**Resolution:** Fixed 2026-10-02 in step 5d.3: bookTime picks its rooms with isRoomFree over appointmentSpan's span (book-time.ts), the same rule and span as the free times; tested by "a room taken only during the buffer after is not chosen", which fails when the hold leaves the buffers out. Partly answered by step 5d.2, stays open: backend/lib/scheduling/is-room-free.ts is now the only copy of the rule and applyFreeTimesRules uses it (every 5c test unchanged and passing), and a room carrying its id still type-checks against RoomScheduleType, so 5d.3 can filter its own rooms. The booking, the second consumer this finding is about, does not exist yet; close it when bookTime picks its room with isRoomFree and a test shows it. See F-76 for the span the rule does not own. Not closed by the independent review of step 5d.3 (2026-10-02): the code does use isRoomFree (book-time.ts:214), but no saved test shows it. With isRoomFree mocked to always answer true, "a room taken only during the buffer after is not chosen" still passes (the database refuses Room 3 and decision 5 moves to Room 4), while a customer is booked into a room on standby; see F-79. Close it with F-79's test. Closed 2026-10-02 by independent review of step 5d.4 (7166169..ceb511c): bookTime still picks rooms with isRoomFree over appointmentSpan's span (book-time.ts:222-245), and with isRoomFree mocked to always answer true, book-time.test.ts fails "a room on standby that date is not chosen for a customer, but the owner may use it" (1 failed, 19 passed).

### F-74 [P3] closed - "Any available" answers an empty week when every person's calendar is unreadable

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
**Resolution:** Fixed in step 5d.5 (661b86e), per decision 9: findFreeTimes counts the calendars it read and the ones it could not; with "any available", none read and at least one failed throws CalendarUnavailableError, so the times route answers 503 `unavailable`. One readable calendar still answers 200. Tests: find-free-times.test.ts (no calendar readable) and the route test now asserting 503. Closed 2026-10-02 by independent review of step 5d.5 (6906956..2663680): find-free-times.ts:157-159 throws CalendarUnavailableError only when no calendar was read and at least one failed, and the times route maps it to 503 `unavailable` (public-booking-links-routes.ts:118-124). With the throw removed, both "\"any available\" with no calendar readable is \"try again\"" (find-free-times.test.ts) and "a calendar that cannot be read is a 503" (public-booking-links-routes.test.ts) fail; the existing "left out of \"any available\"" test (one readable, fully booked calendar beside an unreadable one) still answers 200 and would fail if the rule ignored the readable count. No new defect in the change.

### F-75 [P2] closed - Nothing in the schema or the plan makes "the same customer pressing Book twice gets one booking" hold when the two presses arrive together

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
**Resolution:** Fixed 2026-10-02 with Frank's answer: neither suggested fix, because both refuse a parent booking two children for the same email, service and time. Instead a one-time requestKey per booking form (decision 7 rewritten): booking.requestKey with booking_request_key_unique on (organizationId, requestKey) where not null, migration 0014; the widget locks its Book button too (build plan item 9). The database test for the key is added and shown able to fail; 5d.3 handles a refused second copy and tests two copies at the same instant. Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): the interleaving traced here (two copies both pass the check before either commits) is now refused by booking_request_key_unique (0014) and answered with the booking that won (book-time.ts:334-337, isSameRequest guarding it); with that clash handling disabled in a scratch run, "two copies of one form at the same instant give one booking, and both answer it" fails. A different interleaving, where the second copy's check runs after the first has committed, still answers time_taken and is recorded as F-92; it is not a defect of this repair.

### F-76 [P3] closed - The room rule is one function now, but the span it checks (the appointment plus both buffers) is still worked out only inside applyFreeTimesRules

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
**Resolution:** Fixed 2026-10-02: backend/lib/scheduling/appointment-span.ts, appointmentSpan(start, service), the one copy of the buffer before, the appointment and the buffer after; applyFreeTimesRules uses it, and 5d.3 must too (its Done when now names a room taken only during the buffer after). Tests added; with the buffer after dropped, 6 tests fail. Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): appointmentSpan (appointment-span.ts) is the one span, used by applyFreeTimesRules (:80) and bookTime (:179) for both the room rule and the hold; with the buffer after dropped in a scratch run, 4 tests fail (appointment-span.test.ts and three in book-time.test.ts, including the room taken only during the buffer after). No new defect.

### F-77 [P3] closed - No saved test covers the deadlock retry inside a caller's transaction, which this step promises

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
**Resolution:** Fixed 2026-10-02: writing-as-one-transaction.test.ts holds the same two people in opposite order inside two callers' transactions, ten times, each writing again after its hold; with the retry removed (ATTEMPTS = 1) it failed in 3 runs of 3. Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): writing-as-one-transaction.test.ts holds two people in opposite order inside callers' transactions; with ATTEMPTS = 1 in hold-time.ts in a scratch run it fails. No new defect.

### F-78 [P3] closed - The spec still says rooms carry their resourceId, which the step deliberately dropped

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
**Resolution:** Fixed 2026-10-02: the spec's 5d.2 now says isRoomFree takes any room with its taken time and standby dates and a caller keeps its own ids, with appointmentSpan as the one span. Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): current-feature.md 5d.2 now says isRoomFree takes any room with its taken time and standby dates and a caller keeps its own ids, matching is-room-free.ts and bookTime's id-carrying rooms (book-time.ts:226-247).

### F-79 [P3] closed - No saved test fails when bookTime stops filtering rooms with isRoomFree, so a room on standby could be booked for a customer unnoticed

**File:** backend/lib/booking/book-time.ts:214 (test: backend/lib/booking/book-time.test.ts:395)
**Found:** 2026-10-02 by independent review of step 5d.3 (scope: 4b04e58..285b930; lenses: tests)
**Why it matters:** The room filter is load-bearing for one thing the database
cannot refuse: a room on standby is hidden from customers but has no
commitment, so only isRoomFree keeps it out of `choices`. The only room test,
"a room taken only during the buffer after is not chosen", cannot fail when
the filter goes: Room 3's time off makes `commitment_no_overlap` refuse the
hold and decision 5 moves to Room 4, the same answer. A scratch Vitest run
outside the repo with `is-room-free.ts` mocked to always answer true: that
scenario still gave Room 4 (passed), and a massage with Room 3 on standby
that Monday booked the customer into Room 3 (with the real code, Room 4).
Decision 11's other half, "the room must be free, standby ignored" for the
owner, is also untested (a scratch run shows the code books the owner into a
standby room, as decided). The buffer before is never non-zero in any
bookTime test, so the hold's span start is not pinned either.
**Suggested fix:** Add saved tests: a room service with one room on standby
that date, booked by a customer, takes the other room (and answers
`time_taken` when every room is on standby); the same by the owner takes the
standby room. Give one service a buffer before and assert the held
commitment starts that much earlier. Then close F-64.
**Resolution:** Fixed 2026-10-02: book-time.test.ts proves a room on standby that date is not chosen for a customer (fails with the room rule bypassed in bookTime) and that the owner may use it, and that a buffer before is held too (8:45 to 10:30 for a 9:00 facial with 15 before and 15 after). Closed 2026-10-02 by independent review of step 5d.4 (7166169..ceb511c): the standby and buffer-before tests are in book-time.test.ts (:418, :443) and pass at ceb511c; with isRoomFree bypassed by a scratch mock the standby test fails.

### F-80 [P3] closed - "Any available" with every calendar unreadable answers time_taken, which decision 12's message makes untrue

**File:** backend/lib/booking/book-time.ts:201-203
**Found:** 2026-10-02 by independent review of step 5d.3 (scope: 4b04e58..285b930; lenses: quality)
**Why it matters:** A picked person whose calendar cannot be read answers
`unavailable` (line 201), but with "any available" each unreadable person is
dropped and, when nobody is left, line 203 answers `time_taken`. Scratch
probe on a throwaway clinic with Ana and Mei both `needs_reconnect`:
`{"booked":false,"reason":"time_taken"}`. 5d.5 turns that into "Sorry, that
time was taken while you were booking", which is false: nothing was taken,
Google could not be read. Decision 9 already rules this out for the times
route (every calendar unreadable is 503, not an empty week); the booking
does the opposite for the same state. A one-person business (Primo's shape)
on "any available" during a Google outage that starts after the list loaded
hits this exactly. The owner path does the same.
**Suggested fix:** When no candidate is free and at least one was
`unreadable`, answer `unavailable` (decision 9's rule, applied at booking
time), and add the test beside "an unreadable picked calendar answers
unavailable".
**Resolution:** Fixed 2026-10-02: with nobody free and a calendar that could not be read, bookTime answers unavailable, never time_taken; tested with every practitioner's connection needing reconnection (fails if answered as taken). Closed 2026-10-02 by independent review of step 5d.4 (7166169..ceb511c): book-time.ts:220 answers unavailable when nobody is free and a calendar was unreadable; "any available with every calendar unreadable answers unavailable, not taken" (book-time.test.ts:457) passes.

### F-81 [P3] closed - A request key already booked answers that booking even when the service, time, person and customer differ

**File:** backend/lib/booking/book-time.ts:133-136 and :329-332
**Found:** 2026-10-02 by independent review of step 5d.3 (scope: 4b04e58..285b930; lenses: quality)
**Why it matters:** `findBookedByRequestKey` matches on the key alone. Scratch
probe: a facial at 9:00 for Jane booked with key K, then a second request
with K for a massage at 11:00 for another name and email answered
`{ booked: true, alreadyBooked: true }` with the facial at 9:00. Decision 7
covers a resend of the same form, but nothing says the resend is the same
request. A widget that keeps one key while the customer, already booked,
changes the time or books a second child from the same open form would show
a confirmation for something that was never booked (the 201 carries the
real times, so only a careful widget notices). The usual idempotency-key
convention (Stripe, the IETF Idempotency-Key draft) refuses a reused key
whose request differs. No data leaks: the answer has no customer details.
**Suggested fix:** Either compare `bookingLinkId`, `startsAt` and a picked
`personId` with the stored booking and answer a refusal when they differ
(a 409/422 at 5d.5), or write in decision 7 that a key lives only until its
form books once and feature 9 must make a fresh key after every booking.
Add the test either way.
**Resolution:** Fixed 2026-10-02: a request key already booked answers that booking only for the same service and start (and the same person when one was picked); otherwise request_key_used, which 5d.5 turns into a 409 asking to reload. Tested with a different time, person and service (fails if any reuse returns the old booking). Closed 2026-10-02 by independent review of step 5d.4 (7166169..ceb511c): isSameRequest (book-time.ts:77-80) guards both the first lookup and the clash path (:149, :331); "a form already used for another booking is refused" (book-time.test.ts:479) passes.

### F-82 [P3] closed - An owner-made booking may start at any instant, the past included, and the spec does not say whether it should

**File:** backend/lib/booking/book-time.ts:164-198 (spec: blueprint/context/current-feature.md, decision 11)
**Found:** 2026-10-02 by independent review of step 5d.3 (scope: 4b04e58..285b930; lenses: quality)
**Why it matters:** Decision 11 lifts notice and the horizon for the owner,
and the owner path checks only busy time, so nothing bounds the start.
Scratch probe: `source: "manual"` for Mei at 2020-01-01 09:00 Edmonton
answered `booked: true`. Recording a walk-in after the fact may be wanted,
but 5d.4 will write a Google event for it and features 6 and 8 will send a
confirmation and a reminder for a booking years in the past, and a typo'd
year (2062) would sit in a worker's calendar. The decision is Frank's; the
code made it silently.
**Suggested fix:** Decide in decision 11 (with the owner's route, feature 11
or 12b, at the latest): either the owner may book the past (and later
features skip messages for it), or bookTime refuses a start before `now`
(and, perhaps, beyond some outer limit). Add the test for whichever.
**Resolution:** Fixed 2026-10-02 with Frank's answer (option B, decision 13): an owner-made booking may start any time from the start of today in the business's zone; an earlier day answers in_the_past. Tested with a walk-in begun at 10:00 entered at 10:10 (booked), yesterday and 2020 (refused), and just after local midnight (booked); the test fails both with no limit and with "only from now on". Closed 2026-10-02 by independent review of step 5d.4 (7166169..ceb511c): book-time.ts:175 answers in_the_past for an owner start on an earlier local day; "an owner-made booking may start earlier today, never on an earlier day" (book-time.test.ts:553) passes.

### F-83 [P3] closed - The try order is built by calling chooseAnyAvailable in loops with a stand-in person, and the choice type is declared twice

**File:** backend/lib/booking/book-time.ts:244-263 (and hold-first-free-choice.ts:8, choose-any-available.ts:7)
**Found:** 2026-10-02 by independent review of step 5d.3 (scope: 4b04e58..285b930; lenses: quality)
**Why it matters:** To sort people and rooms by decision 2's order without a
second copy of the rule, bookTime picks one with `chooseAnyAvailable`,
removes it and asks again, and for rooms passes a made-up person
(`{ resourceId: people[0], name: "", bookingsThatDay: 0 }`) so the function
will answer a room. It is correct but takes a careful read to see that it is
only a sort. `BookingChoiceType` (`{ personId; placeId: string | null }`)
is the same shape as the existing `AnyAvailableChoiceType`. Comments also
cite feature and step numbers ("5c's free times", "as 5c reads them",
book-time.ts:4, :37, :164, :200), which coding-standards.md lists as history
(older files do the same).
**Suggested fix:** Export the ordering from choose-any-available.ts (for
example `orderAnyAvailable(people, rooms)` answering every choice in order,
with `chooseAnyAvailable` its first element) and use it in bookTime; reuse
`AnyAvailableChoiceType` in holdFirstFreeChoice; say "the free times" instead
of "5c's".
**Resolution:** Fixed 2026-10-02: the order lives in one place, backend/lib/scheduling/order-any-available.ts (orderAnyAvailable, with its own tests); chooseAnyAvailable is its first choice and bookTime uses the whole order, so no made-up person and no loop. BookingChoiceType is gone in favour of AnyAvailableChoiceType. Comments no longer name 5c. Closed 2026-10-02 by independent review of step 5d.4 (7166169..ceb511c): order-any-available.ts holds the order and AnyAvailableChoiceType, chooseAnyAvailable returns its first element, hold-first-free-choice.ts uses AnyAvailableChoiceType, BookingChoiceType is gone, and no comment in backend/lib/booking names 5c.

### F-84 [P3] closed - Writing a booking's event twice makes a second Google event and forgets the first, and a cancelled booking is written too

**File:** backend/lib/calendar/write-booking-event.ts:64-76 (and google-calendar-provider.ts:64)
**Found:** 2026-10-02 by independent review of step 5d.4 (scope: 7166169..ceb511c; lenses: all)
**Why it matters:** `writeBookingEvent` checks neither `calendarEventId` nor
`status`, and Google's events.insert is not idempotent. Scratch probe on a
throwaway clinic with Google faked: calling it again for a booking already
holding `evt-1` posted a second event and replaced the id with `evt-3`, so the
first event stays in the worker's calendar with nothing pointing at it, and
feature 7's cancel can never remove it. A booking set to `cancelled` was
still written (`evt-4`). Today bookTime calls it once per new booking, so
nothing double-writes yet. Feature 8's retry (decision 6) will, and the
ten-second limit makes the bad case ordinary: Google can create the event and
the answer time out (or the `calendarEventId` update fail), leaving the id
empty for a booking whose event exists, which the retry then writes again. A
worker could turn up for a cancelled job because its twin was never removed.
**Suggested fix:** Send a client-chosen event `id` derived from the booking id
(Google accepts base32hex, a-v and 0-9, 5 to 1024 characters; the UUID without
its hyphens qualifies), so a second insert answers 409 and is treated as
already written; and have writeBookingEvent skip a booking that is cancelled
or already has `calendarEventId` (or settle both in feature 8's spec). Add a
test that writes twice and sees one event.
**Resolution:** Fixed 2026-10-02: the event's id is the booking's without dashes (Google's a-v0-9 rule), so Google keeps one event; a 409 for that id is taken as the event already made; a booking already written answers its saved id without asking Google, and a cancelled one is not written. Tests: writing again makes no second call, a 409 saves the id, a cancelled booking gets no event; each fails with its guard removed. Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): write-booking-event.ts:60-66 skips a cancelled or already written booking and sends the dashless booking id; google-calendar-provider.ts treats 409 as the event already made. In scratch runs each guard removed (the saved-id return, the status check, the 409 branch) fails its own test in write-booking-event.test.ts. No new defect.

### F-85 [P3] closed - A returning customer's phone typed on this booking never reaches the event

**File:** backend/lib/calendar/write-booking-event.ts:24-26 and :61 (cause: backend/lib/crm/find-or-create-contact.ts:70)
**Found:** 2026-10-02 by independent review of step 5d.4 (scope: 7166169..ceb511c; lenses: quality)
**Why it matters:** Decision 14 puts "Phone: ..." in the description when
given. The event reads the phone from `contact`, and a known email keeps "the
name and phone first given". Scratch probe: Jane booked one Monday with email
only, then the next Monday with the same email and phone 403 555 0199; the
second event's description was exactly `Email: ...`, no phone line, and the
phone is stored nowhere (the lead keeps only `details`). A painter sent to a
returning customer gets no phone, or the old one if it changed; the title
likewise carries the first name ever given.
**Suggested fix:** Frank's call. Either fill a known contact's empty phone
(or replace it) in findOrCreateContact, or keep this booking's phone on the
lead or booking and use it for the event; or write in decision 14 that the
contact's stored details are what the event shows. Add the test either way.
**Resolution:** Fixed 2026-10-02 with Frank's answer (option A, decision 15): lead.phone (migration 0015) keeps the phone given with each request and the event shows it; findOrCreateContact fills a known contact's phone only when it had none. Tests: a returning customer's new phone reaches this booking's event (fails when the event reads the contact's phone), and a known contact is filled once, never replaced (fails when the empty-phone guard is removed). Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): lead.phone (0015) is written by bookTime (book-time.ts:282) and preferred by the event (write-booking-event.ts:72); findOrCreateContact fills a phone only where it is null. Reading the contact's phone first fails "a returning customer's new phone reaches this booking's event", and dropping the null guard fails two find-or-create-contact tests (scratch runs). No new defect.

### F-86 [P3] closed - Two Done-when items cannot fail: the refresh test passes when writeBookingEvent never refreshes, and "each only when given" is never tested

**File:** backend/lib/calendar/write-booking-event.test.ts:249 and :160
**Found:** 2026-10-02 by independent review of step 5d.4 (scope: 7166169..ceb511c; lenses: tests)
**Why it matters:** In "an expired token is refreshed through the one shared
helper", bookTime's own check reads the busy times first, and getBusyTimes
renews the 30-second token (call order in a probe: token, freeBusy, events),
so writeBookingEvent finds a fresh token already stored. A scratch Vitest run
with writeBookingEvent's `getFreshAccessToken` replaced by a plain read of the
stored token (no renewal at all) passed every assertion of that test (one
token call, `Bearer ya29.fresh-access`). The content test has phone, email and
details all present, so removing the "only when given" filtering
(write-booking-event.ts:61-66) fails nothing, though that rule is the whole of
decision 14's description. Also, reconnection and the timeout are tested by
calling writeBookingEvent directly, so "keeps the booking and logs one line"
is shown through bookTime only for the Google error.
**Suggested fix:** Test the renewal by calling writeBookingEvent directly for
a booking made before connecting, with under a minute left on the token,
asserting the token call and the Bearer sent to the event; add content cases
with no phone and no details (`Email: ...` only) and with phone only.
**Resolution:** Fixed 2026-10-02: the refresh test now books before connecting and writes the event directly, so only the event write can renew the key (fails when the expired key is used anyway); a new test books with no phone and no note and checks the description is the email line alone (fails when missing lines are kept). Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): with renewal skipped in get-fresh-access-token.ts, "an expired token is refreshed through the one shared helper" fails; with every line kept regardless of what was given, "a phone, an email or a note left out leaves its line out" fails (scratch runs).

### F-87 [P3] closed - The token helper's comment describes a condition no longer written that way, and two header comments were left unwrapped

**File:** backend/lib/calendar/get-fresh-access-token.ts:65 (also backend/lib/booking/book-time.ts:4, backend/lib/calendar/calendar-provider.ts:2)
**Found:** 2026-10-02 by independent review of step 5d.4 (scope: 7166169..ceb511c; lenses: quality)
**Why it matters:** "Written as 'not comfortably valid', so an unreadable date
refreshes too" explained the old `!(expiresAt - Date.now() > margin)`; the
condition is now the opposite test with an early return. Behaviour is
unchanged (NaN compares false, so an unreadable date still falls through to
the renewal; compared line by line with get-busy-times.ts at 7166169, the race
rules, the `needs_reconnect` marking and both `continue`s are identical), but
the comment now names a form that is not there, on the one subtlety a reader
must not "simplify" away. book-time.ts:4 (149 characters) and
calendar-provider.ts:2 (129) had words inserted into wrapped headers without
rewrapping (Prettier leaves comments alone), and the new import in
book-time.ts:17 sits out of order.
**Suggested fix:** Say what the line does now ("only a key comfortably valid
is used as it is; an unreadable date fails this test and is renewed"),
rewrap the two headers, sort the import.
**Resolution:** Fixed 2026-10-02: the comment in get-fresh-access-token.ts now matches its condition; the two long header comments are rewrapped under 100 characters; book-time.ts's calendar imports are in order. Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): get-fresh-access-token.ts:156-157 now describes the condition as written (a comfortably valid key is used, anything else, an unreadable date too, is renewed); the two headers are under 100 characters and the imports are in order.

### F-88 [P3] closed - The POST preflight test passes even when the browser would be refused the JSON header every booking sends

**File:** backend/routes/public-bookings-routes.test.ts:322
**Found:** 2026-10-02 by independent review of step 5d.5 (scope: 6906956..2663680; lenses: tests)
**Why it matters:** The widget posts `Content-Type: application/json`, which
makes the browser send a preflight and book only if the answer allows that
header. Today Hono's cors reflects the requested headers because
`publicCorsMiddleware` sets no `allowHeaders`, so it works. The test sends
`Access-Control-Request-Headers: content-type` but never checks
`Access-Control-Allow-Headers`: with `allowHeaders: ["x-nothing"]` added to
public-cors-middleware.ts in a scratch run, all 17 tests in the file still
passed, while every real browser booking would be blocked. The Done when's
"a preflight allows POST" is the one browser-facing promise of this step.
**Suggested fix:** Assert that `Access-Control-Allow-Headers` includes
`content-type` (case-insensitive) in the same test.
**Resolution:** Fixed in 5d.5's review fixes (5ac0594): the preflight test now also asserts Access-Control-Allow-Headers includes content-type. Proved able to fail: with allowHeaders ["x-nothing"] in publicCorsMiddleware the test fails. Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): the preflight test asserts Access-Control-Allow-Headers contains content-type; with allowHeaders ["x-nothing"] in publicCorsMiddleware in a scratch run it fails.

### F-89 [P3] closed - CreateBookingInputType is exported and used nowhere; the typed client already carries the body type

**File:** packages/shared/zod-validation/booking-links-validation-schemas/create-booking-validation-schema.ts:30
**Found:** 2026-10-02 by independent review of step 5d.5 (scope: 6906956..2663680; lenses: quality)
**Why it matters:** No file in backend or frontend imports it. The widget
(feature 9) calls the route through `hc<AppType>`, which takes the body type
from `validator("json")`, so this second declaration of the same shape is
not needed by the planned consumer either. The other booking-link schemas
export no input type. "What breaks if we do not add this?" has no answer yet.
**Suggested fix:** Remove the export; add it back if a consumer appears that
the typed client does not serve.
**Resolution:** Fixed in 5d.5's review fixes (5ac0594): the unused CreateBookingInputType export is removed; the typed client takes the body type from the validator. Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): create-booking-validation-schema.ts exports only the schema; nothing imports a booking input type.

### F-90 [P3] closed - The public CORS header comment had a sentence inserted without rewrapping (139 characters)

**File:** backend/middleware/public-middleware/public-cors-middleware.ts:2
**Found:** 2026-10-02 by independent review of step 5d.5 (scope: 6906956..2663680; lenses: quality)
**Why it matters:** Prettier leaves comments alone, so `format:check` passes,
but the header now runs to 139 characters against the 100 every other line
keeps. Same pattern as F-87 (words added to a wrapped header in step 5d.4),
so it is drift rather than a one-off.
**Suggested fix:** Rewrap the three header lines under 100 characters.
**Resolution:** Fixed in 5d.5's review fixes (5ac0594): the header comment is rewrapped under 100 characters. Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): the header comment of public-cors-middleware.ts is three lines under 100 characters.

### F-91 [P3] closed - The step's Done when says the route tests run on clinic-dev; they run on a clinic of their own

**File:** blueprint/context/current-feature.md:309
**Found:** 2026-10-02 by independent review of step 5d.5 (scope: 6906956..2663680; lenses: tests)
**Why it matters:** public-bookings-routes.test.ts builds and removes its own
clinic, so a failed run never leaves bookings in the seeded one (its header
says why), and uses clinic-dev only for "another business's service". That
is the better choice and matches the spec's Testing section, but the Done
when still names clinic-dev, so the spec and the tests disagree on what was
proved and where.
**Suggested fix:** Change the Done when to "route tests on a clinic of their
own (and clinic-dev for another business's service)".
**Resolution:** Fixed in 5d.5's review fixes (5ac0594): the Done when now says the route tests run on a clinic of their own, removed after, and why. Closed 2026-10-02 by the final independent review of feature 5d (12a21d6..aa237da): current-feature.md 5d.5's Done when names a clinic of their own, removed after, matching public-bookings-routes.test.ts.

### F-92 [P2] fixed - A resent form whose check runs after its first copy committed answers time_taken, though the customer is booked

**File:** backend/lib/booking/book-time.ts:220-223 (also :248 and :332; the key is read only at :150-154)
**Found:** 2026-10-02 by the final independent review of feature 5d (scope: 12a21d6..aa237da; lenses: quality, security, performance, tests)
**Why it matters:** Decision 7 promises that the same form sent twice gets one
booking and both copies answer it. bookTime reads the request key once, before
the check, and consults it again only when its own booking insert clashes on
`booking_request_key_unique`. When the second copy reads the key before the
first commits but runs its check after (a press repeated after a slow or lost
answer, arriving while the first is still being written), the check sees the
first copy's own commitment and answers `time_taken` (picked person, line 223),
`unavailable` (line 220 or 223) or `time_taken` for the rooms (line 248),
without ever reaching the insert. Shown in a scratch Vitest run (since removed)
that held the second copy's check until the first copy had booked: the first
answered booked, the second `{ booked: false, reason: "time_taken" }` for the
same key, service, person and start. The customer reads "Sorry, that time was
taken while you were booking" for a booking that exists; picking another time
on the same form then gets `request_key_used`, and after a reload they book a
second time, so the business holds two bookings for one job. The saved test
for two copies at the same instant uses "any available" with two free people,
so the second copy always finds someone free and reaches the insert; a picked
person, a one-person business (Primo's shape) or a room service is never tested.
**Suggested fix:** Before answering `time_taken` or `unavailable` (lines 220,
223, 248 and the `EveryChoiceTakenError` branch at 332) when a `requestKey` was
sent, read `findBookedByRequestKey` again and answer that booking (or
`request_key_used`) through `isSameRequest`, as the clash path already does. Add
a test with a picked person whose check runs after the first copy commits.
**Resolution:** Fixed after the final review: bookTime asks the form's key again before every refusal (the picked person unreadable or busy, nobody free, no free room, every choice taken), through one helper used by the first lookup and the clash path too, so a copy whose check ran after its first copy was saved answers that booking. Test: book-time-resent-while-saving.test.ts holds the second copy's check until the first has booked, with one painter; it fails without the fix (time_taken) and passes with it.

### F-93 [P3] fixed - The customer's answer waits for Google's event write, up to 10 seconds (20 with a key renewal), after the booking is already saved

**File:** backend/lib/booking/book-time.ts:319-325 (limits: backend/lib/calendar/google-calendar-provider.ts:15, backend/lib/calendar/google-oauth-client.ts:13)
**Found:** 2026-10-02 by the final independent review of feature 5d (scope: 12a21d6..aa237da; lenses: quality, security, performance, tests)
**Why it matters:** bookTime awaits `writeBookingEvent` before returning, and
the public route answers only then. The answer does not depend on the event
(decision 6 keeps the booking whatever Google does), but when Google is slow,
which is exactly the case decision 6 is about, a customer whose booking was
saved in milliseconds watches the Book button spin for up to 10 seconds, or 20
when the key is renewed first. A widget or browser that gives up sooner shows a
failure for a booking that exists. The coding standards say long running work
does not belong in a request handler; the spec only says the write happens
after the commit, so the wait is a side effect nobody decided.
**Suggested fix:** Frank's call. Either answer first and let the write finish
on its own (not awaited, its catch and warning line kept) until feature 8's job
runner owns it, or write in decision 6 that the customer's answer waits for
Google until then.
**Resolution:** Frank's answer, option A (2026-10-02, written into decision 6): bookTime starts the event write once the booking is saved and does not await it (`bookingEventWrites.start` in backend/lib/booking/booking-event-writes.ts, which keeps the catch and the one warning line and lets tests await the writes still running). Test: "the customer's answer does not wait for Google" holds Google's answer and gets the booking first; with the wait put back it times out.
