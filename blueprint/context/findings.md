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

### F-94 [P3] open - chooseAnyAvailable has no caller outside its own test, while the spec still says the booking's order comes from it

**File:** backend/lib/scheduling/choose-any-available.ts:11 (spec: blueprint/context/current-feature.md:255 and :434)
**Found:** 2026-10-02 by the second final independent review of feature 5d (scope: 12a21d6..3cec4ae; lenses: quality, security, performance, tests)
**Why it matters:** bookTime takes the whole try order from
`orderAnyAvailable` (book-time.ts:276), so `chooseAnyAvailable`, built in 5c
for this booking, is now called only by choose-any-available.test.ts. Its
header still says it decides who gets an "any available" booking, and the
spec's 5d.3 bullet and Notes for the AI still name it as the function the
booking reuses. A reader following the spec opens a function nothing in the
app runs, and the two files keep one rule behind two entry points that can
drift.
**Suggested fix:** Either delete choose-any-available.ts and move its useful
cases into order-any-available.test.ts, or keep it and say why; and change the
two spec lines to name `orderAnyAvailable`.
**Resolution:**

### F-95 [P3] open - When the no-wait test fails, its cleanup hangs on the held Google answer and leaves its business in the dev database

**File:** backend/lib/calendar/write-booking-event.test.ts:191-219 (cleanup: :166-170)
**Found:** 2026-10-02 by the second final independent review of feature 5d (scope: 12a21d6..3cec4ae; lenses: quality, security, performance, tests)
**Why it matters:** The test releases Google's held answer only after its
first assertion. If bookTime ever waits for Google again (the regression it
guards), the test times out before `answerGoogle()` runs, the background
write never settles, and `afterAll` hangs on `bookingEventWrites.settled()`
until the hook times out, so the delete never runs. Reproduced in this review
by putting the wait back: the run reported the failure, then the throwaway
business `test-event-no-wait-<tag>` stayed in `scheduleads_dev` with its
booking. The file's header promises every business is removed after, and the
seed and the other files rely on that.
**Suggested fix:** Release Google in a `finally` around the test body (or in
`afterEach`), so a failure still lets the write settle and the cleanup run.
**Resolution:**

### F-116 [P3] open - Finding numbers in three code comments added by this feature

**File:** backend/lib/auth/auth-server.ts:157; backend/lib/auth/login-code-timing.test.ts:2; backend/lib/auth/send-login-code.test.ts:37
**Found:** 2026-10-03 by independent review of feature 6 (scope: 7dc0721..8858d37; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md (Comments) rules out history in code
comments, finding numbers named; F-112 and F-115 were the same slip and were
fixed. Three comments written for the F-97 and F-98 repairs still end in
"(F-97)" or "(F-98)". After `/complete` archives the ledger these become
`6/F-97`, so the bare numbers in the code point at nothing a later reader can
find. The comments' reasons are already said in words around them.
**Suggested fix:** Drop the three parenthesised numbers and keep the
sentences as they are.
**Resolution:**

### F-128 [P3] unverified - No real calendar has been shown to remove the event from the cancelling invite

**File:** backend/lib/email/booking-ics.ts:28-43, backend/lib/email/send-cancellation-emails.ts:62-79
**Found:** 2026-10-03 by independent review of step 7a.4 (scope: bea19bc..dfa2d60; lenses: quality, security, performance, tests)
**Why it matters:** Decision 8 promises Jane's calendar removes the event.
The file itself is RFC 5546 CANCEL-shaped (METHOD:CANCEL, the same UID,
SEQUENCE 1 above the request's 0, ORGANIZER, ATTENDEE, a stable DTSTAMP,
STATUS:CANCELLED, the content type's method matching), and the From
address equals ORGANIZER, which Outlook needs. What is not shown is the
real behaviour: it rides as an `invite.ics` attachment, as feature 6's
request does, and whether Gmail, Outlook and Apple Mail act on a CANCEL
delivered that way, rather than offering a file to open, has not been
checked. Also, ORGANIZER is the sender address read at cancel time: a
business that changed its sender address between the booking and the
cancel sends a CANCEL from a different organizer than the request's,
which some clients ignore. The Done when does not ask for this check.
**Suggested fix:** During 7a.5's by-hand session (Frank's call, since it
sends a real email), book and cancel against a dev business whose
notification and customer addresses are Frank's own Gmail and an Outlook
address, and record in the log whether the event disappears. If the
sender-change case matters, store the organizer used on the request.
**Resolution:**

### F-134 [P3] open - The cancel test that checks log lines for the customer's details reads them before any are written

**File:** backend/lib/booking/cancel-booking.test.ts:299-311
**Found:** 2026-10-03 by /audit independent (scope: current, 32114fc..14772a1; lens: tests)
**Why it matters:** The test "nothing in the timeline entry or a log line
carries the customer's details" collects console lines, awaits
`cancelBooking`, and builds `everything` from `lines.join` straight away
(:307). Every line a cancel can write comes from the work it starts
without waiting (the Google removal and the cancellation emails, which
need a database round trip first), so none has been written when the
lines are read, and the log half of the test passes whatever those lines
say. The same lines are checked in their own files
(remove-booking-event.test.ts:236-239, send-cancellation-emails.test.ts:320-326),
so nothing is unguarded today; the risk is a test whose name promises
more than it proves.
**Suggested fix:** Await `bookingEventRemovals.settled()` and
`bookingCancellationEmails.settled()` before reading `lines`, or drop
"a log line" from the test's name and leave the log checks to the two
files that already make them.
**Resolution:**

### F-135 [P3] closed - The Google tests for a move depend on running in order and never pin the cross-off to the booking's own person

**File:** backend/routes/public-booking-move-times-routes.test.ts:206-245 (cross-off: backend/lib/scheduling/find-free-times.ts:135)
**Found:** 2026-10-03 by independent review of step 7b.1 (scope: a55c8ee..548c727; lenses: quality, security, performance, tests)
**Why it matters:** "the booking's own Google event does not block" (:238)
relies on Ana's calendar connection saved inside the test before it. Run
alone (`vitest -t "own Google event"`) Ana has no connection, Google is
never asked, and the test passes even with the cross-off switched off:
reproduced in this review. In the full file it does catch that break.
Separately, decision 11 crosses off the booking's span for its current
person only; changing the guard at :135 to cross it off for every person
(`if (ignoreBooking)`) left all 9 tests green, because only Ana has a
connected calendar. Another person's own Google event at the same time as
Jane's booking would then be hidden, and nothing would say so.
**Suggested fix:** Give the Google cases their own setup (connect Ana in a
`beforeAll` of a nested `describe`, or in each test), and add a case where
Mei is connected too and Google answers the same 9:00 to 10:00 for both:
Ana's 9:00 is offered, Mei's is not.
**Resolution:** Fixed 2026-10-03: each Google test saves its own connection (saving again only updates), so each passes or fails alone; a new test, "the booking's own hour is crossed off only for its own person", connects Ana and Mei with the same 9:00 to 10:00 and expects Mei's 9:00 and 9:30 to stay busy. Removing the cross-off fails the own-event test run alone; crossing off for every person fails the new test. Closed 2026-10-03 by independent review of step 7b.2: re-read find-free-times.ts:138 and the test file; the cross-off switched off fails "the booking's own Google event does not block" run alone, and `if (ignoreBooking)` fails "crossed off only for its own person", both reproduced and restored.

### F-136 [P3] closed - No test asks a booking's move times for a person who does not offer its service

**File:** backend/routes/public-booking-move-times-routes.test.ts:247-258 (answer: backend/lib/booking/find-booking-move-times.ts:57)
**Found:** 2026-10-03 by independent review of step 7b.1 (scope: a55c8ee..548c727; lenses: quality, security, performance, tests)
**Why it matters:** The step's plan promises 404 for a person who does not
offer the service, and the contract says an unknown `person` answers 404
`not_found`. That is also the answer that keeps another business's person
out (findFreeTimes checks `person` against the service's own people, inside
the booking's business). The behaviour is right today, but changing :57 to
answer an empty 200 when findFreeTimes gives null left every test green in
this review. The tenant check itself is tested only on the booking form's
route, not on this one.
**Suggested fix:** Add one case: Jane's link with `person=` a resource id of
another test business, and one with the clinic's Room 3 id, each answering
404 with the same body as a bad link.
**Resolution:** Fixed 2026-10-03: a new test asks for Room 3 (a place, not a person who can be picked) and for an unknown id, both answering the same 404; answering 200 with no times instead fails it. Closed 2026-10-03 by independent review of step 7b.2: re-read find-booking-move-times.ts:57 and the test; answering an empty 200 for a null fails "a person who does not offer the service, or another business's, answers 404", reproduced and restored.

### F-137 [P3] open - The reserved slug is refused only when a business is made; an owner can still take it through Better Auth's organization update

**File:** packages/shared/zod-validation/organization-validation-schemas/business-name-validation-schema.ts:14-19 (update rights: backend/lib/auth/auth-server.ts:65,71)
**Found:** 2026-10-03 by independent review of step 7b.1 (scope: a55c8ee..548c727; lenses: quality, security, performance, tests)
**Why it matters:** The spec says no business can sit where these routes
do. The refine closes POST /admin/clients, the only creation path
(`allowUserToCreateOrganization: false`). But the owner and admin roles
hold `organization: ["update"]`, and Better Auth 1.7.5's
`POST /api/auth/organization/update` takes `data.slug`, checks only that no
other business has it, and runs no `beforeUpdateOrganization` hook here.
So a signed-in owner can set their slug to `bookings` (or to any string,
which would also break the address their widget is embedded under). No
route collides today even then: Hono answers the first match, the slug
routes are mounted first, and a valid token is never `booking-links`. So
this is a guard with a side door, not a live break. No seed or test
business uses the slug (painting-dev, clinic-dev, test-...-dev).
**Suggested fix:** Add a `beforeUpdateOrganization` hook that refuses any
change to `slug` (the slug is built from the name, never typed, per
to-slug.ts), or drop `organization: ["update"]` from the roles until a
settings screen needs it.
**Resolution:** Deferred by Frank, 2026-10-03: left for Settings (feature 12), where editing a business's details is designed; no screen reaches the route today. Stays open, carried forward.

### F-138 [P3] fixed - A booking whose service was switched off opens its page, but its move times answer "This link does not open a booking"

**File:** backend/lib/booking/find-booking-move-times.ts:15,57 (page: backend/lib/booking/find-booking-page.ts:86)
**Found:** 2026-10-03 by independent review of step 7b.1 (scope: a55c8ee..548c727; lenses: quality, security, performance, tests)
**Why it matters:** findFreeTimes returns null for an inactive service, and
the times route turns that into the bad-link 404. findBookingPage does not
look at `bookingLink.active`, so Jane's page still opens, and 7b.2 plans
`canMove` as the same as `canCancel`. When the business switches a service
off with bookings still ahead, the page will offer "Change the time" and
the times call will tell her the link opens no booking, which is false.
No test or spec line covers the case.
**Suggested fix:** Decide in 7b.2's plan whether a switched-off service can
still be moved. If not, make `canMove` false for it and let the page say
to call the business; if so, read the service without the `active` filter
for a move.
**Resolution:** Decided by Frank, 2026-10-03 (decision 13): switching a service off stops only new bookings; an existing booking keeps Change the time. Fixed by step 7b.2, which reads the booking's own service even when switched off. Built in 7b.2 (1731845): findServiceResources and findFreeTimes read the booking's own service when switched off; tested by "a booking whose service was switched off can still move, while new bookings cannot".

### F-139 [P3] closed - The spec names `ignoreBookingId` and "the day's booking counts"; the code has `ignoreBooking` and no such counts

**File:** blueprint/context/current-feature.md:117-120,144,234
**Found:** 2026-10-03 by independent review of step 7b.1 (scope: a55c8ee..548c727; lenses: quality, security, performance, tests)
**Why it matters:** The built input is `ignoreBooking: { id, personId,
startsAt, endsAt }` (find-free-times.ts:39), because the Google cross-off
needs the person and the span. The spec's 7b.1 bullet, 7b.2's plan (which
will call it) and Files still say `ignoreBookingId`, and 7b.1 promises the
booking is left out of "the day's booking counts", which findFreeTimes
does not have. AGENTS.md asks for a wrong spec to be corrected before the
next step builds on it.
**Suggested fix:** Change the three lines to `ignoreBooking` and drop the
booking-counts clause.
**Resolution:** Fixed 2026-10-03: the spec says ignoreBooking with its four fields and crossOffSpan, drops the daily counts from 7b.1, and notes that 7b.2's any-available order must leave the moved booking out of the day's counts. Closed 2026-10-03 by independent review of step 7b.2: re-read current-feature.md; 7b.1's bullet names `ignoreBooking` with its four fields and `crossOffSpan`, no booking counts remain in 7b.1, and the Notes for the AI carry the 7b.2 counts rule.

### F-140 [P2] fixed - A hold that fails inside the move's transaction is never tested; committing the release with no new hold leaves every test green

**File:** backend/lib/booking/move-booking.ts:221 (test: backend/routes/public-booking-move-routes.test.ts:254)
**Found:** 2026-10-03 by independent review of step 7b.2 (scope: 7059d79..1731845; lenses: quality, security, performance, tests)
**Why it matters:** The step's central promise is "a time taken meanwhile
leaves her booking as it was" (decision 10): inside the transaction the old
rows are released first, so only the thrown `EveryChoiceTakenError` rolls
that release back when the new hold fails. The test named "a time taken
meanwhile" books 13:00 before the move starts, so the free-times check
outside the transaction refuses it and the transaction never runs.
Replacing :221 with `return { moved: false, reason: "time_taken" } as const`
(which commits the release and leaves a confirmed booking holding no time,
so its slot can be booked twice) left all 529 backend tests green in this
review. The code is right today; nothing guards it.
**Suggested fix:** Add a test in the shape of
book-time-taken-meanwhile.test.ts: mock `findCommitments` (or
`findFreeTimes`) so the check sees the new time free while the database
already holds it for another booking, then assert 409 `time_taken`, the
booking's times, person and sequence unchanged, its old row still
`active`, and no `booking_moved` entry.
**Resolution:** Fixed 2026-10-03: move-booking-taken-meanwhile.test.ts shows the check an empty world while the database holds the new time, so the hold fails inside the transaction; the booking, its released-then-restored row and the timeline stay untouched. Committing the release instead fails it.

### F-141 [P2] fixed - A move to another person leaves its Google event in the old person's calendar, and the booking keeps no record of whose calendar that is

**File:** backend/lib/booking/move-booking.ts:226 (cancel's removal: backend/lib/calendar/remove-booking-event.ts:21,28)
**Found:** 2026-10-03 by independent review of step 7b.2 (scope: 7059d79..1731845; lenses: quality, security, performance, tests)
**Why it matters:** The move overwrites `personId` and keeps
`calendarEventId`, which points at an event in the old person's Google.
7a's cancel removes the event from `row.personId`'s calendar, now the new
person's: Google answers 404, google-calendar-provider.ts:97 treats that as
gone, `calendarEventId` is cleared, and the old person's event stays at the
old time with no log line, still blocking that person's free times. On this
branch, a person-changing move followed by a cancel does exactly that.
7b.3 plans to remove the old person's event after the move, but it runs
after the transaction, not awaited, and may fail (decision 5); once it
has, the old person exists nowhere: not on the booking, and not in the
`booking_moved` payload (`{ bookingId, fromStartsAt, toStartsAt, sequence }`).
Feature 8's retry and 7a's cancel then cannot find the event.
**Suggested fix:** Settle it in 7b.3's plan, before building on it: keep
whose calendar holds the event (a `calendarPersonId` beside
`calendarEventId`, set when the event is written and cleared when it is
removed), and have removal and update use it rather than `personId`; or at
least add `fromPersonId` and `toPersonId` to the `booking_moved` payload
and the spec's contract.
**Resolution:** Carried to 7b.3's plan (spec, Notes for the AI): the event moves between calendars there and must know the old person. Fixed by step 7b.3: the move hands over who held the event; a person change removes it from that person's calendar and writes it into the new one under an id carrying the move's number, saved; the cancel removes by the saved id. Tested: "a cancel after a person change removes the event from the new person's calendar".

### F-142 [P3] fixed - No move test uses a room or moves with any available, so the room's own-row filter and the day's counts can be removed with every test green

**File:** backend/lib/booking/move-booking.ts:147,169 (tests: backend/routes/public-booking-move-routes.test.ts)
**Found:** 2026-10-03 by independent review of step 7b.2 (scope: 7059d79..1731845; lenses: quality, security, performance, tests)
**Why it matters:** The test clinic has no rooms, and the only any-available
press is one already at its time. Removing `row.bookingId !== bookingId`
from the room check (:147), which would refuse a Face and Body move 30
minutes later in the same room though the times route offers it, left the
12 move tests green; so did removing the filter that keeps the moved
booking out of the day's counts (:169), which the spec's Notes for the AI
call out for this step. Decision 10's any-available move (the order, the
person it lands on) is untested end to end.
**Suggested fix:** Give one test clinic a room ticked for the service and
move Jane 30 minutes later in it; add an any-available move to a new time
where the counts decide the person (Ana with Jane's booking and one other
that day, Mei with one), asserting Jane stays with Ana.
**Resolution:** Fixed 2026-10-03: tests for a move in a room (Room 3 held again at the new time), any available going to whoever is free, and any available not counting the booking being moved; counting the room's own rows or the day's own booking each fails one.

### F-143 [P3] fixed - The move route lacks the booking form's body limit and its refusal for a body that is not JSON

**File:** backend/routes/public-booking-page-routes.ts:78-87 (the form's: backend/routes/public-bookings-routes.ts:28-37)
**Found:** 2026-10-03 by independent review of step 7b.2 (scope: 7059d79..1731845; lenses: quality, security, performance, tests)
**Why it matters:** The booking form's POST caps the body (`bodyLimit`) and
turns Hono's malformed-JSON exception into the refusal shape. The move
route has neither, and its validator runs before the token is read, so
anyone can make it parse any size of body. Probed in this review through
the built app: `{not json` answers 400 `text/plain` "Malformed JSON in
request body" (not `{ error: { code, message } }`, which the page will read
in 7b.5), and a 5 MB body is parsed in full before the 400. Rate limits are
feature 9, but the size cap is this repo's own pattern for public POSTs.
**Suggested fix:** Mount the same `bodyLimit` and an `onError` that maps a
400 `HTTPException` to `refuse("bad_request", ...)` on
`publicBookingPageRoutes`, as `publicBookingsRoutes` does.
**Resolution:** Fixed 2026-10-03: the move route has the booking form's bodyLimit (1 KB, 413) and its onError refusal for a body that is not JSON (400 bad_request); tested.

### F-144 [P3] fixed - The spec's move contract says 400 `invalid_start` and no 503; the route answers 400 `bad_request` and 503 `unavailable`

**File:** blueprint/context/current-feature.md:280 (route: backend/routes/public-booking-page-routes.ts:84,104)
**Found:** 2026-10-03 by independent review of step 7b.2 (scope: 7059d79..1731845; lenses: quality, security, performance, tests)
**Why it matters:** Data / contracts lists the move's answers as 200, 400
`invalid_start`, 404, 409. The route answers `bad_request` for a bad body
(as every other route does) and also 503 `unavailable` when a calendar
cannot be read. 7b.5 builds the page's states from this contract, so a
page written to it would miss the 503 and look for a code that never
comes. AGENTS.md asks for a wrong spec to be corrected before the next step
builds on it.
**Suggested fix:** Change the contract line to 400 `bad_request` and add
503 `unavailable`.
**Resolution:** Fixed 2026-10-03: the spec's move contract says 400 bad_request, 413 and 503 unavailable, as the code answers.

### F-145 [P3] open - The move's check is a copy of bookTime's: the free check, the room rule, the day's counts and `namesOf`

**File:** backend/lib/booking/move-booking.ts:109-176,252-259 (original: backend/lib/booking/book-time.ts:119-126,196-277)
**Found:** 2026-10-03 by independent review of step 7b.2 (scope: 7059d79..1731845; lenses: quality, security, performance, tests)
**Why it matters:** About 70 lines repeat bookTime's customer path with two
`bookingId` filters added, and `namesOf` is copied verbatim. A later change
to how a start is checked or ordered (F-62's cost, the room rule, a new
any-available rule) has to be made in both files, and one being missed is
exactly the drift the spec's "changing the time is booking again"
(decision 10) forbids.
**Suggested fix:** Extract one function in `lib/booking/` that, given the
service, the start and an optional booking to leave out, answers the
ordered choices or the refusal; bookTime's customer path and moveBooking
both call it. Can wait for the owner's move (features 11 and 12b), which
will be a third caller.
**Resolution:** Partly fixed 2026-10-03: the name lookup is one shared helper (find-resource-names.ts) used by bookTime and moveBooking. The free check's copy stays, carried for when the owner's move (features 11 and 12b) gives a third caller; noted in the spec.

### F-146 [P3] fixed - Two move tests promise more than they check: "the log" spies only console.log, and "another business's booking" only sends a foreign person id

**File:** backend/routes/public-booking-move-routes.test.ts:306-330
**Found:** 2026-10-03 by independent review of step 7b.2 (scope: 7059d79..1731845; lenses: quality, security, performance, tests)
**Why it matters:** The move path writes no `console.log`; its only log
lines are `console.warn` (calendar), which `beforeAll` silences and no test
reads, so the log half of the privacy test passes whatever those lines say
(the same shape as F-134). "another business's booking is never touched"
is refused by the person check at move-booking.ts:93 before any write, so
it does not show that the writes stay inside the booking's business. Both
behaviours are right by reading; the names claim coverage the tests do not
give.
**Suggested fix:** Collect `console.warn` and `console.error` too (with a
connected calendar that fails, so a warn line is actually written), and
either rename the tenant test to what it checks or add a case that moves
one business's booking and asserts the other business's rows unchanged.
**Resolution:** Fixed 2026-10-03: the privacy test also reads console.warn and a refusal's body; the tenant test also makes a real move of ours to a time the other business has booked and checks their booking and rows are untouched.

### F-147 [P3] fixed - The activity types test is still named "the nine kinds" while it expects ten

**File:** packages/shared/crm/activity-types.test.ts:6
**Found:** 2026-10-03 by independent review of step 7b.2 (scope: 7059d79..1731845; lenses: quality, security, performance, tests)
**Why it matters:** The assertion moved to 10 for `booking_moved`; the
name did not, so a failing run would report the wrong expectation.
**Suggested fix:** Rename it "are the ten kinds of timeline entry, each
once".
**Resolution:** Fixed 2026-10-03: the test says ten kinds.
