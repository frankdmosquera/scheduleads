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
**Resolution:** Fixed 2026-10-03: the privacy test also reads console.warn and a refusal's body; the tenant test also makes a real move of ours to a time the other business has booked and checks their booking and rows are untouched. Not closed by independent review of step 7b.3 (2026-10-04): the tenant half holds; the log half still reads a `console.warn` that nothing writes (no calendar is connected in that test, and it reads before `bookingEventMoves.settled()`). A real follow failure's line is now checked for the name and address in move-booking-event.test.ts "a Google error keeps the move and logs one line". Not closed by independent review of feature 7b (scope: a55c8ee..5db122e): the route test is unchanged and still reads `console.warn` and `console.log` before `bookingMoveEmails.settled()` (public-booking-move-routes.test.ts:369-388), so its log half checks only what happens to have run. The move's real log lines are now pinned elsewhere (move-booking-event.test.ts:365, send-move-emails.test.ts:328 and :355), so the remaining gap is the test's name, not the coverage. Not closed by independent review of feature 7b (scope: a55c8ee..6c1fa5d): public-booking-move-routes.test.ts:416-435 is unchanged since that pass. Not closed by independent review of feature 7b (scope: a55c8ee..851fadb): the test file is unchanged since 6c1fa5d.

### F-149 [P2] open - When the follow gives up on the old person's calendar, nothing records that the event is still there, so neither the cancel nor feature 8 can remove it

**File:** backend/lib/calendar/move-booking-event.ts:46,80 (backend/lib/booking/booking-event-moves.ts:2-3; payload: backend/lib/booking/move-booking.ts:241-246; removal: backend/lib/calendar/remove-booking-event.ts:33)
**Found:** 2026-10-04 by independent review of step 7b.3 (scope: 3ba8593..c855db2; lenses: quality, security, performance, tests)
**Why it matters:** Who held the event before a move exists only as the
in-memory argument to the follow. When the follow fails (F-148's cases, a
Google 5xx or timeout, a restart before it runs), or a cancel lands before
it reads the row (line 46 returns "nothing", commented "the removal handles
it"), the event stays in the old person's calendar while `personId` names
the new person, and the cancel's removal asks only the current person's
calendar. Probed: Ana's DELETE answering 503 on a move to Mei, then a
cancel: the only call is a DELETE in Mei's calendar, `calendarEventId` is
cleared, and Ana's 9:00 event is never removed. It keeps Ana busy in
Google's free/busy, so her 9:00 is no longer offered to new customers, and
nothing can find it: not the booking row, not the `booking_moved` payload
(`{ bookingId, fromStartsAt, toStartsAt, sequence }`), not the log line.
booking-event-moves.ts says feature 8 tries again; it has nothing to try
with. This is the half of F-141 that remains.
**Suggested fix:** F-141's first option: save whose calendar holds the
event (`calendarPersonId` beside `calendarEventId`, set by the write,
cleared by the removal) and have the follow and the removal act on it
rather than on the handed-over person and the current `personId`. At the
least, add `fromPersonId` and `toPersonId` to the `booking_moved` payload
and the spec's contract so feature 8 can redo a person change, and correct
the comment at line 46.
**Resolution:** Carried to feature 8 (spec, Notes for the AI): its retry job must carry the first person and the event id being removed; a booking column would only half-solve it.

### F-150 [P3] open - Two moves inside one follow's Google calls leave an orphan event and save the wrong calendar's id

**File:** backend/lib/calendar/move-booking-event.ts:50,57,82 (backend/lib/calendar/write-booking-event.ts:85-88)
**Found:** 2026-10-04 by independent review of step 7b.3 (scope: 3ba8593..c855db2; lenses: quality, security, performance, tests)
**Why it matters:** Each follow pairs the person handed over by its own
move with the booking row as it stands when it reads, and
`writeBookingEvent` saves its id unconditionally. Probed with Mei's event
write held: Jane moved Ana to Mei, then back to Ana, then Mei's answer
released. Calls: DELETE plain id at Ana, POST `s1` at Mei, DELETE plain id
at Mei (wrong id, Mei holds `s1`), POST `s2` at Ana; the saved id ends as
`s1` while the booking is Ana's, and a cancel then deletes `s1` in Ana's
calendar, leaving `s1` at Mei and `s2` at Ana for a cancelled booking. A
move in the first moment after booking (event created, id not yet saved)
can do the same: the PATCH by the plain id misses and `s1` is written
beside it. The window is one follow's Google calls (about a second today;
the owner's move in features 11 and 12b adds a second actor). Feature 8's
retries cannot repair it, since no retry knows which id is right; it
belongs to this step's design, but it is rare.
**Suggested fix:** Run one booking's follows one at a time (a per-booking
chain in booking-event-moves.ts), and with F-149's `calendarPersonId` let
each follow compare where the event is with where it should be instead of
trusting the handed-over person; save the written id only while
`calendarEventId` is still null.
**Resolution:** Carried to feature 8 with F-149: two moves inside one follow's Google calls; the retry job design covers it.

### F-153 [P3] unverified - A PATCH of an event the person deleted by hand may answer 200, so the move reports "moved" and the event stays hidden

**File:** backend/lib/calendar/google-calendar-provider.ts:111-113 (fallback: backend/lib/calendar/move-booking-event.ts:50)
**Found:** 2026-10-04 by independent review of step 7b.3 (scope: 3ba8593..c855db2; lenses: quality, security, performance, tests)
**Why it matters:** The code reads only 404 and 410 as "not there". Google
keeps a deleted event under its id with status "cancelled" (the reason
calendarEventIdOf now adds the move's number); if a PATCH of such an event
answers 200, `updateEventTime` returns true, the follow reports "moved",
and the worker never sees the moved booking. The same applies when the
fallback at move-booking-event.ts:50 patches the plain id in a calendar
this booking's event was once deleted from. No real Google answer was
checked in this review (the fake answers whatever the test sets), and the
comment cites no source, which coding-standards.md asks for when code rests
on how a dependency behaves.
**Suggested fix:** Check once against a real calendar (delete an event by
hand, then PATCH it). If it answers 200, read `status` from the answer and
treat "cancelled" as not there, and cite what was observed beside the line.
**Resolution:**

### F-156 [P3] open - The sixth copy of the "start and settle" background tracker

**File:** backend/lib/booking/booking-move-emails.ts:9-26 (same body in booking-event-writes.ts, booking-confirmation-emails.ts, booking-event-moves.ts, booking-event-removals.ts, booking-cancellation-emails.ts)
**Found:** 2026-10-04 by independent review of step 7b.4 (scope: b56d43a..1524a1b; lenses: quality, security, performance, tests)
**Why it matters:** Each module repeats the same `running` set, the
`.then/.catch/.finally` chain and `settled()`, differing only in the call
and the log line. Every test file that books, moves or cancels must now
list up to six `settled()` calls by hand (this step added the new one to
four files); a file that forgets one can end the database pool while a
send is still writing its `email_sent` entry. Feature 8 will add retries
on top of all six.
**Suggested fix:** One small helper that takes the work and the log line
and returns `{ start, settled }`, with one shared "all background work
settled" for tests; keep the six named exports as thin uses of it.
**Resolution:** Carried to feature 8 on Frank's call, 2026-10-04: its job runner replaces all six trackers, so a shared helper now would be thrown away. Noted in the spec's Notes for the AI. Stays open until then.

### F-161 [P3] fixed - The week bar spills out of the card at 320px

**File:** frontend/components/booking-page/change-time-panel.tsx:243-267
**Found:** 2026-10-04 by independent review of step 7b.5 (scope: 79acbd8..48d743c; lenses: quality, security, performance, tests, accessibility)
**Why it matters:** Three `whitespace-nowrap` items in a 232px content box.
Measured at 320px wide: the "Later ›" button ends at x=301 while the card
ends at x=289, so it crosses the card's border (no page scroll). At 375px it
fits, which is the width the step was checked at; small phones still exist.
**Suggested fix:** Let the range label wrap or shrink (`min-w-0`,
`text-center`), or shorten the buttons to icons with `aria-label`s below a
breakpoint.
**Resolution:** Fixed 2026-10-04: the week reads "Oct 4 to 10" (both months only across two) with narrower buttons; at 320px Later ends at x=260 inside the card at 289. Not closed by independent review of feature 7b (scope: a55c8ee..5db122e): this reviewer started no dev server and could not measure; the code matches the repair (weekName at change-time-panel.tsx:49-56, `px-2` buttons), but the measurement above was for a same-month week, and a week across two months ("Oct 25 to Nov 1") is about four characters wider. Look at one such week at 320px before closing. Not closed by independent review of feature 7b (scope: a55c8ee..6c1fa5d): no dev server was started, so still unmeasured. Estimated from the code only: the buttons went from `px-3` to `px-2` (16px narrower in all) and a cross-month label is about one character shorter than the "Oct 11 to Oct 17" first measured 12px past the card's border, so Later likely ends inside the border but in the card's padding. A measurement is still needed to close it. Not closed by independent review of feature 7b (scope: a55c8ee..851fadb): no dev server was started; the week bar's markup (change-time-panel.tsx:285-315) is unchanged by the last repair, so still unmeasured across two months at 320px.

### F-169 [P3] open - A failed write into the new person's calendar skips the removal from the first person's

**File:** backend/lib/calendar/move-booking-event.ts:82-89
**Found:** 2026-10-04 by independent review of feature 7b (scope: a55c8ee..6c1fa5d; lenses: quality, security, performance, tests)
**Why it matters:** On a person change the follow calls
`writeBookingEvent` outside any try, and `createEvent` throws on any Google
answer but success, as does a token refresh that fails. The first person's
removal sits after it, so one failed write leaves the first person's event
at the old time even when her calendar is perfectly reachable: she sees an
appointment that is no longer hers, and Google's free/busy keeps her busy
there, so that time is not offered to new customers. `calendarEventId` was
already cleared, so nothing points at the event (F-149's retry gap). F-148
asked for the two calendars to be independent; the repair made the new
person's write independent of the first calendar, not the other way round.
No test makes the new person's write fail (move-booking-event.test.ts
fakes every POST as accepted unless the id was deleted there).
**Suggested fix:** Catch the write's failure, run the first person's removal
in every case, then rethrow (or log both on one line); add a test where the
new person's POST answers 500 and assert a DELETE still reaches the first
person's calendar.
**Resolution:**

### F-170 [P3] open - The move-times privacy test reads a 503 refusal, not the times, when its file runs in order

**File:** backend/routes/public-booking-move-times-routes.test.ts:339-347 (connections saved at :244,253-254,264; fetch reset at :178-182)
**Found:** 2026-10-04 by independent review of feature 7b (scope: a55c8ee..6c1fa5d; lenses: quality, security, performance, tests)
**Why it matters:** The file shares one clinic, and the Google tests save
calendar connections for Ana and Mei that are never removed. `afterEach`
resets `fetch` to throw, and "nothing in the answer carries the customer's
details" fakes no Google answer, so with both people connected and both
calendars unreadable, any available throws CalendarUnavailableError and the
route answers 503 `unavailable`. The test then checks that a refusal's body
has no customer details and never asserts the status, so the 200 answer it
is named for (`people`, `startTimes`, `lastDate`) is only checked when the
test runs alone. The same order dependence F-135 removed from the Google
tests, in the one test that does not set Google up.
**Suggested fix:** Call `fakeGoogleBusy([])` at the start of the test and
assert `response.status` is 200 before reading the body.
**Resolution:**

### F-171 [P3] open - AGENTS.md's branch example still has no build-plan number, which the skills now require

**File:** AGENTS.md:211-212 (skills: .claude/skills/feature/SKILL.md:141-147, .claude/skills/implement/SKILL.md:50-52)
**Found:** 2026-10-04 by independent review of feature 7b (scope: a55c8ee..6c1fa5d; lenses: quality, security, performance, tests)
**Why it matters:** The delta changes `/feature`, `/implement`,
`/autopilot`, `/continuous` and the spec template to name feature branches
`feature/NN-<name>` (this branch is `feature/07b-reschedule`), matching the
workspace rules. AGENTS.md, the file every session loads, still gives
`feature/booking-links-resources-and-availability-rules` as the example of a
feature branch, so the project's two instruction sources now show different
shapes for the same name.
**Suggested fix:** Change the example to the numbered form, for example
`feature/07b-reschedule`.
**Resolution:**

### F-172 [P3] open - The change-time panel keeps its own untested copies of the backend's date helpers

**File:** frontend/components/booking-page/change-time-panel.tsx:26-38 (backend/lib/local-time/local-date.ts:6, backend/lib/local-time/add-days.ts:3)
**Found:** 2026-10-04 by independent review of feature 7b (scope: a55c8ee..851fadb; lenses: quality, security, performance, tests)
**Why it matters:** `dateIn` (a moment's YYYY-MM-DD in the business's
zone) and `addDays` (calendar arithmetic on YYYY-MM-DD) do the same jobs as
the backend's `localDate` and `addDays`, which are tested; the panel's
copies are not, because the frontend has no test runner. Every week the
panel asks for, the day groups, "today" and the last-week check rest on
them. This delta already met the cost of a hand copy once: F-164, a third
`telHref` that lost one backslash and dialled nothing, repaired by moving
the one helper into `packages/shared/helpers/` with its test. The coding
standards put a helper both apps need in `packages/shared`. The copies agree
today (both work in UTC on YYYY-MM-DD); nothing keeps them agreeing.
**Suggested fix:** Move `addDays` and a `localDate` that builds from
`formatToParts` into `packages/shared/helpers/` with one test each, and
import them in both the backend and the panel; or leave it for the dashboard
(features 11 and 12b), which will need the same dates, and note it there.
**Resolution:**

### F-173 [P1] fixed - The API keeps serving after its runner has stopped itself, so jobs pile up unworked until the next deploy

**File:** backend/server.ts:30 (graphile-worker 0.18.0: dist/runner.js:115-121, dist/main.js:956-963, dist/worker.js:296-301, dist/lib.js:354-362)
**Found:** 2026-10-05 by independent review of step 8a.1 (scope: 779512a..17a9118; lenses: quality, security, performance, tests)
**Why it matters:** `server.ts` keeps the `runner` only to call `stop()` on a
signal; nothing watches `runner.promise`. In graphile-worker 0.18 the runner
can stop on its own while the process lives: when a worker cannot mark a job
done or failed it "commits seppuku" (worker.js:296-301), the pool then shuts
down because "one of the workers exited prematurely" (main.js:956-963), and
the runner calls its own `stop()` and resolves `promise` (runner.js:115-121;
both branches end in `.catch(noop)`, so it never rejects and nothing crashes).
The completion is retried only for codes 40001, 40P01, 57P03, EHOSTUNREACH
and ETIMEDOUT (lib.js:354-362); a Postgres restart shows up as 57P01
(admin_shutdown), ECONNREFUSED or ECONNRESET, which are not retried. Concrete
case, from 8a.2 on: Railway restarts Postgres while a confirmation email job
is running; its completion fails with ECONNREFUSED; the runner stops and
prints one `[jobs] Runner stopping` warning; the API reconnects through
postgres-js and keeps taking bookings, each adding its jobs inside the
transaction, and none is worked until the next deploy. That is the outage
this feature exists to survive ("when Resend or Google fails for a while,
the email arrives anyway"), turned silent and indefinite. Reachable only
once a task exists (`jobTasks` is empty in 8a.1), which is why it should be
settled before 8a.2 puts the emails on it. Found by reading the library
source; not reproduced, since that needs the database stopped mid-job.
**Suggested fix:** In `server.ts`, after starting the runner:
`runner.promise.finally(() => { if (!stopping) { console.error("[jobs] runner stopped on its own; exiting so the API restarts"); process.exit(1); } })`,
so Railway restarts the whole process and the new runner picks the jobs up.
A test can stop a started runner's pool and assert the hook fires, or the
step records the hand check.
**Resolution:** Fixed 2026-10-05: `exitWhenRunnerStops` (backend/lib/jobs/exit-when-runner-stops.ts) watches the runner; a stop the API did not ask for logs one line and exits with 1, so Railway restarts the API with a runner. A test stops a real runner from inside and from a SIGTERM: the first exits, the second does not; breaking either branch fails it. While fixing it, a worse case showed: with no job defined yet the library's workers refuse the empty list and exit at once, so 8a.1's API runner died right after "runner working" (F-177).

### F-174 [P3] fixed - 8a.1's plan lists the job names and their id-only payload types; neither was built and the spec does not say they moved

**File:** backend/lib/jobs/enqueue-job.ts:19-23 (spec: blueprint/context/current-feature.md, step 8a.1 first bullet and Data / contracts)
**Found:** 2026-10-05 by independent review of step 8a.1 (scope: 779512a..17a9118; lenses: quality, security, performance, tests)
**Why it matters:** The step's plan says `backend/lib/jobs/` holds "the job
names and their payloads (ids only ...)". The step built `enqueueJob(executor,
name: string, payload: Record<string, string | number | null>)`: any name and
any string value, so a customer's email in a payload compiles and the "ids
only" rule rests on a comment. Leaving the names to 8a.2 and 8a.3, which add
the first tasks, is reasonable, but the ticked box says they exist and the
spec records no move, which is the kind of silent plan drift the step review
is there to catch.
**Suggested fix:** Either add the names and payload types from Data /
contracts now (a name union and one payload type per name, which `enqueueJob`
then takes), or amend step 8a.1 to say they arrive with 8a.2 and 8a.3.
**Resolution:** Fixed 2026-10-05 by amending the spec: 8a.1 builds `enqueueJob` with payload values ids and numbers only; the job names and payload types arrive with the jobs that use them, in 8a.2 and 8a.3.

### F-175 [P3] fixed - The runner's tests leave one job queue row in the database on every run

**File:** backend/lib/jobs/job-runner.test.ts:54-59
**Found:** 2026-10-05 by independent review of step 8a.1 (scope: 779512a..17a9118; lenses: quality, security, performance, tests)
**Why it matters:** The queue test adds jobs in queue `test-<tag>-queue`;
`add_job` creates a row in `graphile_worker._private_job_queues` for it.
`afterAll` deletes this run's jobs and tasks but not the queue, and the
library never removes unused queues by itself. `scheduleads_dev` already
holds 8 such rows (`queue_name like 'test-%'`, counted read-only during this
review) while no `test-` task or job is left. Harmless in size today, but it
is the same unbounded-queues growth the spec's Notes flag for 8a.3's queue
per booking, and the spec's Testing section says each test removes what it
made.
**Suggested fix:** Add
`delete from graphile_worker._private_job_queues where queue_name like 'test-<tag>-%'`
to `afterAll`, after the jobs are deleted.
**Resolution:** Fixed 2026-10-05: afterAll also deletes this run's queue rows; the 8 left by earlier runs were removed from scheduleads_dev; a full backend run now leaves 0 jobs and 0 queues.

### F-176 [P2] open - A deploy's clean stop depends on Railway's grace period, which nothing has confirmed

**File:** backend/server.ts:39-49 (spec: decision 9, "a job left mid-run by a crash (not a deploy, which stops cleanly)")
**Found:** 2026-10-05 by independent review of step 8a.1 (scope: 779512a..17a9118; lenses: quality, security, performance, tests)
**Why it matters:** On SIGTERM the API waits for `runner.stop()` with no time
limit, then exits. Railway sends SIGKILL after `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`;
its docs page on teardown names the variable but this review could not
confirm its default. If the window is shorter than a running job (a Google
call or an email send), the job is killed while locked and is only taken
again when graphile-worker treats the lock as abandoned (about four hours),
so a confirmation could arrive hours late, the case decision 9 says a deploy
avoids. The spec's Notes already say the SIGTERM path is first seen on
Railway. Missing validation: Railway's default draining time and one
observed deploy with a job in flight.
**Suggested fix:** Confirm the default and set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`
(for example 30) when the runner first runs on Railway; optionally bound the
wait in `stop()` so the API exits itself before the SIGKILL.
**Resolution:** Confirmed 2026-10-05 from Railway's documentation (deployment teardown): an old deployment gets SIGTERM, then SIGKILL after RAILWAY_DEPLOYMENT_DRAINING_SECONDS, about 0 to 3 seconds by default. A job in flight at a deploy can be killed and then waits about 4 hours for its lock to expire. The fix is a Railway setting on the backend service (for example 30 seconds), which only Frank changes; raised with him after 8a.1's review.

### F-177 [P1] fixed - With no job defined, the API's runner dies right after it starts and nothing says so

**File:** backend/lib/jobs/start-job-runner.ts:13; backend/server.ts:31
**Found:** 2026-10-05 by the builder while fixing F-173 (scope: step 8a.1)
**Why it matters:** graphile-worker's workers assert at least one runnable task; with 8a.1's empty `jobTasks` every worker exited with "No runnable tasks!", the pool shut down and the runner stopped itself. The API had logged "[jobs] runner working" just before, so 8a.1's check by hand proved nothing; with F-173's fix the API would have exited and restarted in a loop.
**Suggested fix:** Start the runner only when a job is defined, and say so.
**Resolution:** Fixed 2026-10-05: `startJobRunner` returns null for an empty task list; `server.ts` logs "[jobs] no jobs defined yet: runner not started" and stops or watches the runner only when there is one. A test checks no runner starts for an empty list; removing the guard fails it. Started by hand, the API printed that line and still answered /health 8 seconds later. The runner's first start in the API is checked in 8a.2, when the first jobs exist.
