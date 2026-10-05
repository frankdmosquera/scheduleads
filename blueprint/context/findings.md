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

### F-116 [P3] closed - Finding numbers in three code comments added by this feature

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
**Resolution:** Fixed 2026-10-05: the three numbers are gone, and so are two more of the same kind, "(F-92)" in book-time.ts and book-time-resent-while-saving.test.ts; the sentences are unchanged. The "(F-06)" in migrations/0000_adopt_repo_one_tables.sql stays: that migration is already applied.
Closed 2026-10-05 by independent review of step 8a.3 (scope: 56f1bae..40f598e): `git grep` for `(F-` and bare `F-NNN` across backend, frontend and packages finds no finding number in any code comment outside the applied migration this resolution names; the three originals and the two "(F-92)" are gone.

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

### F-149 [P2] closed - When the follow gives up on the old person's calendar, nothing records that the event is still there, so neither the cancel nor feature 8 can remove it

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
**Resolution:** Carried to feature 8 (spec, Notes for the AI): its retry job must carry the first person and the event id being removed; a booking column would only half-solve it. Fixed 2026-10-05 in 8a.3: a move to another person and a cancel add a removal job carrying the person and the event id read inside the transaction (the saved id, or the id the event has when none is saved yet), retried on its own. Test: a move whose first calendar needs reconnecting removes the old event once it is reconnected.
Closed 2026-10-05 by independent review of step 8a.3 (scope: 56f1bae..40f598e): move-booking.ts:279-284 and cancel-booking.ts:105-113 add a removal job carrying the first person and the event id inside the transaction, and remove-booking-event.ts acts only on those, never on where the booking is now; the test "a move whose first calendar needs reconnecting removes the old event once it is reconnected" passed in 8 of 8 full runs, and the original probe's case (Ana's DELETE failing, then a cancel) now leaves Ana's removal job to retry on its own. A compound race that still leaves an event under an older move's id is F-187.

### F-150 [P3] fixed - Two moves inside one follow's Google calls leave an orphan event and save the wrong calendar's id

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
**Resolution:** Carried to feature 8 with F-149: two moves inside one follow's Google calls; the retry job design covers it. Fixed 2026-10-05 in 8a.3: a booking's calendar jobs run one at a time in its lane, a write or move does nothing once a later move added its own job, and an event id is saved only while the booking still has the person and move number the job read. Test: two moves close together, the middle person's write held mid-call, leave one event at the last time in the last person's calendar.
Not closed by independent review of step 8a.3 (scope: 56f1bae..40f598e): the original case holds (Ana to Mei to Ana with Mei's write held leaves one event, `s2` in Ana's calendar, saved), but two changes inside one Google call still leave an event behind when the first change keeps the person: see F-187.

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

### F-156 [P3] closed - The sixth copy of the "start and settle" background tracker

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
**Resolution:** Carried to feature 8 on Frank's call, 2026-10-04: its job runner replaces all six trackers, so a shared helper now would be thrown away. Noted in the spec's Notes for the AI. Stays open until then. Fixed 2026-10-05 in 8a.3: the three event trackers are removed; with 8a.2's three email trackers, all six are now jobs, and no test waits with settled().
Closed 2026-10-05 by independent review of step 8a.3 (scope: 56f1bae..40f598e): no `booking-event-*` or `booking-*-emails` tracker module is left, `git grep` finds no `new Set<Promise` or tracker import in backend, and the `settled()` calls that remain are each email test file's local name for `workDueJobs()`.

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

### F-169 [P3] closed - A failed write into the new person's calendar skips the removal from the first person's

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
**Resolution:** Fixed 2026-10-05 in 8a.3: the new person's write and the first person's removal are separate jobs. Test: a failed write into the new person's calendar still lets the old event be removed, and the write lands on its retry.
Closed 2026-10-05 by independent review of step 8a.3 (scope: 56f1bae..40f598e): the new person's write is a `booking_event_move` job and the first person's removal a `booking_event_remove` job (move-booking.ts:275-284), so neither depends on the other; the test "a failed write into the new person's calendar still lets the old event be removed" sees the DELETE after a 503 POST and the write land on its retry, 8 of 8 full runs.

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

### F-173 [P1] closed - The API keeps serving after its runner has stopped itself, so jobs pile up unworked until the next deploy

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
Closed 2026-10-05 by independent review of 8a.1's fixes (scope: 17a9118..882086a): `server.ts:52` attaches `exitWhenRunnerStops(runner, () => stopping)` synchronously after the runner starts, and `stop()` sets `stopping` before it calls `runner.stop()`, so a SIGTERM never reads as a self-stop. In graphile-worker 0.18.0 every stop, the API's or the library's own, goes through the one `stop()` in dist/runner.js:94-114: a worker that rejects (seppuku, worker.js:296-301) is removed, the pool records the error and shuts down (main.js:956-963), `_finPromise` rejects, and the `wp` handler calls `stop()` and ends in `.catch(noop)` (runner.js:115-117), so `runner.promise` (runner.js:121, `Promise.all([cp, wp])`) resolves and never rejects; `.finally` therefore fires on a self-stop. Run here against scheduleads_dev: a runner stopped from outside resolved its promise at once. Railway's restart policy docs: the default is On Failure, which restarts on a non-zero exit, up to 10 times (see F-179 for what that cap means here). The test's first half calls the public `stop()` with a reason rather than making a worker fail, so it proves the watcher and its two branches, and the library source above proves a self-stop reaches it; enough for a two-branch hook. Build, 581 backend tests and format:check pass. The aside about F-177 in this resolution does not hold: see F-177.

### F-174 [P3] closed - 8a.1's plan lists the job names and their id-only payload types; neither was built and the spec does not say they moved

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
Closed 2026-10-05 by independent review of 8a.1's fixes (scope: 17a9118..882086a): step 8a.1's first bullet (current-feature.md:112-117) now describes what was built, `enqueueJob(executor, name: string, payload: Record<string, string | number | null>, options)` in backend/lib/jobs/enqueue-job.ts:19-24, and says where the names and payload types moved; Files / areas and Data / contracts describe the whole feature, so they rightly still list them. 8a.2 gained the API-by-hand check the amendment moved there.

### F-175 [P3] closed - The runner's tests leave one job queue row in the database on every run

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
Closed 2026-10-05 by independent review of 8a.1's fixes (scope: 17a9118..882086a): `afterAll` (job-runner.test.ts:60-62) deletes `_private_job_queues` rows matching `test-<tag>-%`, which covers the queue test's `test-<tag>-queue`, after the jobs that reference them are gone. After a full backend run here (59 files, 581 tests), a read-only count of scheduleads_dev showed 0 jobs, 0 queues, 0 `test-%` queues and 0 `test-%` tasks.

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
**Resolution:** Confirmed 2026-10-05 from Railway's documentation (deployment teardown): an old deployment gets SIGTERM, then SIGKILL after RAILWAY_DEPLOYMENT_DRAINING_SECONDS, about 0 to 3 seconds by default. A job in flight at a deploy can be killed and then waits about 4 hours for its lock to expire. The fix is a Railway setting on the backend service (for example 30 seconds), which only Frank changes; raised with him after 8a.1's review. Frank, 2026-10-05: set at the deploy that ships 8a; written into the spec's deploy notes. Stays open until then.

### F-177 [P1] invalid - With no job defined, the API's runner dies right after it starts and nothing says so

**File:** backend/lib/jobs/start-job-runner.ts:13; backend/server.ts:31
**Found:** 2026-10-05 by the builder while fixing F-173 (scope: step 8a.1)
**Why it matters:** graphile-worker's workers assert at least one runnable task; with 8a.1's empty `jobTasks` every worker exited with "No runnable tasks!", the pool shut down and the runner stopped itself. The API had logged "[jobs] runner working" just before, so 8a.1's check by hand proved nothing; with F-173's fix the API would have exited and restarted in a loop.
**Suggested fix:** Start the runner only when a job is defined, and say so.
**Resolution:** Fixed 2026-10-05: `startJobRunner` returns null for an empty task list; `server.ts` logs "[jobs] no jobs defined yet: runner not started" and stops or watches the runner only when there is one. A test checks no runner starts for an empty list; removing the guard fails it. Started by hand, the API printed that line and still answered /health 8 seconds later. The runner's first start in the API is checked in 8a.2, when the first jobs exist.
Invalid 2026-10-05 by independent review of 8a.1's fixes (scope: 17a9118..882086a): the defect described does not exist in graphile-worker 0.18.0. The "No runnable tasks!" assertion (dist/taskIdentifiers.js:19) is thrown inside `getJob` (sql/getJobs.js:13), which a continuous worker calls inside a try (worker.js:90-134); on an error it logs at debug level ("Failed to acquire job ... contiguous fails") and tries again after `pollInterval` (2 s); only a run-once worker rejects. Run here against scheduleads_dev with `taskList: {}`, concurrency 5 and no stop call: after 9 s `runner.promise` was still pending, each of the 5 workers had logged "Failed to acquire job: No runnable tasks!" 5 times at debug, and nothing else. Repeated with the repo's own `jobRunnerOptions({})` and `exitWhenRunnerStops(runner, () => false)`, `process.exit` stubbed: no exit in 9 s. So 8a.1's API runner never died, and F-173's fix would not have looped; what an empty list really does is five workers failing every 2 s, silently, because our logger drops debug lines. The guard in `startJobRunner` and the null runner in `server.ts` are still right for that reason and stay; the wrong reason they carry is F-178.

### F-178 [P3] closed - The code and the spec give a library behaviour that does not happen as the reason no runner starts without a job

**File:** backend/lib/jobs/start-job-runner.ts:12; backend/lib/jobs/job-runner.test.ts:203; blueprint/context/current-feature.md:118-119, 132-134
**Found:** 2026-10-05 by independent review of 8a.1's fixes (scope: 17a9118..882086a; lenses: quality, security, performance, tests)
**Why it matters:** The comment in `startJobRunner` ("the library's workers
refuse an empty list and exit at once"), the test's comment ("its workers
would refuse an empty list and exit") and 8a.1's Done when ("the library
refuses an empty list") all state what F-177 found invalid: in 0.18.0 the
workers stay up and retry every 2 s, logging only at debug. 8a.2 and 8a.3
build on this runner; a reader trusting the comment would expect an empty
or mistyped task list to stop the runner and, through F-173's watcher,
restart the API loudly, when in fact it polls silently and works nothing.
Separately, the bullet "The runner's own tables installed by the API at
start" (current-feature.md:118) is no longer true while no job is defined,
since the tables are installed only inside `run()`; nothing in 8a.1 adds a
job, so nothing breaks before 8a.2.
**Suggested fix:** Reword the two comments to the real reason (with no task
the workers would only poll and fail every 2 s, silently, at debug level),
and amend 8a.1's Done when and its tables bullet to match: no runner and no
table install at API start until 8a.2 defines the first jobs.
**Resolution:** Fixed 2026-10-05: both comments now say an empty list would leave the workers polling for nothing, silently; the spec's Done when says the same, and its tables line says the API installs them when its runner starts, once a job is defined.
Closed 2026-10-05 by independent review of step 8a.2 (scope: f29ce9b..95e47d2): re-read at 95e47d2. `start-job-runner.ts:12` gives the real reason (an empty list would leave the workers polling every two seconds for nothing, silently); `job-runner.test.ts:205` says the same; the spec's tables bullet says the API installs them "when its runner starts (once a job is defined)" and 8a.1's Done when says "its workers would poll for nothing". No old wording ("refuse an empty list") remains in `backend/` or the spec.

### F-179 [P3] unverified - A self-stop during a Postgres restart may restart the API into a database that is still down, until Railway's retries run out

**File:** backend/lib/jobs/exit-when-runner-stops.ts:12; backend/server.ts:31 (graphile-worker 0.18.0: dist/lib.js:324-326)
**Found:** 2026-10-05 by independent review of 8a.1's fixes (scope: 17a9118..882086a; lenses: quality, security, performance, tests)
**Why it matters:** F-173's case is a Postgres restart while a job is
closing. The fix exits the API at once, and the restarted API's first act is
`startJobRunner`, whose `run()` installs the runner's tables through a
plain `withPgClient` with no retry (lib.js:324-326), so while Postgres is
still down the start throws and the process crashes again. Railway's restart
policy docs give the default as On Failure with at most 10 restarts and say
nothing about a delay between them or whether the count resets. If 10 quick
restarts fit inside Postgres's downtime, the API stays down after Postgres is
back: bookings stop, not just the emails F-173 was about. Before the fix the
same blip left the API serving with no runner. Reachable from 8a.2, when the
first jobs exist; not reproduced. Missing validation: Railway's delay between
restarts and whether the count resets, observed once on the backend service.
**Suggested fix:** Check it alongside F-176's Railway setting; if restarts
come fast, have the API retry the runner's first start for a bounded time
(say a minute) before giving up, or raise the service's restart limit.
**Resolution:**

### F-180 [P1] closed - A failed email job outlives the test that failed it, so a later test works it: the backend suite fails about half the time, and once called the real Resend

**File:** backend/lib/email/send-move-emails.test.ts:200-207, 326; backend/lib/email/send-booking-emails.test.ts:180-186; backend/lib/email/send-cancellation-emails.test.ts:189-196; backend/vitest.setup.ts:37
**Found:** 2026-10-05 by independent review of step 8a.2 (scope: f29ce9b..95e47d2; lenses: quality, security, performance, tests)
**Why it matters:** The "Resend failing" tests in the three email files now
leave their two failed jobs in the worker's schema, due again about 2.7 s
later (graphile-worker's wait after a first failure, e^1 s). Nothing removes
them until the next file starts (`vitest.setup.ts:37`), and every later
`settled()` runs `workDueJobs`, which takes every due job in the schema. So
the old retry lands inside whichever later test is running then, and its
send is counted in that test's `calls`. Seven full runs of
`npm run test --workspace=backend` in this review: four failed, each with one
test in send-move-emails.test.ts: three times "a business without its key
moves and sends nothing, and logs it" (line 358: `calls` held another
booking's `booking_move` to jane-...@example.com) and once "sending a move's
emails again sends the very same invite, under the same key" (line 372: the
Idempotency-Key of another booking). The plain first run and the builder's
passed, so the step's "every step reruns them" gate is a coin flip.
The same leftover can also reach the real network: these files unstub
`fetch` in `afterEach`, then `afterAll` calls `settled()`. After the first
run here, the dev database's `graphile_worker_test_8` schema held
send-booking-emails' failed jobs (confirmation and notification, attempt 2)
whose stored error was "Sending an email failed: validation_error (401)", an
answer no stub in the repo gives for a booking email (those tests answer 500
`application_error`; the only 401 stubs are in key tests that make no
booking), so the retry went to api.resend.com with the fake key
`re_primo_send_key`, a test address and the rendered email. Resend refused
the key, so nothing was delivered, but the spec's Testing line says
"Resend faked, nothing real sent", and on a slow network that `afterAll`
waits up to the send's 10 s limit against Vitest's 10 s hook limit.
`booking-email-job.test.ts:164-168` already does it right (deletes the
schema's jobs after each test).
**Suggested fix:** In every test file that fails a send on purpose (at least
these three), delete the worker schema's jobs in `afterEach`, as
booking-email-job.test.ts does, or have each failure test remove its own
failed jobs; in `afterAll`, delete leftover jobs instead of working them, or
work them before `fetch` is unstubbed. Then run the full backend suite
several times in a row to show it is steady.
**Resolution:** Fixed 2026-10-05: backend/vitest.setup.ts clears the worker's jobs after every test, so no job a test left failing runs inside the next; and the tests' fetch throws for any host outside this machine, so an unstubbed fetch can never reach Resend or Google again. Evidence: 8 full backend runs, all 586 passing; with the clearing switched off the same failure returned ("a business without its key moves and sends nothing") within 4 runs. The broken job 169 in the dev schema (the builder's own hand check, added with a double-encoded payload) was removed, and enqueueJob now casts the payload through text so no driver can store it as a string.
Closed 2026-10-05 by independent review of 8a.2's fixes (scope: 95e47d2..f3c983f): the
defect is gone. (1) The clearing runs for every test and last: `vitest.setup.ts:54-56`
is loaded for every file by `vitest.config.ts`, and Vitest 5's default
`sequence.hooks: "stack"` runs it after the file's own and any describe-level
`afterEach`. A scratch probe run through the same setup added a job in the test, in a
describe `afterEach` and in the file `afterEach`; every next test started with 0 jobs.
(2) The fetch guard holds: the setup assigns it before any file code runs, so
`vi.stubGlobal` records the guard as the value to restore and `vi.unstubAllGlobals`
puts the guard back, never Node's fetch (the probe saw `globalThis.fetch === guard`
after every unstub); string, `URL` and `Request` forms of api.resend.com and
googleapis.com, and a `localhost.evil.com` host, were all refused. No file keeps its
own copy of the real fetch. (3) Nothing reaches the API: `tsconfig.json` excludes
`vitest.*.ts`, the build writes no `dist/vitest.setup.js`, nothing imports it.
(4) The four email and job files, 4 runs each: with the pre-fix setup (95e47d2,
run from a scratch copy) 4 failures in 3 runs, all leftover-job assertions (e.g.
"sending a booking's emails again ...": 3 calls, not 2); with the fixed setup 0.
(5) After 10 full runs every `graphile_worker_test_*` schema held 0 jobs (the report
found failed jobs left in test_8). (6) The cast: through the API's own Drizzle and
postgres-js connection, `json_typeof` gives `object` for both `::json` and
`::text::json`, and `enqueueJob` inside a rolled-back transaction stored the payload
as an object with `sequence` a number; nothing was left behind. The full suite is
still not steady (4 of 10 runs green here), but none of the 6 failures is this
defect's shape: they are timeouts and what a timed-out test does to the next one
(F-183), and one finished job still listed (F-184).

### F-181 [P2] closed - An earlier move's email, retried after a later move, tells Jane and the business a time that no longer holds

**File:** backend/lib/jobs/booking-email-job.ts:43; backend/lib/email/send-move-emails.ts:34
**Found:** 2026-10-05 by independent review of step 8a.2 (scope: f29ce9b..95e47d2; lenses: quality, security, performance, tests)
**Why it matters:** Decision 3 says a job does what is still true when it
runs, and the step applies it to the confirmation pair (`sequence > 0`:
nothing sent). A move's own job has no such check: `sendMoveEmails` stops
only for a cancelled booking, so move 1's emails go even when the booking is
already at move 2. Before 8a, "sent late" meant the same moment as the move;
now a failed move email is retried for about three and a half hours, so the
order can flip. Concretely: Jane moves from 9:00 to 10:00, Resend fails her
`booking_move` (job retried after 2.7 s, 7.4 s, 20 s, 55 s, 2.5 min, ...),
she moves again to 11:00, move 2's emails go, then move 1's retry succeeds
and the last email she gets says "Your booking has moved: 10:00". Her
calendar stays right (the invite's SEQUENCE 1 is below 2), but the email
text and the business's "moved from 9:00 to 10:00" notice arriving after
"moved from 10:00 to 11:00" are wrong. No test covers it; 7b's test "an
earlier move's emails, sent after a later move, still carry that move's
times" (send-move-emails.test.ts:392) calls `sendMoveEmails` directly and
asserts the old behaviour.
**Suggested fix:** In the job (or in `sendMoveEmails` when called with
`only`), send nothing when the booking's current sequence is above the
job's, as the confirmation does (the later move's emails tell both); add a
test with a failed move 1 email, a second move, then the retry. Whether 7b's
direct-call test keeps its behaviour is Frank's call.
**Resolution:** Fixed 2026-10-05: the email job skips a move's emails once the booking's sequence is past that move (a later move replaced it), logging one line; the later move's emails say the time that holds. New test "a move's emails still waiting after a later move are not sent"; removing the skip fails it. The sender called directly still builds any move's emails (7b's F-154 test unchanged).
Closed 2026-10-05 by independent review of 8a.2's fixes (scope: 95e47d2..f3c983f):
`booking-email-job.ts:38-46` reads the booking's current `sequence` with its start and
skips only the two move kinds when it is above the job's own, after the gone and
started checks and before any send. A cancel does not raise `booking.sequence`, so a
move's job after a cancel still reaches `sendMoveEmails`' cancelled check; the
confirmation and cancellation kinds are untouched; the log line carries ids only. The
new test (`booking-email-job.test.ts:275-293`) makes two moves before working the jobs
and expects only the `/2` keys, no job left and the skip line; without the skip the
two `/1` keys would be in `calls`, so it guards the repair. It passed in all 10 full
runs; `send-move-emails.test.ts:392` (direct call) still passes. The test does not
fail a send first, but the job takes the same path on a first try and a retry. Its
`jobsOf(id)` read straight after `workDueJobs` is exposed to F-184, if that is real.

### F-182 [P3] closed - The spec still says the runner prints the Windows executable-file warning, which 8a.2 turned off

**File:** blueprint/context/current-feature.md:249-252; backend/lib/jobs/job-runner-options.ts:45
**Found:** 2026-10-05 by independent review of step 8a.2 (scope: f29ce9b..95e47d2; lenses: quality, security, performance, tests)
**Why it matters:** 8a.2 disables `LoadTaskFromExecutableFilePlugin`, the
only source of "Executable file detection not yet supported on win32"
(graphile-worker 0.18.0 dist/plugins/LoadTaskFromExecutableFilePlugin.js:18),
yet the spec's Notes still tell the reader the runner prints it once at
start and that it is harmless. Someone checking the API by hand against the
spec would look for a line that no longer appears. The note goes into the
archive at /complete.
**Suggested fix:** Reword the note: the plugin is disabled, so nothing is
printed; keep the part about SIGTERM on Windows.
**Resolution:** Fixed 2026-10-05: the spec note now says only that a stop signal cannot be sent on Windows; the warning line is gone since the plugin is switched off.
Closed 2026-10-05 by independent review of 8a.2's fixes (scope: 95e47d2..f3c983f): the
Notes (`current-feature.md`, last bullet) no longer promise the line and keep the
SIGTERM part. True for the API: its runner and its table install
(`install-job-tables.ts:11`) both go through `jobRunnerOptions`, which disables the
plugin. The line still prints in the tests, from `vitest.setup.ts:49`'s own
`runMigrations` call, which passes no preset; Vitest 5 shows it only beside a failing
file, which is how it surfaced here. Untouched by this range and cosmetic, so no
entry of its own.

### F-183 [P1] closed - The tests that work jobs run close to Vitest's 5 s limit and time out under ordinary load: the backend suite failed 5 of 10 runs this way

**File:** backend/vitest.config.ts:6-8 (no `testTimeout`); backend/lib/jobs/work-due-jobs.ts:10-12; backend/lib/email/send-move-emails.test.ts:127-134; the same pattern in send-booking-emails.test.ts, send-cancellation-emails.test.ts, lib/jobs/booking-email-job.test.ts, lib/jobs/job-runner.test.ts
**Found:** 2026-10-05 by independent review of 8a.2's fixes (scope: 95e47d2..f3c983f; lenses: quality, security, performance, tests)
**Why it matters:** Every `workDueJobs` is a whole graphile-worker `runOnce`:
the options resolved afresh (a new object each call, so the library's
per-options cache at lib.js:120-126 never hits), a new pg Pool opened, and
its `end()` not awaited (lib.js:226-228). With nothing due, on a quiet
machine, one call took 75 to 190 ms. A move test works the due jobs 9 to 12
times (`settled()` alone is three) and renders the emails, so the same test
took anywhere from 1.0 to 5.1 s across runs, against Vitest's default 5 s.
Ten full runs of `npm run test --workspace=backend` in this review, with
Frank's usual dev servers up (Next on 3002, 3100, 3101, agency-site-app) and
nothing else touching the tests: runs 2, 3, 4 and 10 green; runs 1, 6, 7, 8
and 9 red with "Test timed out in 5000ms" (1, 7, 8, 1 and 2 timeouts, in
send-move-emails, send-cancellation-emails, send-booking-emails,
booking-email-job and job-runner); run 5 is F-184. Two files alone
(send-move-emails, booking-email-job) still timed out once in two runs ("a
booking cancelled since gets no move emails", 5016 ms). Postgres peaked at 59
of 100 connections, so this is time, not a refusal. Not caused by f3c983f:
the pre-fix setup gives the same durations on the same files. A timeout also
reopens F-180's door: Vitest moves on, but the timed-out test keeps running,
so its next `workDueJobs` works the following test's jobs under that test's
fetch stub (same schema). Seen in run 7: "a booking, a cancel and a move..."
timed out, and the next test, "a send that fails once is sent on the
retry...", then counted 3 sends to Jane instead of 2
(booking-email-job.test.ts:229); in job-runner.test.ts "a task that fails
twice then succeeds" timed out and the next test found 0 log lines, not 1.
The step gate "every step reruns them" is red more often than green.
**Suggested fix:** Give the backend tests a longer limit (`testTimeout` in
`vitest.config.ts`, say 20 s, or per file for the files that work jobs), and
make `workDueJobs` cheaper: one pg Pool per test file passed as `pgPool`, and
one options object reused, instead of a new pool and options per call. Then
run the full suite 10 times in a row and record the results.
**Resolution:** Fixed 2026-10-05: the backend tests get a 30 second time limit for tests and hooks (backend/vitest.config.ts), normal for tests that book, move and work jobs against the real database; with F-184's wait, 10 full backend runs in a row all passed (587 of 587, 32 to 42 seconds each). Not done: sharing one Postgres pool across workDueJobs calls would make each call cheaper, but needs the `pg` driver declared in backend's package.json (today it comes only through graphile-worker), a dependency change that is Frank's call; carried as a note.
Closed 2026-10-05 by independent review of 8a.2's second fixes (scope: f3c983f..b4210e9):
the defect is gone. `backend/vitest.config.ts:10-11` sets `testTimeout` and `hookTimeout`
to 30 s for every backend file (the only Vitest config in `backend`, and the setup file
is loaded through it). Ten full runs of `npm run test --workspace=backend` in a row,
no dev server started by this review: all ten green, 587 of 587 each, Vitest durations
32.87, 31.63, 32.35, 33.11, 33.48, 32.08, 31.88, 32.50, 33.20 and 32.32 s (33 to 36 s
wall). Run 10's JSON timings put the slowest test at 7.2 s ("many simultaneous holds
...", hold-time.test.ts, which would have failed the old 5 s limit) and the slowest
job-working test at 3.7 s (send-move-emails.test.ts), so the limit has about four times
the worst seen. The longer limit also keeps a slow test from being abandoned while it
still works jobs, the way into F-180's shape that this entry described. The hook limit
covers F-180's afterAll that waits on a send. The second half of the suggested fix
(one pool, one options object) was not done and is not needed to close: the defect was
the timeouts. The builder's reason holds: `pgPool` takes a `pg` Pool, and `pg` is not in
backend's package.json (only graphile-worker's own dependency), so it is a dependency
choice for Frank.

### F-184 [P2] closed - workDueJobs may return before its last job is marked done, so a test reading the jobs straight after can see a finished job still waiting

**File:** backend/lib/jobs/work-due-jobs.ts:11; backend/lib/jobs/booking-email-job.test.ts:213, 288 (graphile-worker 0.18.0: dist/worker.js:262, 283; dist/main.js:376, 879-900; dist/lib.js:226-228)
**Found:** 2026-10-05 by independent review of 8a.2's fixes (scope: 95e47d2..f3c983f; lenses: quality, security, performance, tests)
**Why it matters:** Run 5 of this review failed once, not by timeout:
"a booking, a cancel and a move each leave their email jobs..." at
booking-email-job.test.ts:213 found `booking_cancellation_notification`
still in the table with attempts 1, although its send was already in
`calls`. In graphile-worker 0.18 the worker fires `completeJob(job)` and
`failJob(...)` without awaiting them (worker.js:262, 283); with the batch
delays at their default -1 (main.js:376) nothing tracks those promises, and
the pool's `end()` is not awaited either, so `runOnce` can resolve before the
last job's delete lands. The other reading is that the job threw after the
send (the timeline write); the file mocks `console.warn`, so the reason was
lost. Not reproduced: a scratch loop (add a job, `workDueJobs`, read the
table) saw it 0 of 40 times on a quiet machine and 0 of 80 beside a full
suite run. f3c983f adds one more read of this shape (line 288).
**Missing validation:** a reproduction, or the job's `last_error` caught at
the moment of the failure.
**Suggested fix:** If it recurs: set `completeJobBatchDelay: 0` and
`failJobBatchDelay: 0` in the options `workDueJobs` passes, so the pool's
shutdown awaits the batchers' release (main.js `terminate`), and prove it
with a test.
**Resolution:** Confirmed and fixed 2026-10-05: graphile-worker 0.18's worker calls completeJob without awaiting it (dist/worker.js), so runOnce can return before a job's end is written. workDueJobs now waits, up to 5 seconds, until no job in its schema is still locked (a finished job is deleted, a failed one unlocked), and throws if one stays locked.
Closed 2026-10-05 by independent review of 8a.2's second fixes (scope: f3c983f..b4210e9):
the defect is gone. (1) The claim holds in graphile-worker 0.18.0: the worker fires
`completeJob(job)` and `failJob(...)` without `await` (dist/worker.js:262, 283); with the
batch delays at their default -1 these are the plain functions at dist/main.js:898-899
and 920-921, whose `release` is null, so `terminate()` (main.js:433-437) has nothing to
wait for, and the pool's `end()` is not awaited (lib.js:227). (2) Shown, not only read: a
scratch probe whose task row-locked its own job from a second connection for 800 ms made
`runOnce` return at 113 to 230 ms with the job still locked, 3 of 3 times; a wait like
`workDueJobs`' then polled about 50 times and ended 8 to 18 ms after the lock let go, with
the job gone. Without the held lock, 60 plain `runOnce` calls never showed the race, which
is why the original entry could not reproduce it. (3) The wait is sound: it reads
`jobSchema`, the same schema `runOnce` gets from `jobRunnerOptions`, which in the tests is
the Vitest worker's own `graphile_worker_test_<pool id>`, so it never waits on another
file's or the dev API's jobs; a job's end is one statement (the delete, or the fail that
clears `locked_at` and, for a queued job, the queue lock in the same CTE,
dist/sql/completeJobs.js, failJobs.js), so "no row locked" cannot be seen before the end
commits and the wait cannot end early; jobs whose task is not in the run's list are never
locked, so a run with a narrow task list does not wait on them; it is bounded at 5 s and
throws, and a rejected end query still surfaces as Vitest's unhandled rejection, so
nothing is masked. Every leftover locked row is deleted by the setup's `afterEach`, and
`job-runner.test.ts`'s runner tests come after its `workDueJobs` tests. No file that
calls it mocks `database.js`. (4) 10 of 10 full runs green (F-183). What this repair does
not reach is the same library behaviour in the API's own stop: F-185.

### F-185 [P2] closed - A deploy's clean stop can exit before a job that just finished is marked done, so that job stays locked for about four hours

**File:** backend/server.ts:47-48; backend/lib/jobs/job-runner-options.ts:33-47; backend/lib/jobs/job-runner.test.ts:173-175 (graphile-worker 0.18.0: dist/worker.js:262, 283; dist/main.js:376, 433-437, 898-899, 920-921; dist/sql/000004.sql:113)
**Found:** 2026-10-05 by independent review of 8a.2's second fixes (scope: f3c983f..b4210e9; lenses: quality, security, performance, tests)
**Why it matters:** F-184's repair proves that the library ends a job with an
un-awaited query. The API's stop has the same gap, and no test or Railway setting
covers it: `stop()` runs `await runner?.stop(signal); process.exit(0);`, and
`runner.stop()` resolves once the workers have returned, which is right after they
fire the end query, not after it lands. A scratch probe did exactly what `server.ts`
does (a real runner with the repo's options, one job, the task returns, `stop`, then
`process.exit(0)`) and read the table afterwards: the finished job was still there,
locked, attempts 1, in 5 of 20 runs. graphile-worker takes such a job again only after
its lock is 4 hours old. So a deploy that lands just as a job ends can: run a booking
email job a second time 4 hours later (whether Resend drops the repeat depends on its
idempotency window for the same key, not checked here); lose a failed try's unlock, so
a retry due in seconds waits 4 hours (a confirmation that failed once arrives hours
late); and, once 8a.3 puts a booking's calendar jobs in one queue, keep that queue
locked too, since the queue unlock is in the same lost statement. Setting
`RAILWAY_DEPLOYMENT_DRAINING_SECONDS` (F-176) does not help: nothing kills the process,
it exits by itself. Decision 9 and the `server.ts` comment say a deploy stops cleanly;
in this window it does not. `job-runner.test.ts:175` reads the jobs straight after
`runner.stop()` and is exposed to the same race (it passed in all 10 runs here).
**Suggested fix:** Set `completeJobBatchDelay: 0` and `failJobBatchDelay: 0` under
`preset.worker` in `jobRunnerOptions`: the ends then go through the library's batcher,
whose `release()` waits for every pending end, and `terminate()` awaits it
(main.js:433-437, 1094-1104). The same probe with that preset left no job locked in 12
of 12 runs, and with the held-lock probe from F-184 `runOnce` itself returned only after
the delete landed. Add a test that stops a runner right after a job's task returns and
expects the job gone. With that in place `workDueJobs`' polling wait is no longer
needed and can go, or stay as a guard.
**Resolution:** Fixed 2026-10-05 as the review proposed: jobRunnerOptions sets the library's completeJobBatchDelay and failJobBatchDelay to 0, so a job's end goes through the batch the runner flushes when it stops, and server.ts's exit after runner.stop() no longer leaves a finished job locked (the review's probe: 12 of 12 clean with this setting, 5 of 20 left locked without). The test "a job added while no runner is running is worked by the next one started" checks the job is gone right after runner.stop(). Three full backend runs passed afterwards (587 of 587).
Closed 2026-10-05 by independent review of step 8a.3 (scope: 56f1bae..40f598e): job-runner-options.ts sets `completeJobBatchDelay: 0` and `failJobBatchDelay: 0`, and graphile-worker 0.18.0's `terminate()` awaits both batchers' `release()` (dist/main.js:428-437) before server.ts:47-48 exits; job-runner.test.ts:164-176 reads the job gone straight after `runner.stop()` and passed in 8 of 8 full runs.

### F-186 [P3] closed - Finding and step numbers in code comments again, two of them added by this range

**File:** backend/lib/jobs/work-due-jobs.ts:18; backend/vitest.config.ts:2-3; backend/vitest.setup.ts:3; backend/lib/jobs/booking-email-job.ts:3
**Found:** 2026-10-05 by independent review of 8a.2's second fixes (scope: f3c983f..b4210e9; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md (Comments, lines 358-359) rules out history
in code comments, finding numbers and step numbers named; F-116 is the same slip,
still open. This range adds "(F-184)" (work-due-jobs.ts:18) and "(F-183)"
(vitest.config.ts:3). The previous range added "(F-180)" (vitest.setup.ts:3) and
"(F-181)" (booking-email-job.ts:3), which its review did not raise, and
vitest.config.ts:2 carries "(8a.2)". After `/complete` the ledger's numbers become
`8a/F-...`, so the bare ones point at nothing; each sentence already says its reason
in words.
**Suggested fix:** Drop the five parenthesised numbers and keep the sentences.
**Resolution:** Fixed 2026-10-05: the finding and step numbers are gone from the comments in work-due-jobs.ts, vitest.config.ts, vitest.setup.ts, booking-email-job.ts and its test, send-and-record-emails.ts and the three booking files; booking-email-job.ts's header is rewrapped to the usual width.
Closed 2026-10-05 by independent review of step 8a.3 (scope: 56f1bae..40f598e): the five numbers are gone (`git grep` finds no `(F-` or `8a.` step number in backend, frontend or packages comments), and the comments this range adds carry none either.

### F-187 [P2] fixed - Two changes inside one Google call still leave an event behind when the first one keeps the person: an extra event, or one for a cancelled booking

**File:** backend/lib/booking/move-booking.ts:235,277; backend/lib/booking/cancel-booking.ts:111; backend/lib/calendar/move-booking-event.ts:50 (save that loses the race: backend/lib/calendar/write-booking-event.ts:87-100, move-booking-event.ts:61-71)
**Found:** 2026-10-05 by independent review of step 8a.3 (scope: 56f1bae..40f598e; lenses: quality, security, performance, tests)
**Why it matters:** When no id is saved, a move or cancel names the event as
`calendarEventIdOf(bookingId, row.sequence)`, the id the current move number
would give. That is only right if the event was written under that number. A
same-person move whose job has not saved its id yet leaves the event under the
previous number's id, known only to that move's job payload; the next change
names the wrong id, and the older event is never touched again. Probed with a
scratch test (this file's Google fake, extended to keep each calendar's live
events and to take a POST before its answer is held), 1 of 1 each:
(A) the booking's write held mid-call, two moves with Ana to 10:00 and 11:00:
Ana's calendar ends with the plain id at 9:00 and `s2` at 11:00, two events for
one booking; (B1) write held, move with Ana to 10:00, then a cancel while that
move's PATCH of the plain id is mid-call: the removal deletes `s1`, the plain id
stays at 10:00 for a cancelled booking; (B2) the same with the move's PATCH
failing once (503) and the cancel landing before its retry: the plain id stays
at 9:00, cancelled; (C) as B1 but a move to Mei instead of the cancel: Mei gets
`s2`, Ana keeps the plain id at 10:00 while the booking is Mei's. B2 needs only
one transient Google error after a move in the first second after booking; the
others need two changes inside one call (the owner's screens, features 11 and
12b, add a second actor). A cancelled appointment left in a worker's calendar
can send them to a customer's house, and it holds that time busy in free/busy.
This is F-150's title in its same-person form; the step's test covers only the
person-change form, and its fake answers a held POST before recording it, so it
cannot see an event Google took but answered late.
**Suggested fix:** Make the id the event may have survive same-person moves:
for example save the intended id on the booking inside the transaction that
adds the write or move job (the write already knows it before calling Google),
so the next change always names the event that exists; or have the removal and
the same-person update try every unsaved id since the last person change
(404 and 410 already count as gone). Add a test with a fake that records a POST
or PATCH before holding its answer, asserting the live events per calendar.
**Resolution:** Fixed 2026-10-05 on Frank's yes: a move that keeps the person updates the saved event in place only when an id is saved. With none saved, as while an earlier write has not saved its id, the move or cancel adds a removal carrying the booking's move number, which takes out every id the event may have had (one never written is gone already, as Google answers), and the move's job writes the event afresh under its own id. The move job no longer takes an event id. Tests, with a fake Google that keeps each calendar's live events and takes a held write before answering: the reviewer's four cases (two same-person moves during the booking's write; a cancel during a same-person move's write; a cancel while that write waits for its retry; a move to another person during it) each end with one event at the last time, or none for a cancelled booking. Three of the four fail on the code before the fix; the retry case passes there too, since the old code moved in place instead of writing.

### F-188 [P3] fixed - A test that ends with a calendar job still running leaves its lane locked in the worker's schema, and later runs fail for four hours

**File:** backend/vitest.setup.ts:55-59; backend/lib/jobs/work-due-jobs.ts:34-46 (graphile-worker 0.18.0: dist/sql/completeJobs.js, failJobs.js, resetLockedAt.js)
**Found:** 2026-10-05 by independent review of step 8a.3 (scope: 56f1bae..40f598e; lenses: quality, security, performance, tests)
**Why it matters:** The setup clears `_private_jobs` after each test but not
`_private_job_queues`. A queue is unlocked only in the same statement that ends
its job (`... from j where job_queues.id = j.job_queue_id`), so a job deleted
while it runs can never unlock its lane; only `resetLockedAt` frees it, after 4
hours. The lane names are now fixed (`booking-event-0` to `-f`) and the
per-worker schemas persist between runs, so a test that times out or is stopped
with a held Google answer (F-95's shape) poisons that lane for every later run
on that Vitest pool id. Probed: a booking's write held mid-call, the jobs
deleted as `afterEach` does, the hold released: the lane row stayed locked, and
a later job in the same lane made `workDueJobs` throw "Jobs were still due
after 20 runs" (the probe then unlocked it by hand). Roughly one booking in 16
per test would then fail on that worker, a flake that looks random for hours.
**Suggested fix:** In `vitest.setup.ts`, clear the lanes with the jobs
(`update ... _private_job_queues set locked_at = null, locked_by = null`, or
delete the queue rows), before the file and after each test.
**Resolution:** Fixed 2026-10-05 as suggested: vitest.setup.ts unlocks every lane in the worker's schema along with clearing its jobs, before each file and after each test.

### F-189 [P3] open - A crash mid-job now holds a sixteenth of every business's calendar jobs for four hours, not only that booking's

**File:** backend/lib/jobs/booking-event-lane-of.ts:4-6; blueprint/context/current-feature.md (decisions 5 and 9) (graphile-worker 0.18.0: dist/sql/getJobs.js queue clause, dist/sql/resetLockedAt.js)
**Found:** 2026-10-05 by independent review of step 8a.3 (scope: 56f1bae..40f598e; lenses: quality, security, performance, tests)
**Why it matters:** Decision 9 accepts that a job left mid-run by a crash
waits for its 4-hour lock. With 16 lanes shared by every tenant, its lane
stays locked too: `getJobs` takes a queued job only while its queue row is
available, and `resetLockedAt` frees the row only after 4 hours. So every
calendar job of every business whose booking id ends in that character waits
4 hours, and a write or move for an appointment starting within that time is
then skipped as started (decision 4): the worker never gets those events. F-188's
probe shows the same mechanism in the tests: one locked lane holds another
booking's job. Decision 5's amendment weighed queue-name count and retry order,
not this blast radius. Rare (a crash, not a deploy, while one of up to 5 jobs is
in a Google call), so a note rather than a defect.
**Suggested fix:** Record the cost in decision 5 as accepted, or narrow it:
more lanes (the last two characters give 256) shrink the share, and the lane
lock could be released at start-up for workers known to be gone.
**Resolution:**
