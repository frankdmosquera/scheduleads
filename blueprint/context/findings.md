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

### F-58 [P3] closed - The seed never gives an existing Chemical Peel its 15-minute step, so a migrated (not rebuilt) dev database keeps it empty

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
**Resolution:** Settled 2026-10-08 on chore/cleanup-before-9 with no code change, as the suggested fix asked: the local scheduleads_dev has been rebuilt since (chemical-peel reads slotIntervalMinutes 15), and every test that needs a step sets it on a service it makes itself (find-free-times.test.ts:86, booking-link-slot-interval-rules.test.ts:27-33, apply-free-times-rules.test.ts:63 and 302, the two move route tests); git grep finds no test reading the seeded peel. The seed keeps making rows only while none exist, on purpose, so settings changed by hand survive a reseed; a migrated-only database still needs the documented rebuild (drop, migrate, seed). Closed 2026-10-08 by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): rechecked read-only, clinic-dev's chemical-peel reads slotIntervalMinutes 15 and every other clinic service null. git grep finds no test naming the seeded peel: the only "Chemical Peel" in a test is booking-link-slot-interval-rules.test.ts:30, a service that test makes under its own slug, and every slotIntervalMinutes in a test is on a service or object the test builds itself. The risk it named (a test leaning on the seeded 15) does not exist, so the suggested fix is met; the seed keeping hand-made settings is its intended behaviour.
### F-62 [P3] accepted - Each start costs four Intl calls, repeated for every person, which grows "any available" on a public route

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
**Resolution:** Confirmed (unverified to open) by independent review of step 5c.4 (2026-10-02). The cost is real and is synchronous work, so reading people side by side (Promise.all) shortens the database and Google waits but not this: each person's applyFreeTimesRules still runs one after another on the event loop. Measured in a scratch copy, the rules alone for 7 people over 31 dates (30 minutes, 15 after, one room): weekdays 9 to 17 every 15 minutes, about 73 ms; every day all day every 15 minutes, about 416 ms; every day all day every 5 minutes, about 1.15 s. The build log's 75 ms for the dev clinic matches the first case, so that request is almost all this work, not the reads. Fine for the four tenants' daytime hours; it grows with long windows and a small step (the database allows any step above 0), on a public route with no rate limit yet. Stays a P3, for feature 9 (first public traffic) or feature 12 (where an owner sets the step): work out each date's offset once per request and share it across people, or put a floor on the step. Measured 2026-10-08 on the seeded clinic-dev (six practitioners, no calendars connected), findFreeTimes with any available, whole call including the database, five runs each: a week ahead 12 to 28 ms median for every service except Chemical Peel (15-minute step, 192 starts) at 63 ms; 31 days ahead 12 to 32 ms, Chemical Peel 105 ms. The customer page asks a week at a time. Left for Frank to decide. Accepted by Frank 2026-10-08: the measured times are under what a customer can notice, and a 15-minute step is the business's own choice (more start times, more to loop over), so it stays; worth revisiting only if traffic grows far beyond this.

### F-94 [P3] closed - chooseAnyAvailable has no caller outside its own test, while the spec still says the booking's order comes from it

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
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9: choose-any-available.ts deleted; its nine tests moved, under the same names, into order-any-available.test.ts, which checks the first choice through a local firstChoice helper (orderAnyAvailable(...)[0] ?? null). 11/11 pass. The 05d archive keeps its lines as written; it already records F-94. Closed 2026-10-08 by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): choose-any-available.ts and its test are gone and git grep finds no chooseAnyAvailable outside the ledger and the archives; the nine cases sit under the same names in order-any-available.test.ts through firstChoice, which is the deleted function's whole body (orderAnyAvailable(...)[0] ?? null), and current-feature.md holds no spec naming it. order-any-available.test.ts 11/11 in all four backend runs.
### F-95 [P3] closed - When the no-wait test fails, its cleanup hangs on the held Google answer and leaves its business in the dev database

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
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9: the held Google answer is file-level and every afterEach lets it go, so a test that fails or times out while Google is held (including inside bookTime, the regression it guards) still lets the write end. Note: since 8a the write is a job and afterAll no longer waits on it; a probe failing the test before Google answered left no business behind with or without the change, so the hang described is no longer reachable that way; the release keeps a failed test from leaving a pending Google answer. Closed 2026-10-08 by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): answerGoogle is file level and afterEach calls it before unstubbing. Probe: the no-wait test made to fail after Google was asked and before it answered (its second toBeNull changed to expect "PROBE-FAIL"), once with the fix and once with the afterEach release removed; both runs reported only that failure and ended in about 10 s, and a read-only query afterwards found no test-event-% business in scheduleads_dev. So the hang is no longer reachable (since 8a afterAll waits on no write), as the Resolution says, and the release keeps the held write from dangling. File restored, sha256 64e0c61c... unchanged. Closed rather than invalid: the finding was right when raised and was reproduced then.
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

### F-134 [P3] closed - The cancel test that checks log lines for the customer's details reads them before any are written

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
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9: since 8a the cancel's emails and event removal run as jobs, so the test now works the due jobs before reading the lines and asserts some were written. Proved: without the workDueJobs line the test fails (no lines read). Closed 2026-10-08 by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): the test works the due jobs before reading. Probe: printing what it reads shows five lines, all written by the jobs (two "[text] ... not sent, the booking was cancelled", two "[email] ... nothing sent", one "[text] ... worker_removed not sent"), none with Jane's details; with the workDueJobs line removed it fails on expect(lines.length).toBeGreaterThan(0) (expected 0 to be greater than 0). File restored, sha256 14c75e71... unchanged. The cancellation email's and event removal's failure lines stay pinned in their own files, as the finding noted.
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

### F-145 [P3] closed - The move's check is a copy of bookTime's: the free check, the room rule, the day's counts and `namesOf`

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
**Resolution:** Partly fixed 2026-10-03: the name lookup is one shared helper (find-resource-names.ts) used by bookTime and moveBooking. The free check's copy stays, carried for when the owner's move (features 11 and 12b) gives a third caller; noted in the spec. Fixed 2026-10-08 on chore/cleanup-before-9: the rest of the copy is now one function, backend/lib/booking/find-booking-choices.ts (findBookingChoices): the free check per candidate (the free times for a customer, real busy time and Google for the owner), the room rule over the span, and the order to try, answering the choices or "time_taken"/"unavailable". bookTime calls it with byOwner for a manual booking; moveBooking with movingBooking, whose own held rows and day count it leaves out. Both files lost their copies (about 150 lines). Typecheck, both builds, format check, and backend 789 three runs in a row pass. The owner's move (features 11 and 12b) is the third caller it was waiting for. Closed 2026-10-08 by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): find-booking-choices.ts is the one check. Read line by line against main's two copies, both callers pass what they used before: byOwner is source === "manual" for bookTime and false for the move; movingBooking is undefined for bookTime, so notTheMovingBooking keeps every row (a commitment's bookingId is string or null, never undefined); the move's ignoreBooking.id is its bookingId, which its old room and day-count filters used; the standby read, the side-by-side calendar reads and the refusal reasons are unchanged, and bookTime still maps "unavailable" and "time_taken" to the same refusals. Seven mutants of the new file, each restored byte for byte (sha256 61c5ffa1... after each), each failing named tests: the room's own-row filter dropped ("a move in a room takes the room again at the new time"); the day count's filter dropped ("any available does not count the booking being moved"); standby read for the owner too ("a room on standby that date is not chosen for a customer, but the owner may use it"); the owner path skipped (three owner-made booking tests); ignoreBooking not passed (four move tests); a picked unreadable calendar answered time_taken (three tests, in bookTime, the booking route and the move route); any available with every calendar unreadable answered time_taken (two). The owner path does not yet honour movingBooking, which no caller reaches today: F-253.
### F-146 [P3] closed - Two move tests promise more than they check: "the log" spies only console.log, and "another business's booking" only sends a foreign person id

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
**Resolution:** Fixed 2026-10-03: the privacy test also reads console.warn and a refusal's body; the tenant test also makes a real move of ours to a time the other business has booked and checks their booking and rows are untouched. Not closed by independent review of step 7b.3 (2026-10-04): the tenant half holds; the log half still reads a `console.warn` that nothing writes (no calendar is connected in that test, and it reads before `bookingEventMoves.settled()`). A real follow failure's line is now checked for the name and address in move-booking-event.test.ts "a Google error keeps the move and logs one line". Not closed by independent review of feature 7b (scope: a55c8ee..5db122e): the route test is unchanged and still reads `console.warn` and `console.log` before `bookingMoveEmails.settled()` (public-booking-move-routes.test.ts:369-388), so its log half checks only what happens to have run. The move's real log lines are now pinned elsewhere (move-booking-event.test.ts:365, send-move-emails.test.ts:328 and :355), so the remaining gap is the test's name, not the coverage. Not closed by independent review of feature 7b (scope: a55c8ee..6c1fa5d): public-booking-move-routes.test.ts:416-435 is unchanged since that pass. Not closed by independent review of feature 7b (scope: a55c8ee..851fadb): the test file is unchanged since 6c1fa5d. Not closed by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): the file changed only in two imports. A probe printing what the privacy test reads found log.mock.calls and warn.mock.calls both empty ([[], []]): the move's emails and Google follow are jobs, and the test reads before any workDueJobs. File restored, sha256 e9d9ac19... unchanged. The same repair as F-134 (work the due jobs, then assert some lines were read) would close it. Fixed again 2026-10-08 on chore/cleanup-before-9, as F-134 was: the privacy test works the due jobs (the move's emails and event, which write the lines) before reading console.log and console.warn, and asserts some lines were read. Proved: without the workDueJobs line it fails "expected 0 to be greater than 0" (file restored, same sha256). Closed 2026-10-08 by independent review of chore/cleanup-before-9 (9610596..177f12e; lenses: quality, security, performance, tests): public-booking-move-routes.test.ts:418 works the due jobs before the log is read and :420 asserts some lines were read. Three probes with only this test selected (-t, 17 skipped), each restored byte for byte (test sha256 f1e23814... and send-move-emails.ts sha256 70aeda26... after each): the workDueJobs line removed fails "expected 0 to be greater than 0"; the customer's name added to the move email job's nothing-sent line (send-move-emails.ts:37) fails at :431 on not.toContain; the same leak with both new lines removed (the old shape) passes, so the repair is what makes the log half bite.

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

### F-161 [P3] closed - The week bar spills out of the card at 320px

**File:** frontend/components/booking-page/change-time-panel.tsx:243-267
**Found:** 2026-10-04 by independent review of step 7b.5 (scope: 79acbd8..48d743c; lenses: quality, security, performance, tests, accessibility)
**Why it matters:** Three `whitespace-nowrap` items in a 232px content box.
Measured at 320px wide: the "Later ›" button ends at x=301 while the card
ends at x=289, so it crosses the card's border (no page scroll). At 375px it
fits, which is the width the step was checked at; small phones still exist.
**Suggested fix:** Let the range label wrap or shrink (`min-w-0`,
`text-center`), or shorten the buttons to icons with `aria-label`s below a
breakpoint.
**Resolution:** Fixed 2026-10-04: the week reads "Oct 4 to 10" (both months only across two) with narrower buttons; at 320px Later ends at x=260 inside the card at 289. Not closed by independent review of feature 7b (scope: a55c8ee..5db122e): this reviewer started no dev server and could not measure; the code matches the repair (weekName at change-time-panel.tsx:49-56, `px-2` buttons), but the measurement above was for a same-month week, and a week across two months ("Oct 25 to Nov 1") is about four characters wider. Look at one such week at 320px before closing. Not closed by independent review of feature 7b (scope: a55c8ee..6c1fa5d): no dev server was started, so still unmeasured. Estimated from the code only: the buttons went from `px-3` to `px-2` (16px narrower in all) and a cross-month label is about one character shorter than the "Oct 11 to Oct 17" first measured 12px past the card's border, so Later likely ends inside the border but in the card's padding. A measurement is still needed to close it. Not closed by independent review of feature 7b (scope: a55c8ee..851fadb): no dev server was started; the week bar's markup (change-time-panel.tsx:285-315) is unchanged by the last repair, so still unmeasured across two months at 320px. Not closed by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): no dev server was started (outside this review's limits). The panel changed only in its date helper imports; the week bar's markup is untouched, so a week across two months at 320px is still unmeasured. Measured 2026-10-08 in the browser at 320px on a real booking page (clinic-dev, a throwaway booking), the week across two months "Oct 29 to Nov 4": before this change Later ended at x=289, inside the card border (x=304) but 14px past the content edge (275), the bar 244 wide in 230, so Later stood out past the time grid. Fixed the same day on chore/cleanup-before-9 with the suggested fix: the week label is min-w-0 and text-center and may wrap. After: the bar fits exactly (scrollWidth 230 = clientWidth 230), Later ends at 275, the label wraps to two lines; at 375px it stays on one line (285 = 285). No console errors. Frontend build and lint pass. Closed 2026-10-08 by independent re-review of chore/cleanup-before-9 (e041ce1; lenses: quality, accessibility), measured in the built-in browser on the same throwaway clinic-dev booking: at 320x700 the week across two months "Oct 29 to Nov 4" has the bar at scrollWidth 230 = clientWidth 230 (x=45 to 275), and Later ends at x=275, the bar's own right edge, 28px inside the card's right border (inner 303, outer 304); page scrollWidth 320. The label wraps to two lines as "Oct 29 to / Nov 4", each line centred, its centre at x=163.87 against the middle of the gap between the buttons at 163.87. The same-month week "Oct 8 to 14" also fits (230 = 230, Later at 275) on one line. At 375x700 the cross-month label stays on one line (bar 285 = 285, Later at 330, border at 358). Keyboard: Shift+Tab from Later lands on Earlier, Enter moves a week and focus stays on the pressed button, Tab goes straight to Later (the label takes no tab stop), and the focus ring sits inside the card. No console errors. Only a note: the two-line label makes the bar 40px tall against 36px for one line, so the times below move down 4px when a week crosses two months; harmless. The repair commit had also dropped the blank line between this entry and F-170; restored here.

### F-170 [P3] closed - The move-times privacy test reads a 503 refusal, not the times, when its file runs in order

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
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9: the test fakes Google with no busy times and asserts status 200 before reading the body. Proved: without fakeGoogleBusy([]) the file in order answers 503 and the test now fails. Closed 2026-10-08 by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): the test fakes Google with no busy times and asserts 200 before reading the body. Probe: with the fakeGoogleBusy([]) line removed, the file run in order fails that test with "expected 503 to be 200". File restored, sha256 df6284f6... unchanged.
### F-171 [P3] closed - AGENTS.md's branch example still has no build-plan number, which the skills now require

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
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9: the example is now `feature/08c-the-worker-s-text`, with "its build-plan number first". Closed 2026-10-08 by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): AGENTS.md:228 gives `feature/08c-the-worker-s-text`, the numbered shape the skills require and the name of feature 8c's archive (blueprint/history/features/08c-the-worker-s-text.md); the one other branch name in AGENTS.md (:247) is feature 1's real, kept branch.
### F-172 [P3] closed - The change-time panel keeps its own untested copies of the backend's date helpers

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
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9: localDate and addDays now live once in packages/shared/helpers (exported as @scheduleads-app/shared/local-date and /add-days), each with its tests (localDate: late evening, a month and year turning at midnight, the two 1:30s of a clock change; addDays: months, a year back, a leap day). The backend's copies in lib/local-time are deleted and its 15 files import the shared ones; the change-time panel drops dateIn and its addDays for the same imports. localDate is now built from the date's parts (en-CA formatToParts, one formatter per zone) instead of clockAsUtc, which stays in the backend for localTimeToMoment. Shared 159, backend 789 three runs in a row (two tests moved to shared), both builds and the format check pass. Not checked in a browser. Closed 2026-10-08 by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): packages/shared/helpers/local-date.ts and add-days.ts are exported as ./local-date and ./add-days; the backend's lib/local-time copies are gone (git grep finds no import of them) and the 15 backend files and the change-time panel import the shared ones. Equivalence probe against main's clockAsUtc localDate: every 15 minutes from 2025-01-01 to 2029-01-01 in all 418 zones Node 26.7.0 knows (ICU 78.3, tz 2026c), plus 1.4 million random moments in seven odd-offset zones (Chatham, Lord Howe, Kolkata, St Johns, Kiritimati, Edmonton, New York): 60,027,008 moments, no difference. addDays against both old versions (the backend's Date.UTC one and the panel's Date.parse one), every day 2024 to 2030 with eleven offsets from -400 to +366: no difference. The panel's old dateIn was the same formatToParts code, so the page's dates do not change. Mutants: localDate formatted in UTC fails two of its three tests; addDays a day off in February fails the leap day test. Both restored, sha256 unchanged.
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

### F-193 [P3] closed - A deploy's stop exits without waiting for the requests in flight, so a booking being made at that moment is cut

**File:** backend/server.ts:39-48
**Found:** 2026-10-05 by /audit independent current (scope: 779512a..dd65fe3; lenses: quality, security, performance, tests)
**Why it matters:** On SIGTERM, `stop()` calls `server.close()` without waiting
for it, awaits only `runner.stop()`, then calls `process.exit(0)`. With no job
in hand the runner stops in milliseconds, and `process.exit` ends the process
whatever sockets are still open, so a request the old API is still answering
is dropped: a booking mid-transaction rolls back and Jane sees an error instead
of her booking, though the deploy notes (F-176) are about to give the old API
30 seconds it could use to finish it. `server.close()` is the half that
already does this (it refuses new connections and calls back once the open
ones end). Not a regression: before this range the API had no SIGTERM handler
and died at once. The comment above it says "no new requests", which is true;
it is the requests already accepted that nothing waits for.
**Suggested fix:** Wait for both before exiting, for example
`await Promise.all([new Promise((resolve) => server.close(resolve)), runner?.stop(signal)])`,
optionally bounded a little under the draining time so the API exits itself
before Railway's SIGKILL.
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9: the stop is now backend/lib/server/stop-gracefully.ts (stopGracefully), which waits for both server.close (refuses new connections, calls back once the open requests end) and runner.stop, bounded; server.ts calls it with a 25 second limit, under the 30 seconds F-176 asks Railway to allow, logs when the limit is hit, then exits 0. Tests (lib/server/stop-gracefully.test.ts, a real HTTP server with a held request): a request in flight finishes before the stop resolves; a new request is refused once stopping; the runner gets the signal and is waited for; a request that never ends lets it stop at the limit. Proved: not waiting for server.close fails two of them (file restored, cmp identical). The built API starts and answers /health 200. Not exercised: a real SIGTERM, which Windows cannot send; Railway's draining is still F-176. Re-reviewed 2026-10-08 by independent review of chore/cleanup-before-9 (daa79f7..4fe2e61; lenses: quality, security, performance, tests); stays fixed, for F-254. What holds: @hono/node-server 2.1.1's serve (dist/index.mjs:1285-1311) returns a plain node:http Server, so server.close is Node's own; on Node 26.7.0 a scratch probe showed close() drops an idle keep-alive connection at once (2 open connections to 1) and calls back only after the open request ends, so the original cut is gone and nothing hangs on an idle connection. The limit's timer is cleared in finally on both paths; a stop that times out leaves server.close and runner.stop pending, which process.exit(0) ends. exitWhenRunnerStops still holds: stopping is set before runner.stop, so the runner's promise settling during the stop returns without exit(1). Exit 0 at the limit is right given F-179: the stop was asked for, and a non-zero exit is what Railway's On Failure policy restarts and counts. Each test bites (stop-gracefully.ts sha256 14691a8ab487d4fa... before and after, cmp identical): close not awaited fails tests 1 and 4; close never called fails 1, 2 and 4; runner.stop() without the signal fails 3; runner.stop not awaited fails 3; no race with the limit fails 4. A temporary probe test, deleted after, showed that a runner.stop that rejects (graphile-worker 0.18.0 runner.js:112, "Runner is already stopped", only while the runner is already stopping itself) makes stopGracefully reject at once with the request still open, so server.ts's stop becomes an unhandled rejection and exits 1; not recorded, since that same window ends in exitWhenRunnerStops' exit(1) anyway. What does not hold is F-254: a connection busy when the stop begins stays open after its answer, and the API keeps answering new requests on it. Also, server.ts:40-41 says Railway "is set to allow" 30 seconds; F-176 is still open, so until that setting lands Railway's 0 to 3 second default is the real bound. Backend tests 793 passed twice, build and format:check pass, the built API answered /health 200 and 3401 was free after. Closed 2026-10-08 by independent review of chore/cleanup-before-9 (b0806c2..c5cf49b; lenses: quality, security, performance, tests): what held it, F-254's kept connection, is gone in the code (the evidence is in F-254, which stays fixed only for its test, F-255). stop-gracefully.ts still waits for server.close and runner.stop raced against the limit, with the timer and the new sweep cleared in finally, and server.ts still exits 0 after it. F-193's own tests still bite (stop-gracefully.ts sha256 22436fdf8c9c8d6f... before and after): a sweep that calls closeAllConnections, cutting what is in flight, fails tests 1 and 4. Backend 794 passed twice, build and format:check pass, the built API answered /health 200 and 3401 was free after. server.ts:43-44 still says Railway "is set to allow" 30 seconds while F-176 is open, as the last review noted.

### F-194 [P3] closed - installJobTables ships in the API but only one test calls it, and its comment says the tests use it before their first job, which they do not

**File:** backend/lib/jobs/install-job-tables.ts:1-12 (its one caller: backend/lib/jobs/job-runner.test.ts:55; the setup's own copy: backend/vitest.setup.ts:49-52)
**Found:** 2026-10-05 by /audit independent current (scope: 779512a..dd65fe3; lenses: quality, security, performance, tests)
**Why it matters:** The comment says the API's runner installs the tables
itself and that "tests call it before adding their first job". The second
half is not what happens: `vitest.setup.ts` runs graphile-worker's
`runMigrations` on the worker's schema itself before every file, and every
`run` and `runOnce` migrates again on its own (graphile-worker 0.18.0
dist/lib.js:323-326, reached from dist/runner.js:24-26 and 43-45). The one
caller, job-runner.test.ts:55, migrates a schema the setup already migrated.
So the file is compiled into the API's dist/ with no production caller, and
a reader looking for where the tables come from is pointed at the wrong
place. The spec's 8a.1 step says the tables are installed by the API's
runner and by the test helper; both already do it through the library.
**Suggested fix:** Delete install-job-tables.ts and its one call in
job-runner.test.ts (the setup and the library already install the tables),
and leave the setup's comment as the place that says the tests' schema is
migrated there.
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9: install-job-tables.ts deleted with its one call in job-runner.test.ts; vitest.setup.ts says beside its runMigrations that it builds each worker schema's runner tables, which db:migrate never does. job-runner.test.ts 8/8 and the backend build pass. Closed 2026-10-08 by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): install-job-tables.ts and its call are gone and git grep finds no reference. vitest.setup.ts runs runMigrations on the worker's own schema (graphile_worker_test_<pool>, the one job-schema.ts reads through JOBS_SCHEMA) before every file, and the API's runner migrates through run() in start-job-runner.ts; job-runner.test.ts passes in all four backend runs.
### F-229 [P3] unverified - Nothing limits how many replies are passed on, so anyone with a business's number makes the agency pay for a text per text they send

**File:** backend/routes/public-text-routes.ts:46-57; backend/lib/text/pass-on-reply.ts:48-69
**Found:** 2026-10-07 by independent step review (scope: 8b.4, ad5e703..63da7b7; lenses: quality, security, performance, tests)
**Why it matters:** Every signed incoming text to a business's number becomes
a job and, with a reply phone, an outgoing text that is longer than the
incoming one (60 or more characters of wrapper), all on the agency's Twilio
account; there is no limit per sender or per business. A spammer, or a
customer's phone stuck in an auto-reply exchange with some other system, costs
the agency the incoming and the outgoing parts of every message, and fills
the business's phone. Unverified: whether Twilio's own filtering stops such
volume first, and what volume is realistic, need live evidence; the spec is
silent.
**Suggested fix:** Only a note for later, a scope question for Frank: a cap
per sender per hour on the pass-on text (the email can still carry the rest),
or watching Twilio's usage alerts at deploy.
**Resolution:** Carried 2026-10-07 to the note for later on how many messages each package includes (spec Notes): a cap on replies passed on as texts is a cost and package question for Frank, not 8b's scope; the email route costs nothing.

### F-238 [P3] unverified - A pass-on text refused with a 5xx lets its claim go, so if Twilio took it anyway the retry sends it again unchecked

**File:** backend/lib/text/pass-on-reply.ts:165-172; backend/lib/text/send-text.ts:73-81
**Found:** 2026-10-07 by the independent review of feature 8b (scope: current, 3b47c1c..43d308e; lenses: quality, security, performance, tests)
**Why it matters:** The release counts any send answered with status 400 or
more as "Twilio refused the send, so surely it did not go". A 4xx is a
refusal. A 5xx (500 Internal Server Error, 502 or 504 from a gateway in front
of Twilio, 503) says only that the answer failed: the message may already be
created. On a 5xx the claim is nulled, the next run reads triedBefore false
(:56), skips findSentText (:147-149) and sends the reply to the business's
phone again. The booking texts are not affected: they check Twilio on every
retry (send-booking-text.ts:94-106). Unverified: whether Twilio ever creates a
message and still answers 5xx needs Twilio's own statement or a live
observation; the code path itself is confirmed by reading. Only a duplicate
notification to the business's own phone is at stake, hence P3.
**Suggested fix:** Let the claim go only for 400 to 499 (and keep 429 among
them); treat a 5xx like a lost answer, so the next run asks Twilio first. One
route test with a 503 on the first send and the text found on the retry.
**Resolution:**

### F-239 [P3] closed - The record says identical replies are never taken for one and both ways are claimed, which the built check does not promise

**File:** blueprint/context/current-feature.md:241-243; packages/shared/db/text-tables/text-reply-table.ts:2-4; backend/routes/public-text-routes.test.ts:359
**Found:** 2026-10-07 by the independent review of feature 8b (scope: current, 3b47c1c..43d308e; lens: quality)
**Why it matters:** The spec's 8b.4 says the lost-answer check counts "from
when the reply was recorded, so two replies in the same words are never taken
for one". That holds when the identical reply was passed on before this one
was recorded (the code comment at pass-on-reply.ts:144-146 says exactly
that). It does not hold after: Jane texts "Yes" (reply A) and "Yes" again
(reply B) a few seconds later; A's send times out without reaching Twilio, B
is passed on, and A's retry a minute later finds B's text, same words, after
A's record, and sends nothing, so the business's phone hears one "Yes" (the
email still carries both). Twilio takes no idempotency key, so this residue is
inherent, but /complete archives the spec as the record. The table's header
also says "A run claims each way (the text, the email)": only the text is
claimed; the email relies on Resend's idempotency key. And the test named "a
retry counts only from its own claim" now pins a check that counts from the
reply's record (F-237).
**Suggested fix:** Say "an identical reply passed on before this one was
recorded is never taken for it" in the spec, say in the table comment that the
text is claimed and the email keyed, and rename the test to "counts from the
reply's record". No code change.
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9 (wording only): text-reply-table.ts says the text is claimed and the email kept to one by Resend's idempotency key, and that a reply in the same words passed on before this one was recorded is never taken for it; the test is renamed "a retry counts from the reply's record: ..."; the 8b archive line now says the same, marked as corrected by F-239. Closed 2026-10-08 by independent review of chore/cleanup-before-9 (392cc7d..394cca2; lenses: quality, security, performance, tests): the table comment says the text is claimed and the email kept to one by Resend's key, which pass-on-reply.ts does (claimText at :35 claims only the text; the email goes with idempotencyKey text-reply/<sid> at :107), and that only a same-words reply passed on before this one was recorded is never taken for it, which is what findSentText since record.createdAt (:147-149) gives. The test name and the 8b archive line say the same. Wording only, no behaviour changed.
### F-252 [P3] accepted - A "new booking" or "moved" still in doubt keeps counting after the person was told the booking is off, so a booking back and away again before its texts run sends a second "off your day"

**File:** backend/lib/text/send-worker-text.ts:159-164; backend/lib/jobs/has-worker-text-in-doubt.ts:13-25
**Found:** 2026-10-08 by independent review (scope: current, ddca0e1..2ad0463; lenses: quality, security, performance, tests)
**Why it matters:** F-243's repair says nobody gets a second "off your day"
for a booking they already think is gone: `believes` needs an added or moved
entry newer than the latest off entry. But the in-doubt branch is ORed in with
no such comparison, and hasWorkerTextInDoubt counts any try of an added or
moved job for that booking and person, including one that gave up long ago
(F-248, accepted, so it stays in the runner's table for good). Path, read from
the code: Pedro's "new booking" gives up after its tenth try (for example a
day with the production keys missing, which send-text.ts retries); later the
booking moves to Maria and Pedro's "off your day" goes (in doubt, so he
believes), recorded; then it moves back to Pedro and away again before those
jobs run. The move back's added finds the booking another person's and sends
nothing; the second taken off finds no newer added entry but the same given-up
job, so `believes` is true and Pedro gets a second "off your day". The same
happens inside the seconds a lost answer waits for its retry. The code matches
decision 5's amendment as written (an OR of the two conditions); it is the
amendment's F-243 promise that does not hold. Rare and harmless in effect (a
repeated "it is off", never a missed one), so P3.
**Suggested fix:** Decide it in decision 5. Either list it under "Accepted as
is", or let a doubtful try count only when it came after the person's latest
"off your day" entry (compare the job's last try time, `_private_jobs`
`updated_at`, with that entry's `occurredAt`; comparing move numbers is not
enough, since an added job can try after an off recorded at a higher number).
Add a test of the same name if it is fixed.
**Resolution:** Accepted by Frank 2026-10-08 as a known limit: it needs a lost Twilio answer (or a text that gave up) and the booking back on the person and off again before its texts run; the worst case is a repeated "off your day", never a missed one, which keeps his rule "when unsure, tell him". No code change.

### F-253 [P3] closed - findBookingChoices takes a moving booking on the owner path, but never leaves it out of the person's busy time or Google there

**File:** backend/lib/booking/find-booking-choices.ts:74-77 (its promise: :4-5; the customer path's handling: backend/lib/scheduling/find-free-times.ts:117,138-143)
**Found:** 2026-10-08 by independent review of chore/cleanup-before-9 (scope: 392cc7d..394cca2; lenses: quality, security, performance, tests)
**Why it matters:** The header promises "A booking being moved never stands in
its own way", and the input type accepts `byOwner: true` with `movingBooking`,
the combination F-145's Resolution names as the third caller (the owner's
move, features 11 and 12b). The customer path honours it through findFreeTimes'
ignoreBooking, and the rooms and the day count filter it. The owner path does
not: it answers busy on `findCommitments(organizationId, [id], from, to)` and
on the person's Google busy times with neither filter, so an owner moving
Pedro's 9:00 to 9:30 with Pedro would find Pedro's own held rows (and his own
Google event) in the span and be refused time_taken. No caller passes both
today (bookTime: byOwner without movingBooking; moveBooking: movingBooking
with byOwner false), so nothing behaves wrongly now; the risk is the next
caller trusting the header.
**Suggested fix:** When the owner's move is built, filter the owner path's
commitments with notTheMovingBooking and cross the moving booking's own time
off that person's Google busy, as findFreeTimes does, with a test of the owner
moving into a time overlapping the old one; or until then, type the input so
movingBooking only goes with byOwner false.
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9 (the second suggestion, until the owner's move): the input type is a union, so movingBooking goes only with byOwner false; the header says the owner's check does not take a moving booking yet (features 11 and 12b). Proved: a temporary call with byOwner true and movingBooking fails tsc (TS2345), removed after. Typecheck, build, format and backend 789 three runs pass. Closed 2026-10-08 by independent review of chore/cleanup-before-9 (9610596..177f12e; lenses: quality, security, performance, tests): find-booking-choices.ts:36-39 is a union on byOwner, and the header (:4-5) says the owner's check takes no moving booking yet. A temporary backend/lib/booking/zz-probe-f253.ts, deleted after, run through tsc --noEmit: byOwner true with movingBooking fails TS2345 (movingBooking not assignable to undefined), and byOwner typed boolean with movingBooking fails TS2345 (boolean not assignable to false), while byOwner false with movingBooking and byOwner boolean without it both pass. Both callers typecheck in the backend build: book-time.ts:189 passes byOwner: source === "manual" with no movingBooking, move-booking.ts:120-121 byOwner false with movingBooking; no test file passes movingBooking (tests sit outside tsc). The owner's move (features 11 and 12b) will have to widen the union and honour the moving booking on the owner path.

### F-254 [P3] closed - A connection busy when the stop begins is kept alive after its answer, so the API keeps taking new requests on it and a client that reuses it holds the stop to the 25 second limit

**File:** backend/lib/server/stop-gracefully.ts:1-2,20 (the claim's test: backend/lib/server/stop-gracefully.test.ts:50)
**Found:** 2026-10-08 by independent review of chore/cleanup-before-9 (scope: daa79f7..4fe2e61; lenses: quality, security, performance, tests)
**Why it matters:** The header says new requests are refused at once. Node's
server.close (Node 26.7.0, on the http Server @hono/node-server 2.1.1 returns)
refuses new connections and drops the idle ones when it is called, but a
connection that is busy then is not marked to close: its answer goes out with
Connection: keep-alive and the socket stays open. A scratch probe (an
http.Agent with keepAlive, one held request, close(), the held answer, then a
request a second on the same agent) had the closing server answer 30 more
requests on that socket over 30 seconds, and its close callback fired only
5 seconds (keepAliveTimeout) after the last one. So the stop always waits out
the keep-alive linger after the last answer (tests 1 and 2 take about 3
seconds each because fetch's client hangs up its idle socket then, not
because the API finished), and a client that keeps reusing the connection
(whether Railway's proxy does so with the old deployment after the switch is
not known) feeds it requests until the 25 second limit, when process.exit
cuts whichever one is running: F-193's cut booking, for a request accepted
after the stop began. Test 2 proves only that a new connection is refused,
which its name does not say.
**Suggested fix:** While stopping, end each kept connection once its answer is
out, for example server.closeIdleConnections() on a short unref'd interval,
cleared when close calls back or at the limit. The same probe with a 100 ms
sweep had close call back the moment the held answer went out, and the next
request was refused (ECONNREFUSED). Add a test that sends a second request on
the held request's connection (an http.Agent with keepAlive) and expects it
refused and the stop finished promptly, and make the header and test 2 say
what they prove.
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9: while stopping, stopGracefully sweeps server.closeIdleConnections() every 100 ms (unref, cleared on both endings), so a connection busy when the stop began is closed once its answer goes out; the header says so. Test "a connection kept open is closed after its answer, so nothing more comes in on it" (one keep-alive connection: the held answer arrives, the stop finishes within a second, a second request on the same agent fails); test 2 renamed "a new connection is refused once stopping has begun". Proved: a sweep that does nothing fails the new test (5.1 s; file restored, cmp identical). The file now runs in 1.3 s, not the clients' idle timeouts. server.ts types serve's result as node:http Server (it makes HTTP/2 or HTTPS only when asked). Build, format, backend 794 twice pass; the built API starts and /health answers 200. Re-reviewed 2026-10-08 by independent review of chore/cleanup-before-9 (b0806c2..c5cf49b; lenses: quality, security, performance, tests); stays fixed, for F-255. What holds is the code: @hono/node-server 2.1.1 (one copy, in the root node_modules) builds its server with (options.createServer || createServer) from node:http (dist/index.mjs:1292) and server.ts passes no createServer, so the `as Server` is true; the cast is needed because serve's ServerType also covers Http2Server, which has no closeIdleConnections. On Node 26.7.0 closeIdleConnections destroys only connections the parser lists idle and skips any whose response is not finished, and scratch probes against the built dist showed it cuts nothing in flight: a 64 MB answer to a slow reader arrived whole with the sweep running (12.6 s), and tests 1 and 4 hold their requests across several sweeps. A client reusing one connection back to back (handlers of 5, 20 and 200 ms, no gap, 11 runs) was caught idle and the stop finished within 0 to 420 ms with every answer whole; F-254's probe shape (one request a second) ends at the first sweep. The sweep is unref'd (hasRef false) and cleared in finally on all three endings: after finished, timed_out (4 sweeps in 350 ms) and a rejecting runner.stop, process.getActiveResourcesInfo() listed no Timeout and no sweep ran in the next 400 ms. A 100 ms sweep for at most 25 seconds costs nothing measurable; nothing here touches input or secrets. Each probe restored stop-gracefully.ts (sha256 22436fdf8c9c8d6f... before and after): a sweep that does nothing fails the new test (5.1 s); a sweep that closes every connection fails tests 1 and 4. What does not hold is the new test: a sweep that runs once (setTimeout) passes all five, F-255. Closed 2026-10-08 by independent review of chore/cleanup-before-9 (c5cf49b..d6e8bd1; lenses: quality, security, performance, tests): what held it, F-255, is closed. stop-gracefully.ts and server.ts are unchanged since c5cf49b (git diff empty), so the evidence above for the code still stands, and the sweep is now proved by its own test: with stop-gracefully.ts restored byte for byte after each (sha256 22436fdf8c9c8d6f... before and after), one sweep via setTimeout fails the keep-alive test (5.1 s), a sweep that does nothing fails it (5.1 s), and a sweep calling closeAllConnections fails it and tests 1 and 5. The file passed 10 runs in a row (1.4 to 2.0 s each), backend 794 passed and format:check passes.

### F-255 [P3] closed - The keep-alive test answers its held request before the first sweep, so a sweep that runs only once, or one that cuts busy connections, still passes it

**File:** backend/lib/server/stop-gracefully.test.ts:60-90 (the code it guards: backend/lib/server/stop-gracefully.ts:25-27)
**Found:** 2026-10-08 by independent review of chore/cleanup-before-9 (scope: b0806c2..c5cf49b; lenses: quality, security, performance, tests)
**Why it matters:** F-254's repair sweeps every 100 ms because a booking's
save can still be in flight well after the stop begins. The new test calls
finishFirst() straight after stopGracefully (:81-82), so its answer is out
within a millisecond and the first sweep at 100 ms already finds the
connection idle. Probes, each restored (stop-gracefully.ts sha256
22436fdf8c9c8d6f... before and after): setTimeout in place of setInterval,
one sweep only, passes all five tests; a sweep that calls
closeAllConnections passes this test too, caught only by tests 1 and 4.
With the one-shot sweep a request longer than 100 ms is back to F-254. Also,
send("/second") (:88) goes out only after the stop has finished, when
server.close's callback has already confirmed no connection is left, so it
opens a fresh connection to a closed port and is refused whatever happened
to the kept one; the one second timing line (:87) is what carries the proof.
**Suggested fix:** Hold the first answer across a few sweeps before
finishing it (wait 250 ms after stopGracefully, then finishFirst()). A
probe of exactly that, restored after (test file sha256 f76f71fc891be549...
before and after), passed on the code as it is, failed with one sweep
(5.1 s) and failed with closeAllConnections. Drop the /second line, or say
beside it that the timing is the proof.
**Resolution:** Fixed 2026-10-08 on chore/cleanup-before-9: the test (renamed "a connection kept open is closed once its answer goes out, however long that takes") waits 250 ms after the stop begins before the answer goes out, so it is past the first sweeps; the /second request is gone and a comment names the timing as the proof. Proved: one sweep (setTimeout) and a sweep that does nothing each fail it (5.1 s); file restored, cmp identical. 5/5 pass. Closed 2026-10-08 by independent review of chore/cleanup-before-9 (c5cf49b..d6e8bd1; lenses: quality, security, performance, tests): the test now holds its answer 250 ms after the stop begins, so the connection is still busy through the sweeps at 100 and 200 ms and is closed only by a later one. Each probe restored stop-gracefully.ts byte for byte (sha256 22436fdf8c9c8d6f... before and after): one sweep (setTimeout at IDLE_SWEEP_MS) fails it (5.1 s, the server's keep-alive timeout); a sweep that does nothing fails it (5.1 s); closeAllConnections now fails it too (the held answer is cut), with tests 1 and 5. On the real code it passed 10 file runs in a row (1.4 to 2.0 s each) and the whole backend suite (794). The /second request is gone and the comment names the one second bound as the proof, which is what it measures. What it cannot catch, like any fixed hold: a single sweep timed after 250 ms (a probe at 400 ms passed all five, restored after); that needs a changed constant, not a slip of setInterval, so not recorded. The test still waits a fixed 100 ms for its request to arrive rather than the arrival signal the helper uses; a late arrival makes it fail or time out, never pass falsely, so not recorded. Test file sha256 c71154f29ab7da45... unchanged by this review.

### F-256 [P2] closed - The customer's own booking page still lists the people and takes a pick for a service the business assigns, so decision 3's "the server refuses" has a second public way round it

**File:** backend/routes/public-booking-page-routes.ts:52-80,88-115 (the picker it feeds: frontend/components/booking-page/change-time-panel.tsx:254-264; the stated rule: blueprint/project-plan.md decision 32, backend/lib/errors/person-not-taken.ts:1-2)
**Found:** 2026-10-08 by independent step review of 9.1 (scope: ece1aa2..b2926cf; lenses: quality, security, performance, tests)
**Why it matters:** 9.1 enforces `business_assigns` on the times route and on
`POST /public/:slug/bookings` only. The 7b routes on the customer's private
link, `GET /public/bookings/:token/times` and `POST .../move`, call
findBookingMoveTimes and moveBooking, which read no personChoice: the times
answer carries findFreeTimes' `people` for every service
(find-free-times.ts:78), and moveBooking accepts any person who offers the
service (move-booking.ts:94). The shipped change-time panel renders that list
as a picker. So a Primo customer (every real row was backfilled
`business_assigns` by 0022) sees Primo's painters by name on their booking
page and can move the estimate onto the one they choose, which is what
decision 3 says no front end can do. Decision 32 in the project plan and the
person-not-taken header state the refusal without limiting it to the
component's routes. Not a regression (7b behaved this way before 9.1) and the
spec's out-of-scope line keeps 7a/7b "as built", so this is a gap between the
decision as written and the code, not a fault in 9.1's own routes.
**Suggested fix:** Frank's call, before feature 9 closes. Either extend the
rule to 7b (findBookingMoveTimes answers `people: []` and moveBooking refuses
a person other than the booking's own when the service is `business_assigns`,
with route tests like 9.1's), or narrow decision 32 and the person-not-taken
header to say the move page keeps its picker on purpose.
**Resolution:** Frank decided 2026-10-08: extend the rule to the 7b page, built as step 9.1b (added to the spec). Fixed 2026-10-08 in step 9.1b: the booking page's answer carries personChoice; findBookingMoveTimes answers `people: []` for a service the business assigns and refuses a person asked for (state person_not_taken); moveBooking refuses a person the same way after its "already there" check; both routes answer the same 400 as 9.1. change-time-panel.tsx shows no Who for such a service and asks the time only. Tests in public-booking-move-times-routes.test.ts and public-booking-move-routes.test.ts; proved: removing the refusals and the empty list fails three of them. Hand check on the running dev servers: painting-dev's page has no Who, clinic-dev's keeps Any available, Ana, Mei, Sofia.
Re-reviewed 2026-10-08 by independent review of 9.1b (scope: bd63ab6..d21a3e9; lenses: quality, security, performance, tests); stays fixed, for F-263. What holds: the way round decision 3 is gone on every public path that takes a person. The four are the form's times (public-booking-links-routes.ts:127-129) and booking (book-time.ts:177, after the replay), both from 9.1, and the 7b times and move (find-booking-move-times.ts:53-62, move-booking.ts:101-105), each reading the booking's own service without `active`, so a switched-off service (7b decision 13) holds too: a probe on a switched-off business_assigns service answered the pick 400, the times 200 with `people: []` and times, a move with nobody 200, and the page `personChoice: "business_assigns"`, `canMove: true`. Each guard bites: removing moveBooking's refusal, findBookingMoveTimes' refusal, or the emptied list each fails exactly its own test (every file restored by git checkout, sha256 identical). The 400 is reached only through a verified link, after the same 404/409s as before, so the identical-404 rule is untouched, and the page's new field says only what its panel already shows. What does not hold: the repair's default for a service the business assigns is any available with a confirm that names nobody, which brings back 7b/F-168's silent hand-over to another person (F-263). Two of the step's claims are pinned by no test (F-264). This entry can close with F-263.
Closed 2026-10-08 by re-review of 9.1b's fixes (scope: d21a3e9..0ec47db): the only things holding it were F-263 and F-264, both closed below on this pass's evidence. The delta touches none of the four refusals or the emptied list (git diff d21a3e9 0ec47db changes only find-booking-choices.ts among product files), and the move route's refusal now also has its order pinned (F-264). Backend 821 passed three times.

### F-257 [P3] closed - The seed sets who picks only on services it creates, so a database seeded before 0022 keeps the clinic as `business_assigns` and two new route tests fail on it

**File:** packages/shared/scripts/seed-dev.ts:565-575 (the tests that read it: backend/routes/public-booking-links-routes.test.ts:532,543)
**Found:** 2026-10-08 by independent step review of 9.1 (scope: ece1aa2..b2926cf; lenses: quality, security, performance, tests)
**Why it matters:** 0022 backfills every existing service `business_assigns`.
The seed writes `personChoice` only inside `if (!existingLink)`, so on any
database seeded before this step (Frank's other machine after pull, migrate,
seed) Riverbend Clinic (dev)'s ten services stay `business_assigns`. Shown on
the local `scheduleads_dev`: set clinic-dev's services to `business_assigns`
(what the migration leaves), ran `db:seed` (it reported everything "already
there"), and all ten were still `business_assigns`; restored to
`customer_picks` after, and the backend suite passed again (808). With that
state "a service the customer picks for says so" and "Mei alone does laser"
fail, and the try page in 9.5/9.6 would show the clinic with no people. The
seed's own pattern elsewhere is to upgrade rows seeded before a column existed
("so no machine needs a rebuild", seed-dev.ts:425-431, 473-485), and the
spec's 9.1 line says "the seed states both on every service".
**Suggested fix:** After the insert-or-find, bring an existing seeded service
to its business's value, the way the holidays are brought up: update
`personChoice` where it is still the migration's backfill and differs (or,
since dev databases are disposable, say in the step report that 0022 needs a
reseed from scratch on other machines). A rerun then leaves clinic-dev
`customer_picks`.
**Resolution:** Fixed 2026-10-08 in 9.1's review fixes, as suggested: after finding an existing seeded service, the seed brings its personChoice to its business's value where it differs (seed-dev.ts, the else branch beside the insert), reported as "who picks set on N services". Proved on the local scheduleads_dev: clinic-dev's ten services set to business_assigns, `db:seed` run, all ten back to customer_picks. Nothing sets the column by hand until feature 12, so no owner's choice is overwritten.
Re-reviewed 2026-10-08 by re-review of 9.1's fixes (b2926cf..5725ad2; lenses: quality, security, performance, tests); stays fixed, for F-260 and F-261. What holds: the update runs on `tx` inside the seed's one db.transaction (seed-dev.ts:340), and its bookingLinkId comes from the select scoped to the business and the seeded slug, so it touches only that business's own seeded services. Shown again on the local scheduleads_dev: clinic-dev's ten services set to business_assigns, `db:seed` run, all ten back to customer_picks, painting-dev's three untouched. What does not hold: the repair brings any differing value back, not only the migration's backfill, so a hand-set choice is reverted (F-260), and its report line reads "(created who picks set on 10 services)" (F-261).
Re-reviewed 2026-10-08 by re-review of 9.1's second fixes (5725ad2..84198ad; lenses: quality, security, performance, tests); stays fixed, for F-260. What holds: F-257's own case. On the local scheduleads_dev, clinic-dev's ten services set to business_assigns (what 0022 leaves) and `db:seed` run: all ten back to customer_picks, printed as "who picks the person set on 10 existing services". F-261 is closed. What does not hold: F-260, the repair still reverts a choice made by hand in one direction (see there).
Closed 2026-10-08 by independent review of 9.1b (scope: bd63ab6..d21a3e9): re-read the per-business rule from bd63ab6 (seed-dev.ts:554-594): `bringChoicesUp` only when the business is seeded customer_picks and every one of its services still holds business_assigns, then each existing seeded service is updated on `tx` by an id from the business-scoped select. On the local scheduleads_dev, clinic-dev's ten set to business_assigns (what 0022 leaves) and painting-dev's three to customer_picks, `db:seed`: the clinic's ten back to customer_picks, printed "who picks the person set on 10 existing services", painting's three left customer_picks. F-260, the one thing keeping this open, is closed below. Data restored: clinic-dev 10 customer_picks, painting-dev 3 business_assigns.

### F-258 [P3] closed - The new person-choice check runs before bookTime's request-key lookup, so a retried booking form whose service changed in between gets a 404 or 400 instead of its booking

**File:** backend/routes/public-bookings-routes.ts:58-60 (the rule it overtakes: backend/lib/booking/book-time.ts:134-149)
**Found:** 2026-10-08 by independent step review of 9.1 (scope: ece1aa2..b2926cf; lenses: quality, security, performance, tests)
**Why it matters:** bookTime asks for a booking already made with the form's
key first ("Asked first", decision 7/9: a retry after a lost answer gets the
booking that won), before it reads the service, so before 9.1 a retry
succeeded even if the service had been switched off meanwhile. The route now
calls findPersonChoice before bookTime: a switched-off service answers 404,
and a service switched from `customer_picks` to `business_assigns` answers
400 to a retry that names its person, though the booking exists. The customer
is told it failed and may book again. Narrow today: nothing but a hand edit at
client setup changes either column until feature 12's settings screen, and
the window is one lost answer long.
**Suggested fix:** Keep the replay first: either move the two checks into
bookTime after `earlier` (returning a new reason the route maps to the 400),
or have the route skip them when the request key already has a booking. A
route test: book, switch the service off (or to `business_assigns`), resend
the same form, expect 200 with `alreadyBooked` and the same booking.
**Resolution:** Fixed 2026-10-08 in 9.1's review fixes, the first suggested way: the route's pre-check is gone; bookTime refuses a customer's pick for a business_assigns service after the form's own booking is looked up, with a new reason `person_not_taken` the route maps to the same 400 (book-time.ts, after `if (!service)`). The owner's path may still pick. A switched-off service is again answered by the replay first. Tests: the route's "still gets its booking, after the business assigns and after the service is switched off" and bookTime's "a booked form sent again after its service changed still gets its booking" and "a customer's pick for a service the business assigns answers person_not_taken and writes nothing; the owner may pick"; proved: restoring the route pre-check and removing bookTime's check fail the route retry test and the bookTime refusal test.
Closed 2026-10-08 by re-review of 9.1's fixes: the route no longer reads the service before bookTime (findPersonChoice is now used only by the times route), and bookTime's check sits after `earlier` and after the service read (book-time.ts:155-178), so a resent form gets its booking whatever changed. `person_not_taken` has one production caller to map, the public bookings route, and its switch is exhaustive by type: removing the new case fails `tsc` (TS2339 on result.booking). Each test bites (every file restored by git checkout, status clean after): asking the replay after the service checks fails the route retry test and bookTime's retry test; dropping the refusal fails the route's 400 test and bookTime's refusal test; applying it to source manual too fails bookTime's "the owner may pick". Left as is: like NOT_FOUND before it, the new refusal is not re-asked through refuseUnlessBooked, so only a service switched to business_assigns inside one double-submit's own window could refuse the second copy; not worth an entry. One query fewer per booking. Backend 811 passed three times, build and format:check pass.

### F-259 [P3] closed - workerTextEntriesOf reads the activity rows with no order, and its callers compare them as an ordered list

**File:** backend/lib/jobs/worker-text-job.test.ts:168-176 (compared in order at :950-953 and elsewhere)
**Found:** 2026-10-08 by independent step review of 9.1 (scope: ece1aa2..b2926cf; lenses: quality, security, performance, tests)
**Why it matters:** The builder saw "a lost new booking found on its retry
after a cancel still texts the person off your day" fail once with
`[worker_removed, worker_added]`. The helper's select has no ORDER BY, so
Postgres may return the two rows in either order (other test files insert
and delete activity rows in parallel, so free space is reused), while the
expectation is an ordered array. Pre-existing: the helper dates from 8c.2
(6912cfa); 9.1 only added the two new columns to this file's service insert,
which touches neither the jobs nor the activity table. Not reproduced in five
full backend runs here (808 passed each time).
**Suggested fix:** Order the helper's select by `activity.createdAt`, then
`activity.id`, or compare the kinds as a set where order is not the claim.
**Resolution:** Fixed 2026-10-08 in 9.1's review fixes: the helper orders by `activity.occurredAt`, then `activity.createdAt` (worker-text-job.test.ts:168-177). In the flaky test the retry records worker_added before the cancel's worker_removed runs, so that order is the claim. Not reproducible on demand (it failed once in this session), so the fix is shown by reading, not by a failing run; three full backend runs after it passed (811 each).
Closed 2026-10-08 by re-review of 9.1's fixes: the order is the one the tests claim. Both worker texts of a booking run in one lane (enqueue-worker-text.ts:16, queueName per booking), so one after the other, and the retry's worker_added is recorded before the cancel's worker_removed job reads it; send-worker-text.ts records each through recordActivity with no transaction, so occurredAt is the JS clock at that moment (record-activity.ts:29) and createdAt is a separate statement's now(), microseconds apart, which settles a same-millisecond occurredAt; no practical tie is left (id, a random UUID, would not have ordered them). The helper does read in order: reversing it (both columns descending) fails "a cancel texts the person off your day" and "a lost new booking found on its retry after a cancel still texts the person off your day" (file restored by git checkout). Backend 811 passed three times; the once-seen flake did not recur.

### F-260 [P3] closed - The seed's new person-choice upgrade reverts any differing value, so a choice set by hand on a seeded service is undone by the next reseed

**File:** packages/shared/scripts/seed-dev.ts:576-591
**Found:** 2026-10-08 by re-review of 9.1's fixes (scope: b2926cf..5725ad2; lenses: quality, security, performance, tests)
**Why it matters:** The seed's other upgrades touch only rows still in the
state from before their column existed, so hand edits survive a reseed: the
first person's login link only where userId is null (:430), the holidays only
where none are picked, the stages only when there are none ("so stages renamed
by hand survive a reseed", :434), ticks "added by hand stays" (:600). F-257's
suggested fix asked for the same: update "where it is still the migration's
backfill and differs". The repair's where is only `ne(personChoice,
business.personChoice)`, so it reverts any value. Shown on the local
scheduleads_dev: painting-dev's three services set to customer_picks (as when
trying the picker on Summit's estimate in 9.5/9.6), `db:seed` run, all three
back to business_assigns, reported "who picks set on 3 services". Harmless
today (dev only, nothing but a hand edit sets the column), but from feature 12
a choice made on the Settings screen in dev is silently undone by every
reseed. F-257's Resolution says "no owner's choice is overwritten", which holds
only until then.
**Suggested fix:** Add `eq(bookingLink.personChoice, "business_assigns")` (the
backfill) to the update's where, beside the `ne`, so only a service still as
0022 left it is brought up; the clinic case F-257 needed still works, and a
painting service set to customer_picks by hand stays. Adjust the comment to
say so.
**Resolution:** Fixed 2026-10-08 in 9.1's second review fixes, as suggested: the update also requires the value still to be `business_assigns`, the migration's leftover, so a choice made by hand survives. Proved on the local scheduleads_dev: clinic-dev's ten services set to business_assigns and painting-dev's three to customer_picks, `db:seed` run: the clinic's ten came back to customer_picks, painting's three stayed customer_picks; painting restored to business_assigns by hand after.
Reopened 2026-10-08 by re-review of 9.1's second fixes (5725ad2..84198ad; lenses: quality, security, performance, tests): the painting case holds, the clinic case does not. A row-level `eq(personChoice, "business_assigns")` cannot tell 0022's backfill from a business_assigns chosen by hand, so on a customer_picks business a service set to business_assigns by hand is still reverted, and the new comment ("a choice made by hand survives a reseed", seed-dev.ts:577-579) says the opposite. Shown on the local scheduleads_dev: the probe above repeated (clinic ten business_assigns, painting three customer_picks, `db:seed`: clinic ten customer_picks, painting three customer_picks, so that half holds); then painting restored to business_assigns and only clinic-dev's laser-hair-removal set to business_assigns (as when trying the assigned path on the clinic in 9.5/9.6, or from feature 12 on its Settings screen), `db:seed` run: it came back to customer_picks, printed "who picks the person set on 1 existing services". So this finding's "Why it matters" still holds for the clinic. Data left as found: clinic-dev's ten customer_picks, painting-dev's three business_assigns. The suggested row check was this finding's own and was applied faithfully; it was not enough. Further suggested fix: decide per business, the way the stages are ("only when there are none"): bring a business's existing seeded services up only when every one of them is still business_assigns and the business is customer_picks, the state 0022 leaves and no hand edit of one service produces; or, if the row rule is kept, reword the comment to name the one case it cannot tell apart. Either way the `ne` beside the new `eq` is now redundant (on a business_assigns business the where can never match), and "1 existing services" reads oddly, like the file's other counts.
Fixed again 2026-10-08 after the re-review, its new suggested fix: the seed decides per business, like the stages. A business's existing services are brought to its seeded choice only while every one of them still holds business_assigns, so one choice made by hand on any service keeps them all; the redundant `ne` is gone and the comment says so. Proved on the local scheduleads_dev: (a) clinic-dev all business_assigns, painting-dev all customer_picks: reseed brings the clinic's ten to customer_picks, painting stays customer_picks; (b) one clinic service set back to business_assigns by hand among nine customer_picks: reseed leaves it. Data restored after (clinic 10 customer_picks, painting 3 business_assigns).
Closed 2026-10-08 by independent review of 9.1b (scope: bd63ab6..d21a3e9): both of the reopening's cases now hold, shown on the local scheduleads_dev. (a) clinic-dev's ten set to business_assigns and painting-dev's three to customer_picks, `db:seed`: clinic ten customer_picks, painting three still customer_picks (a choice by hand on a business seeded business_assigns is never touched, since `bringChoicesUp` needs the business to be customer_picks). (b) painting back to business_assigns, only clinic-dev's laser-hair-removal set to business_assigns among nine customer_picks, `db:seed`: no "who picks" line printed, laser still business_assigns, the nine unchanged. The redundant `ne` is gone (the update's where is the id alone, seed-dev.ts:589-592), and the comment (:556-559) now says what the rule does. What it still cannot tell apart, by design and like the stages: every service of a customer_picks business set to business_assigns by hand reads as 0022's leftover and is brought back; the comment's "while every service it has still holds the business_assigns migration 0022 gave them" names that condition, so not recorded. Data restored: clinic-dev 10 customer_picks, painting-dev 3 business_assigns.

### F-261 [P3] closed - The seed's report line reads "(created who picks set on N services)"

**File:** packages/shared/scripts/seed-dev.ts:622 (the sentence it lands in: :629)
**Found:** 2026-10-08 by re-review of 9.1's fixes (scope: b2926cf..5725ad2; lenses: quality, security, performance, tests)
**Why it matters:** Every entry of `made` is printed after "(created ", and
the new one is not a thing created but a change. Shown on the local
scheduleads_dev after setting clinic-dev to business_assigns and reseeding:
`owner@example.com    ordinary owner, owns "Riverbend Clinic (dev)"  (created
who picks set on 10 services)`. The seed's report is what tells Frank on a new
machine what a reseed did, and this line reads as a typo.
**Suggested fix:** Word the entry so it reads after "created", or print
upgrades apart from creations, e.g. "(created ...; brought up: who picks on 10
services)". The existing upgrade entries ("first person's login link",
"holiday picks") read as nouns, so a noun phrase also fits.
**Resolution:** Fixed 2026-10-08 in 9.1's second review fixes: the count is no longer in the "(created ...)" list; it prints on its own line, "who picks the person set on N existing services", seen in the probe's output.
Closed 2026-10-08 by re-review of 9.1's second fixes: `choicesSet` is gone from `made` (seed-dev.ts:610-626) and prints on its own indented line after the owner's line, only when non-zero (:631). On the local scheduleads_dev after setting clinic-dev to business_assigns and reseeding, the report read `owner@example.com    ordinary owner, owns "Riverbend Clinic (dev)"  (already there)` then `  who picks the person set on 10 existing services`; painting-dev printed no extra line. "1 existing services" for a count of one is the file's own habit ("N services"), noted under F-260, not a reason to keep this open.

### F-262 [P3] closed - "the move's answer does not wait for Google" gives Google's PATCH only vi.waitFor's default second, so a slow full run fails it

**File:** backend/lib/calendar/move-booking-event.test.ts:489 (the same wait at :737; remove-booking-event.test.ts:267, write-booking-event.test.ts:226)
**Found:** 2026-10-08 by re-review of 9.1's second fixes (scope: 5725ad2..84198ad; lenses: quality, security, performance, tests; seen in the gate run, not in the delta)
**Why it matters:** The test holds Google's answer, works the event jobs, and
waits for the PATCH with `vi.waitFor` and no options, so 1000 ms. Before the
PATCH the job is claimed and its rows are read, all
against the shared local Postgres while 70 other files run beside it. In this
pass's full backend run (89 s, the file alone 70.6 s) it failed after 2189 ms:
`expected false to be true` at :489, 1 failed, 810 passed. The next full run
(56.5 s) passed 811. Nothing in the delta reaches it (the seed is not run by
the tests; the test makes its own clinic). A gate that fails on load alone
teaches the next reader to rerun rather than read, which is how a real failure
gets waved through. The test dates from 7b.3, reworked in 8a.3 (40f598e).
**Suggested fix:** Give the four `vi.waitFor` calls that wait on a job's
Google call a timeout sized for a loaded run, e.g. `{ timeout: 10_000 }`; the
claim each test makes (the answer came before Google) is unchanged, since that
is asserted before the wait.
**Resolution:** Fixed 2026-10-08 in 9.1's third review fixes, as suggested: the four `vi.waitFor` calls (move-booking-event.test.ts two, remove-booking-event.test.ts, write-booking-event.test.ts) wait up to 10 seconds; each test's claim, that the answer came before Google, is asserted before the wait and unchanged. Shown by reading: the 1-second default failed once in a slow full run, and is not reproducible on demand.
Closed 2026-10-08 by independent review of 9.1b (scope: bd63ab6..d21a3e9): all four waits on a job's Google call now pass `{ timeout: 10_000 }` (move-booking-event.test.ts:489-491 and :739-741, remove-booking-event.test.ts:267, write-booking-event.test.ts:226), and they are the only `vi.waitFor` calls in the backend's tests. The three "does not wait for Google" tests still assert "answered before Google is asked" before their wait (the fourth, "two of one booking's jobs never run at the same time", only waits for the PATCH to begin) (move-booking-event.test.ts:486-487, remove-booking-event.test.ts:264, write-booking-event.test.ts:223), so the claim is unchanged; the 10 seconds sit inside the backend's own `testTimeout: 30_000` (vitest.config.ts), so the wait, not the test, is what gives up. Three full backend runs in this review passed 816 each (31 to 32 s); a timing flake cannot be shown fixed by passing runs, only by the wider bound, which is in place.

### F-263 [P2] closed - On a service the business assigns, "Change the time" always moves with any available, so the customer's booked person can be swapped for another while free, and the confirm names nobody

**File:** frontend/components/booking-page/change-time-panel.tsx:80,175-181 (the order it inherits: backend/lib/booking/find-booking-choices.ts:120-135, backend/lib/scheduling/order-any-available.ts; the rule it re-opens: blueprint/history/features/07b-reschedule.md decision 14, 7b/F-168)
**Found:** 2026-10-08 by independent review of 9.1b (scope: bd63ab6..d21a3e9; lenses: quality, security, performance, tests)
**Why it matters:** Before 9.1b every Primo booking's panel opened on her own
person (7b decision 14), so keeping the default kept the painter. Now, for a
business_assigns service, the panel can only ask with nobody picked, and a
move with nobody picked orders the free people by fewest bookings that day,
then name, with no preference for the person who holds the booking. Decision
14 rejected exactly this: "opening on Any available, which could hand her to
another person on a tie without saying so". Shown with a scratch test in the
move routes (removed after): Jane's facial with Ana at 9:00, Ana also booked
at 13:00, the service set to business_assigns, a move to 11:00 with nobody
picked while Ana is free at 11:00: the booking went to Mei. The confirm reads
"Move to <time>?" with no name, while the page still says who is coming (the
spec keeps the name: "the customer is told who is coming"). For Primo, where
every real service is business_assigns, each time-only move can quietly
change the estimator, and with it send "off your day" and "added" texts to
two painters and remove and rewrite the Google event. Not a broken line of
9.1b's spec (it says "asks the times with nobody picked"), but a consequence
the spec does not name and decision 14 had ruled out.
**Suggested fix:** Frank's call. The smallest that keeps decision 3 (no pick
offered): on a move with nobody picked, try the booking's own person first
when free (findBookingChoices, a `preferPersonId` for `movingBooking`), so
"any available" means "whoever is free, keeping yours if you can"; a route
test like the probe above. Or keep the swap and say so in the confirm and the
spec ("the business may send someone else").
**Resolution:** Frank decided 2026-10-08: keep her person first (option A). Fixed 2026-10-08: findBookingChoices puts the moving booking's own person first when a move names nobody, so a time-only move keeps who comes while they are free, for both settings (7b decision 14 holds again); someone else only when they are busy. Tests in public-booking-move-routes.test.ts: "a move with nobody picked keeps her own person when free" (business_assigns and customer_picks, Ana with more bookings than Mei still kept) and "a move with nobody picked goes to someone else only when her own person is busy"; proved: dropping the preference fails both cases of the first.
Closed 2026-10-08 by re-review of 9.1b's fixes (scope: d21a3e9..0ec47db): the swap while free is gone. find-booking-choices.ts:137-146 puts every choice of `movingBooking.personId` (with each free room, in room order) before the others, only when the move names nobody; the owner's path cannot reach it (`movingBooking?: never` on `byOwner: true`, :37) and bookTime never passes one (book-time.ts:191-202), so a new booking keeps the fewest-bookings order. Proved: forcing the early return (`if (!ownPerson || true)`) fails both cases of "a move with nobody picked keeps her own person when free" (public-booking-move-routes.test.ts:347), the review's own probe in route form (Ana with more bookings than Mei, Ana free at 11:00, kept); file restored, sha256 identical. Scratch probes in the move route tests (removed after): with Room 3 and Ana busier, the move kept Ana and held Ana plus Room 3; with Ana no longer offering the facial, it went to Mei, as decision 14's fallback says; with Ana busy at 11:00 it went to Mei (the saved test at :363). When the person is kept, moveBooking's later steps take the same-person path already used by a picked move: `personChanged` false (move-booking.ts:187), so one "moved" text to her person, the event moved in place, no remove unless no event id was saved. The confirm still names nobody on a business_assigns service, which option A accepts: whoever is free, keeping hers if she can, and the page names who comes after. For customer_picks the explicit "Any available" now also keeps her person when free (the resolution's "for both settings"); no 7b test or decision is broken by it, but it leaves two loose ends recorded as F-266 and F-267. Her own person's calendar unreadable is a separate case, F-265.

### F-264 [P3] closed - Two of 9.1b's claims are pinned by no test: the page answering business_assigns, and the refusal sitting after "already there"

**File:** backend/routes/public-booking-page-routes.test.ts:172 (the field: backend/lib/booking/find-booking-page.ts:100; the order: backend/lib/booking/move-booking.ts:76-79,101-105)
**Found:** 2026-10-08 by independent review of 9.1b (scope: bd63ab6..d21a3e9; lenses: quality, security, performance, tests)
**Why it matters:** The whole frontend change switches on
`booking.personChoice`, but the page test only expects `customer_picks`.
Scratch mutation, restored after: findBookingPage answering `"customer_picks"`
for every booking passed the full backend suite (816). On a business_assigns
service that would bring back the Who list and ask the times with her own
person, which the times route now refuses with a 400 the client maps to "The
free times can't load right now", on every Primo page. Second, the code and
the spec say the refusal comes after "already there" so a repeat answers as
before; the only repeat test sends nobody, so the order is free. Scratch
mutation, restored after: "already there" moved below the refusal passed all
20 move route tests.
**Suggested fix:** In the page route tests, one booking on a business_assigns
service expecting `personChoice: "business_assigns"`. In the move route
tests, move with a person on a customer_picks service, switch it to
business_assigns, send the same move again, expect 200 and one booking_moved
entry.
**Resolution:** Fixed 2026-10-08 after 9.1b's review: public-booking-page-routes.test.ts "the page says who picks: a service the business assigns says business_assigns" and public-booking-move-routes.test.ts "a picked person on a service the business assigns, already there, answers the same". Proved: the review's two mutations (findBookingPage hardcoded to customer_picks; "already there" moved below the refusal) each fail their test; files restored.
Closed 2026-10-08 by re-review of 9.1b's fixes (scope: d21a3e9..0ec47db): both claims are now pinned. findBookingPage answering `"customer_picks" as const` for every booking fails "the page says who picks: a service the business assigns says business_assigns" (public-booking-page-routes.test.ts:156, 1 failed of 11); the test works on its own business (made customer_picks, restored to customer_picks in `finally`), never the seeded painting-dev. Moving `if (alreadyThere(current))` below the person_not_taken refusal in move-booking.ts fails "a picked person on a service the business assigns, already there, answers the same" (public-booking-move-routes.test.ts:333, 1 failed of 24). That test repeats with her own person at her own time instead of the suggested move-then-switch, which pins the same order (200, sequence 0, no booking_moved entry). Both files restored by git checkout, sha256 identical.

### F-265 [P3] closed - A move with nobody picked hands the booking to someone else when her own person's calendar cannot be read

**File:** backend/lib/booking/find-booking-choices.ts:84-92,137-146 (the move: backend/lib/booking/move-booking.ts:122-135,187,238-250)
**Found:** 2026-10-08 by re-review of 9.1b's fixes (scope: d21a3e9..0ec47db; lenses: quality, security, performance, tests)
**Why it matters:** F-263's repair keeps her person first only when the
free check answers "free". When her person's Google cannot be read, the
check answers "unreadable", she is left out of the free people as any
available always leaves people out, and the move goes to whoever else is
free with no word to the customer. Shown with a scratch test in the move
routes (removed after): Jane's facial with Ana at 9:00, the service set to
business_assigns, Ana's connection `needs_reconnect`, a move to 11:00 with
nobody picked: 200, the booking went to Mei, one booking_moved entry. Before
9.1b the panel asked with her own person and the same move answered 503
"try again" (7b's "a picked person whose calendar cannot be read answers 503
and nothing changes"). A `needs_reconnect` connection lasts until the
person reconnects, so for Primo, where every service is business_assigns,
every time-only move of that estimator's bookings in that window can change
the estimator, with "off your day" and "added" texts to two painters and the
event moved between calendars, which is the hand-over decision 14 and F-263
rule out while the person may well be free. The customer_picks "Any
available" case does the same, but there it is her explicit pick (unchanged
since 7b).
**Suggested fix:** Frank's call, one of: on a move with nobody picked, when
her own person still offers the service and their calendar is unreadable,
answer `unavailable` (503, "try again", as a picked person does) instead of
handing over; or accept the hand-over as any available's rule and say so in
the spec. Either way a route test like the probe above.
**Resolution:** Fixed 2026-10-08 under Frank's F-263 decision ("someone else only if her person is busy"; an unreadable calendar is not busy): findBookingChoices answers `unavailable` (the move's 503, "try again") when a move names nobody and its own person's calendar cannot be read, before any other person is tried. Test: public-booking-move-routes.test.ts "a move with nobody picked answers try again when her own person's calendar cannot be read" (503, the booking unchanged); proved: removing the check fails it.
Re-reviewed 2026-10-08 by independent review of 9.2 (scope: ef70707..d1c13c6, with the repair in 0ec47db..ef70707); stays fixed, for F-269. What holds: the move itself no longer hands the booking over. find-booking-choices.ts:90-92 answers `unavailable` when a move names nobody and its own person is among the candidates with an unreadable calendar; a person who no longer offers the service gives `indexOf` -1, so the move goes on to whoever is free, as decision 14's fallback says; bookTime never passes `movingBooking`, so a new booking is untouched. Removing the two lines fails the new test (1 failed of 25; file restored, sha256 identical). What does not hold: the repair made the move refuse while the move page's times, asked with nobody picked, still list the other people's times, so every time offered then answers "try again" (F-269).
Closed 2026-10-08 by the review of step 9.3 (scope: 3de57a5..21b8d6d): the hand-over stays fixed. find-booking-choices.ts:90-91 answers `unavailable` before any other person is tried when a move names nobody and its own person's calendar cannot be read. Removing those two lines fails "a move with nobody picked answers try again when her own person's calendar cannot be read" (public-booking-move-routes.test.ts:363, 1 failed of 25); file restored, sha256 identical. The page side is F-269, closed in the same pass. The finding number the repair left in the comment at :89 is F-274.

### F-266 [P3] closed - The day's counts no longer need to leave out the moving booking, so 7b/F-142's guard and its test pin nothing

**File:** backend/lib/booking/find-booking-choices.ts:120-131 (the test: backend/routes/public-booking-move-routes.test.ts:278-286; the comment: :351)
**Found:** 2026-10-08 by re-review of 9.1b's fixes (scope: d21a3e9..0ec47db; lenses: quality, security, performance, tests)
**Why it matters:** The moving booking's rows belong to her own person,
and her own person now goes first whenever free, whatever the counts; a
picked move has one candidate, so its order never matters. So
`.filter(notTheMovingBooking)` on the day's rows, and "(the moving booking
not counted)" in the comment above it, can no longer change any outcome.
Shown: removing that filter passes the full backend suite (821); at
d21a3e9 the same removal failed "any available does not count the booking
being moved". That saved test now passes because of the preference, not the
count it names, so 7b/F-142's coverage is gone without a word. Smaller, in
the new test: "Ana now has two bookings that day, Mei one" (:351); Mei has
none (makeClinic books only Ana), and with Jane's own left out Ana has one.
The test still bites (Ana counts higher either way).
**Suggested fix:** Drop the day-row filter and the comment's parenthesis,
and retitle or fold "any available does not count the booking being moved"
into the keep-own tests (what it now shows is that she stays with Ana); or
keep the filter as a guard for a future caller and say in the comment that
no current caller depends on it. Correct the test comment to "Ana now has
two bookings that day, Mei none".
**Resolution:** Fixed 2026-10-08: the day counts no longer leave out the moving booking (find-booking-choices.ts, the comment says why: it is its own person's, first when free and not counted when busy); the room check keeps its filter. The 7b test "any available does not count the booking being moved" keeps its name and its outcome, its comment now says the own-person rule decides it; the new test's comment says "Mei none".
Re-reviewed 2026-10-08 by independent review of 9.2 (scope: ef70707..d1c13c6, with the repair in 0ec47db..ef70707); stays fixed, for the test's title only. What holds: the day-row filter is gone (find-booking-choices.ts:128-133) and nothing depended on it: the day's counts read only `freePeople`, so the moving booking's rows count only for its own person, who goes first when free (:140-147) and is not in `freePeople` when busy; its room rows are never read there (the select is by person). `notTheMovingBooking` still guards the room check (:111). The comments at :125-127 and in both tests now say what decides. Backend 843 passed three times. What does not hold: the test is still titled "any available does not count the booking being moved" (public-booking-move-routes.test.ts:277), while the code now does count it; the title claims the guard this repair removed. Retitle it to what it shows (she stays with her own person while free), or fold it into the keep-own tests; then this closes.
Fixed again 2026-10-08 after 9.2's review: the test is renamed "a move with nobody picked stays with her own person, though counting her own booking would favour another", which is what decides it now.
Closed 2026-10-08 by the review of step 9.3 (scope: 3de57a5..21b8d6d): the test is titled "a move with nobody picked stays with her own person, though counting her own booking would favour another" (public-booking-move-routes.test.ts:278), which is what decides it; the day-row filter stays gone (find-booking-choices.ts:128-133) and the room check keeps `notTheMovingBooking`. Full backend suite 865 passed. The "(F-266)" the repair put in the comment at :127 is F-274.

### F-267 [P3] closed - The spec still says a customer_picks move is unchanged and a business_assigns move is plain any available; Frank's F-263 decision is in no plan file

**File:** blueprint/context/current-feature.md:169-189 (step 9.1b)
**Found:** 2026-10-08 by re-review of 9.1b's fixes (scope: d21a3e9..0ec47db; lenses: quality, security, performance, tests)
**Why it matters:** The delta changes what "any available" means on every
move, for both settings: her own person first while free. The spec's 9.1b
still says "A service the customer picks for is unchanged" and "asks the
times with nobody picked (any available)", and Frank's decision (option A,
2026-10-08) lives only in this ledger and a commit message. /complete
archives the spec as the feature's history; without a line there, the
permanent record says the opposite of the code, and 7b's archive still says
the backend's any-available order is unchanged (7b/F-168's closing note),
so the next reader of either file is told the old rule. AGENTS.md asks for
the spec to be amended when a review shows it wrong.
**Suggested fix:** Add to step 9.1b (or the feature's decisions) one line:
a move with nobody picked keeps her own person first while free, for both
settings, someone else only when that person is busy (Frank, 2026-10-08,
F-263), plus whatever F-265 settles for an unreadable calendar.
**Resolution:** Fixed 2026-10-08: step 9.1b in current-feature.md records Frank's F-263 decision and F-265 (a move with nobody picked keeps its own person while free under either setting; someone else only when busy; try again when their calendar cannot be read). The 7b archive is history and stays as written.
Closed 2026-10-08 by independent review of 9.2 (scope: ef70707..d1c13c6): current-feature.md:180-183, inside step 9.1b, now reads "Amended after the step's review (Frank, 2026-10-08, F-263 option A): a move with nobody picked, under either setting, keeps the booking's own person while they are free; someone else only when they are busy, and 'try again' when their calendar cannot be read (F-265)", which is what find-booking-choices.ts:88-92 and :140-147 do. The older sentences above it ("A service the customer picks for is unchanged", "asks the times with nobody picked") stay, but the amendment follows them in the same step and names the decision, so the archived spec no longer says the opposite of the code. Leaving 7b's archive as written is right: it records 7b.

### F-268 [P3] closed - Two of 9.2's rules are pinned by no test: the answers checked after the form's own booking, and the owner's booking needing none

**File:** backend/lib/booking/book-time.ts:185-191 (the replay it must follow: :161-162)
**Found:** 2026-10-08 by independent review of 9.2 (scope: ef70707..d1c13c6; lenses: quality, security, performance, tests)
**Why it matters:** Both are deliberate choices of this step, named in the
code's comments and the step report. The answer checks sit in bookTime after
the request-key replay, so a retried form gets its booking whatever questions
changed meanwhile (the F-258 lesson); and `requireAnswers: source !==
"manual"` lets the owner book from a phone call without answering. Scratch
mutations, each restored after (sha256 identical): moving the whole answer
check above `const earlier = await bookedByThisForm()` passed the full
backend suite (843); `requireAnswers: true` for every source passed it too
(843). checkAnswers' own unit test covers the flag, not bookTime's wiring of
it. So a later edit could put the F-258 bug back for questions (a form booked,
its answer lost, a question made required or removed meanwhile: the retry is
told "Answer: ..." or "not one of this business's questions" though it is
booked, and may book again), or make feature 11's owner booking demand
answers, and nothing would say so. The spec's Testing section asks that each
new rule's test be shown able to fail.
**Suggested fix:** A route test: book with answers, then make the optional
question required (or delete one), resend the same form, expect 200 with
`alreadyBooked` and the same booking id. A bookTime test: source `manual` in a
business with a required question, no answers, expect booked and
`lead.answers` `[]`. Show each fails under the mutation above.
**Resolution:** Fixed 2026-10-08 after 9.2's review: public-bookings-routes.test.ts "a booked form sent again after a required question was added still gets its booking" and book-time.test.ts "a customer must answer a required question; the owner need not" (the owner's lead keeps []). Proved: moving the answer check above the replay fails the first only; requiring answers for every source fails the second only.
Closed 2026-10-08 by the review of step 9.3 (scope: 3de57a5..21b8d6d): both rules are pinned. A copy of the answer check inserted above `const earlier = await bookedByThisForm()` (book-time.ts:161) fails only "a booked form sent again after a required question was added still gets its booking" (public-bookings-routes.test.ts:352); `requireAnswers: true` for every source fails only "a customer must answer a required question; the owner need not" (book-time.test.ts); each run 1 failed of 54, file restored, sha256 identical.

### F-269 [P3] closed - With her own person's calendar unreadable, the move page still lists other people's times, and every one of them answers "try again"

**File:** backend/lib/booking/find-booking-move-times.ts:64-77 (the move's refusal: backend/lib/booking/find-booking-choices.ts:88-92; any available leaving an unreadable person out: backend/lib/scheduling/find-free-times.ts:145-155)
**Found:** 2026-10-08 by independent review of 9.2 (scope: ef70707..d1c13c6, F-265's repair in it; lenses: quality, security, performance, tests)
**Why it matters:** F-265's repair answers 503 to a move with nobody
picked when the booking's own person's calendar cannot be read. The times the
page offers for that same move are asked with nobody picked too, and any
available simply leaves an unreadable person out, so the list shows everyone
else's free times. Shown with a scratch test in the move routes (removed
after, sha256 identical): Jane's facial with Ana, the service set to
business_assigns, Ana's connection `needs_reconnect`: the move times route
answered 200 with 11:00 offered (people `[]`), and the move to 11:00 answered
503. For Primo, where every service is business_assigns, each customer of that
estimator sees a full list in which every pick ends in "The move didn't go
through. Please try again, or call the business.", for as long as the
connection waits to be reconnected. Before 9.1b the panel asked with her own
person, so the same case showed "can't load" at the times step, with the
phone, before any pick. The customer_picks "Any available" choice does the
same.
**Suggested fix:** The same rule on the times: in findBookingMoveTimes, when
nobody is picked and the booking's own person still offers the service, read
that person's times first and let CalendarUnavailableError through (the route
already maps it to 503, and the panel shows its "can't load" state with the
phone). A route test like the probe above, expecting 503 from the times. This
only makes Frank's F-263/F-265 decision hold on the page as well as on the
move.
**Resolution:** Fixed 2026-10-08 after 9.2's review, as suggested: findBookingMoveTimes, with nobody picked, also reads her own person's times beside the any-available ones, so an unreadable calendar throws as any unreadable read and the route answers 503 "try again", the same as the move. Test: public-booking-move-times-routes.test.ts "with nobody picked, her own person's unreadable calendar answers 503, though another is free"; proved: dropping the second read fails it only.
Closed 2026-10-08 by the review of step 9.3 (scope: 3de57a5..21b8d6d): find-booking-move-times.ts:82-85 asks her own person's times beside the any-available ones when nobody is picked, so an unreadable calendar throws CalendarUnavailableError and the route answers 503, as the move does. A person who no longer offers the service makes findFreeTimes answer null (find-free-times.ts:76), which the destructuring ignores, so decision 14's fallback still lists the others. Replacing the second read with `null` fails "with nobody picked, her own person's unreadable calendar answers 503, though another is free" (public-booking-move-times-routes.test.ts:274, 1 failed of 17); file restored, sha256 identical.

### F-270 [P3] closed - BookingQuestionType lives in check-answers.ts, not in find-booking-questions.ts which produces it

**File:** backend/lib/booking/check-answers.ts:7 (its producer imports it back: backend/lib/booking/find-booking-questions.ts:9,11)
**Found:** 2026-10-08 by independent review of 9.2 (scope: ef70707..d1c13c6; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md: "A type sits in the file of the
function that produces it", because Frank navigates by file name.
findBookingQuestions returns `BookingQuestionType[]` but has to import the
type from the checker, so someone looking for the shape of a question opens
find-booking-questions.ts and finds only an import.
**Suggested fix:** Move `BookingQuestionType` into find-booking-questions.ts
and import it in check-answers.ts (type-only, no cycle).
**Resolution:** Fixed 2026-10-08 after 9.2's review: BookingQuestionType moved to find-booking-questions.ts, which returns it; check-answers.ts imports it.
Closed 2026-10-08 by the review of step 9.3 (scope: 3de57a5..21b8d6d): `BookingQuestionType` is declared in find-booking-questions.ts:10 beside findBookingQuestions, which returns it, and check-answers.ts:7 imports it type-only; `git grep` finds no other declaration. Backend build passes.

### F-271 [P2] closed - A booked form sent again counts against its contact, and at the limit it is refused 429 instead of getting its booking

**File:** backend/routes/public-bookings-routes.ts:63-69,89-90 (the replay it runs ahead of: backend/lib/booking/book-time.ts:151-162; the rules: current-feature.md decisions 8 and 9)
**Found:** 2026-10-08 by /audit independent (scope: step 9.3; lens: correctness)
**Why it matters:** The contact is counted before bookTime and given back
only when `booked` is false. A form already booked comes back from bookTime's
replay as `booked: true, alreadyBooked: true`, so each resend is counted as a
new booking, and once the contact is at 4 the resend never reaches the
replay: the route answers 429. Decision 8, amended in this step, says "only
bookings made count against the contact", and decision 9 says a retry after a
lost answer gets the booking that won, the order F-258 settled for the person
check and F-268 for the answers. Shown with scratch tests in the bookings
route tests (removed after, sha256 identical): one form sent four times
answered 201 each time (the one booking, as "the same form sent twice" shows),
then a new booking for the same email answered 429 with one booking made; four
bookings for one email, then the fourth's form sent again, answered 429
`too_many_tries` though it is booked. A customer whose answer was lost is told
"Too many tries" for a booking that exists, and may call or book again.
**Suggested fix:** Give the count back when `result.alreadyBooked` is true;
and let a form's own booking answer before the contact's refusal (when the
count refuses and the form carries a `requestKey`, look up its booking as
bookTime's replay does, and answer it if it exists). Route tests like the two
probes above, each shown able to fail.
**Resolution:** Fixed 2026-10-08 in 9.3's review fixes: the contact is counted inside bookTime through `admitNewBooking`, asked just after the form's own booking is looked up (book-time.ts), so a form sent again is answered its booking before the limit is asked and is never counted; the route hands the count back when the booking is refused, crashes, or comes back `alreadyBooked` (copies of one form racing). Tests: "a form sent again gets its booking even at the limit, and resends never count" (fails with the limit asked before the look-up) and "copies of one form arriving together count as the one booking they make" (four at once, then three more book and the next is 429; fails 3 of 3 runs without the alreadyBooked hand-back, passes 3 of 3 with it). Spec decision 8 says so.
Closed 2026-10-08 by re-review of 9.3's fixes (scope: 21b8d6d..8e8a864): book-time.ts:166-168 asks `admitNewBooking` once, just after the form's own booking is looked up, so a booked form sent again is answered before the limit and never counted. Every way out after it hands the count back once: a refusal (`!result.booked`) or the form's booking found later (`alreadyBooked`, from refuseUnlessBooked or the request-key constraint) at public-bookings-routes.ts:99, and a throw in the `.catch` at :94, which rethrows so :99 is not reached; a refusal or crash before it finds `taken` null and hands back nothing. Only the public route passes it (`git grep admitNewBooking`), so the owner's bookings through bookTime are not limited. Asking the limit before the look-up fails "a form sent again gets its booking even at the limit, and resends never count" (1 failed of 35); dropping `|| result.alreadyBooked` fails "copies of one form arriving together count as the one booking they make" 3 runs of 3. Files restored, sha256 identical. Copies of one form arriving together while the contact is at its last place are a narrower case the fix leaves: F-275.

### F-272 [P3] closed - giveBack takes from whatever window is open when it runs, so a try that straddles a window's end frees a place in the next one

**File:** backend/lib/rate-limit/create-rate-limiter.ts:51-57 (its caller: backend/routes/public-bookings-routes.ts:85,90)
**Found:** 2026-10-08 by /audit independent (scope: step 9.3; lens: correctness)
**Why it matters:** take counts a try in the key's open window; giveBack
takes one off whichever window is open when it runs. When a booking is
counted near the end of a contact's 10 minute window and refused after it
ends, while another booking for the same contact has opened a new window,
the refusal hands back a place it never took there. Shown with a scratch
unit test (removed after, restored byte for byte): `most: 1`, a take, the
clock moved one window, a second take allowed (window 2, count 1), giveBack
for the first, then a third take in window 2 answered `{ allowed: true }`:
two tries made in a window of one. Each straddling refusal lets one more
booking through, so it needs a slow bookTime (a Google read) across the
boundary with a second booking racing it. Small, but it is the one way the
all-or-none count lets a contact past 4.
**Suggested fix:** Let take report the window it counted each key in (its
`endsAt`) and giveBack take off only a window with that same end; a unit
test like the probe above.
**Resolution:** Fixed 2026-10-08 in 9.3's review fixes: `take` answers where each key was counted (`taken`, its window's end) and `giveBack` takes off only a window with that same end. Test: "a try counted in a window that has ended frees nothing in the next one", the probe above; fails with the end check removed.
Closed 2026-10-08 by re-review of 9.3's fixes (scope: 21b8d6d..8e8a864): create-rate-limiter.ts:44-49 returns each key's window end in `taken`, and giveBack at :55-59 takes off only a window whose `endsAt` is that end. A window opened after the old one ended starts at or after that end, so its own end is later and never equal. Removing `window.endsAt === windowEndsAt &&` fails "a try counted in a window that has ended frees nothing in the next one" (1 failed of 7); file restored, sha256 identical. The route keeps `taken` from its one take and hands back only that.

### F-273 [P3] closed - Two of 9.3's route rules are pinned by no test: each business counted apart, and the give-back on a crash

**File:** backend/routes/public-bookings-routes.ts:64,84-86 (the tests: backend/routes/public-bookings-routes.test.ts:546-623, backend/lib/rate-limit/booking-contact-keys.test.ts:24-30)
**Found:** 2026-10-08 by /audit independent (scope: step 9.3; lens: tests)
**Why it matters:** The Done when lists "two businesses counted apart". It is
shown only by bookingContactKeys' unit test; the route's wiring is free.
Scratch mutation, restored after (sha256 identical):
`bookingContactKeys("one-for-all", body.customer)` in the route passed every
route and rate-limit test (242). With it, a contact's four bookings at Primo
would refuse her at Face and Body. Second, removing the `.catch` give-back
("a crash made no booking either") passed every route test (231), so a later
edit could drop it and a contact would lose a place for each 500.
**Suggested fix:** A route test booking one email four times in this file's
clinic and once more in a second business it makes, expecting 201; and one
where bookTime throws once (a spy on one of its reads) followed by four
bookings for that contact that all pass. Show each fails under the mutations
above.
**Resolution:** Fixed 2026-10-08 in 9.3's review fixes: the bookings route tests make two more businesses, a shop and one with no pipeline stage. "two businesses count the same email apart" (four at the clinic, then 201 at the shop) fails with one key for every business; "a booking that crashes does not count" (five crashes at the stageless business, each 500, never 429) fails with the crash hand-back removed.
Closed 2026-10-08 by re-review of 9.3's fixes (scope: 21b8d6d..8e8a864): `bookingContactKeys("one-for-all", body.customer)` in the route fails "two businesses count the same email apart" (1 failed of 35); deleting the `.catch`'s `handBack()` fails "a booking that crashes does not count" (1 failed of 35). The stageless business crashes at book-time.ts:233, after the count is taken, so the test reaches the hand-back. Both extra businesses go in afterAll with the clinic; after a full run no `test-bookings-%` business is left and no row in any table with an organization_id points at a missing business. File restored, sha256 identical.

### F-274 [P3] closed - Code comments carry finding numbers and who agreed when, which the standards keep in the build log

**File:** backend/lib/booking/find-booking-choices.ts:88-89,127; backend/lib/booking/find-booking-move-times.ts:80-81; backend/lib/rate-limit/create-rate-limiter.ts:3,12; backend/lib/rate-limit/public-rate-limiters.ts:1 (and eight test comments: book-time.test.ts:567, public-booking-move-routes.test.ts:281,332,346, public-booking-move-times-routes.test.ts:272, public-booking-page-routes.test.ts:155, public-bookings-routes.test.ts:351,386)
**Found:** 2026-10-08 by /audit independent (scope: step 9.3, with the repairs of F-265 to F-269 it re-checked; lens: quality)
**Why it matters:** coding-standards.md, Comments: "No history in code
comments (step numbers, finding numbers, ...): that lives in the build log."
Feature 9's repairs put bare IDs (F-258, F-263 to F-269) into five source
comment lines and eight test comments, and this step adds "(Frank, Oct 8)"
and "agreed by Frank on Oct 8". The IDs also go stale: /complete archives
this ledger as 9/F-265 and the next ledger starts again at F-01, so a later
F-265 would be a different finding from the one the code names. The decision
references beside them ("7b decision 14", "feature 9, decision 8") are spec
links and fine. Smaller, same lens: `RateLimiterType`
(create-rate-limiter.ts:12) is exported and used nowhere (`git grep` finds
only its declaration).
**Suggested fix:** Drop the finding IDs and the who and when, keeping the
sentence each one ends (the rule stands without its number); delete
`RateLimiterType`, or use it where the limiters are typed.
**Resolution:** Fixed 2026-10-08 in 9.3's review fixes: the finding numbers are gone from the five source and eight test comments, each sentence kept; the who and when are gone from create-rate-limiter.ts and public-rate-limiters.ts; `RateLimiterType` is deleted. `git grep -E "F-[0-9]{2,3}|Oct 8" -- backend` finds nothing outside dist. The migration's F-06 stays: migrations are not edited.
Closed 2026-10-08 by re-review of 9.3's fixes (scope: 21b8d6d..8e8a864): `git grep -n -E "F-[0-9]{2,3}|Oct 8" 8e8a864 -- backend ':!backend/dist'` finds nothing, and `git grep RateLimiterType` finds nothing in backend, packages or frontend. Each edited comment in find-booking-choices.ts:88-89,127, find-booking-move-times.ts:79-81 and the eight tests keeps its sentence with only the IDs gone; the decision references stay. `npx tsc --noEmit -p backend` passes.

### F-275 [P3] closed - Two copies of one form at the contact's last place: one books, the other is refused 429 for that same booking

**File:** backend/lib/booking/book-time.ts:166-168 (the hand-back: backend/routes/public-bookings-routes.ts:68-77,99; the rules: current-feature.md decisions 8 and 9)
**Found:** 2026-10-08 by /audit independent (scope: 9.3 review fixes; lens: correctness)
**Why it matters:** F-271's fix looks up the form's booking before the
limit is asked, which answers a resend sent after the first copy finished.
A copy that arrives while the first is still being saved finds no booking
yet, so both copies take a place; at the contact's last place the second is
refused. Shown with a scratch test in the bookings route tests (removed
after, sha256 identical), three runs of three: three bookings for one email,
then one form for a fourth sent twice at once answered `201` with the
booking and `429 too_many_tries`; the same form sent once more afterwards
answered `201`. Decision 8 says a form sent again after a lost answer "gets
its booking and never too many tries", and decision 9 that a retry gets "the
booking that won". A retry made while the first request is still running (a
slow Google read in the free check) at a contact's fourth booking is told
"Too many tries" for a booking that exists. Below the last place the copies
are counted once, as "copies of one form arriving together" shows.
**Suggested fix:** Count a form once while it is in flight: keep the request
keys being booked (per business), and let a copy whose key is already in
flight through without a take of its own, so it ends at the constraint or
the replay as now and hands back nothing. A route test like the probe above.
**Resolution:** Fixed 2026-10-08 in 9.3's second review fixes: the contact limiter remembers which forms (request keys) it counted in each window, and a copy of a form already counted for every key passes with no count of its own (`take(keys, formKey)`, create-rate-limiter.ts); the route passes the form's request key. Because copies now share one count, a copy answered the form's booking (`alreadyBooked`) no longer hands it back, or the losing copy would free the place the winning one used; only a refusal or a crash hands it back, and a form handed back is no longer remembered. This replaces the `alreadyBooked` hand-back of F-271's fix. Tests: "copies of one form at the contact's last place all get the booking" (three bookings, then one form sent twice at once: both 201, one booking, the next form 429) and the unit tests "count once, and a different form is still refused at the limit" and "a form handed back is no longer counted". Mutations: no form key fails both copies route tests; handing back on `alreadyBooked` fails them in 2 of 3 runs (which copy wins the race decides it); keeping a handed-back form fails its unit test. Spec decision 8 says so.
Re-reviewed 2026-10-08 by re-review of 9.3's second fixes (scope: 8e8a864..f99ee0f), left `fixed`: the defect itself is gone. create-rate-limiter.ts:41-42 lets a copy of a form already counted in every one of the contact's windows pass with `taken: []`, and public-bookings-routes.ts:71 passes `body.requestKey`, so the copy at the last place no longer takes a place of its own. Dropping the form key at :71 fails both copies route tests 3 runs of 3; handing back on `alreadyBooked` at :101 fails one or both in 2 of 3 runs; deleting `window.formKeys.delete(formKey)` at create-rate-limiter.ts:65 fails "a form handed back is no longer counted" (1 failed of 9). Files restored, sha256 identical. Not closed because the repair opens a new way past the limit (F-276): it closes with F-276's repair. Fixed again 2026-10-08, after its re-review found F-276: the shared count is gone (create-rate-limiter.ts is back to its 8e8a864 form, no form keys). Instead the route books the copies of one form one after the other (one-copy-of-a-form-at-a-time.ts, keyed by business and request key, in memory like the counts): a copy sent while the first is still saving waits, then is answered that booking by bookTime's look-up before the limit is asked, and the `alreadyBooked` hand-back of F-271's fix is back. "copies of one form at the contact's last place all get the booking" fails 3 of 3 runs with the turn-taking bypassed. Closed 2026-10-08 by re-review of 9.3's third fixes (scope: f99ee0f..011c991): create-rate-limiter.ts is its 8e8a864 form again (`git diff 8e8a864 011c991` on it and its test is empty), so no copy passes on another's count. public-bookings-routes.ts:82-83 runs bookTime through oneCopyOfAFormAtATime keyed `${organizationId}:${requestKey}` (a request key matches `^[A-Za-z0-9_-]{1,64}$`, so no colon lets two businesses' keys meet); a copy that starts after its sibling saved is answered at book-time.ts:166-167, before `admitNewBooking` at :168, so it takes no place. Each request keeps its own `taken` and hands back only that (public-bookings-routes.ts:68-78, :99-105). Passing `null` as the form key at :83 fails "copies of one form at the contact's last place all get the booking" 3 runs of 3 (1 failed of 37). Bounded: a slow first copy holds the next only while its bookTime runs, and its Google reads abort after 10 s (google-calendar-provider.ts:15, google-oauth-client.ts:13). Only the public route calls bookTime (`git grep bookTime`). Full backend suite 875 passed. File restored, sha256 identical.

### F-276 [P2] closed - A refused copy of a form hands back the one count its sibling copy books on, so the contact gets a fifth booking

**File:** backend/routes/public-bookings-routes.ts:101 (with backend/lib/rate-limit/create-rate-limiter.ts:41-42,63-65; the rules: current-feature.md decision 8)
**Found:** 2026-10-08 by /audit independent (scope: 9.3 second review fixes; lens: correctness, security)
**Why it matters:** Copies of one form now share one count, held by
whichever copy took it first. When that copy is refused (a booking link
that does not exist, a missing answer, a taken time) it hands the count back
at :101 and giveBack forgets the form (:65), while the other copy, which
passed with `taken: []`, goes on to book. A booking is made and nothing is
counted for it. The request key is the client's own, so two requests with
one key and different contents do it on purpose. Shown with a scratch test
in the bookings route tests (removed after, sha256 identical), 3 runs of 3:
eight rounds, each a fresh key sent twice at once for one email, one copy
with an unknown `bookingLinkId`, the other a valid form, answered
`[404,201]` five times then `[429,429]`: five bookings in a window of four.
With the valid copy sent 1ms later the same; 3ms later it is counted (four).
Before f99ee0f each copy took its own place, so this could not happen;
decision 8 says "many sent at once cannot all pass" and only bookings made
count.
**Suggested fix:** Hand back a shared count only when no copy of the form
booked: when the counting copy is refused, look up the form's booking
(`bookedByThisForm`, or a hand-back that bookTime makes after its own
`refuseUnlessBooked`) and keep the count if it exists; or hold the form's
count until every copy in flight has finished (a per-form in-flight tally in
the limiter), handing back only when the last ends unbooked. A route test
like the probe above, shown able to fail.
**Resolution:** Fixed 2026-10-08 by replacing F-275's shared count: copies of one form no longer pass on another copy's count; they are booked one after the other, each taking its own count unless the form's booking already exists, so a refused copy hands back only its own. Test: "a broken copy of a form never lets its valid copy book uncounted" (the probe above: eight rounds of a broken and a valid copy of one form sent at once for one email; exactly four bookings made), 3 of 3 runs. Unit tests for one-copy-of-a-form-at-a-time.ts: copies wait for each other, different forms and the owner's bookings do not, a failed copy does not stop the next.
Closed 2026-10-08 by re-review of 9.3's third fixes (scope: f99ee0f..011c991): the shared count is gone, so a refused copy can hand back only the place it took itself (`taken` is per request, public-bookings-routes.ts:68-78). Whichever copy runs first: a broken one takes a place, is refused `not_found` (book-time.ts:186) and hands it back before its sibling is admitted (the sibling starts only after the first's turn ends, and reads the database twice before :168); a valid one books, and the broken one is then answered `request_key_used` at :166 with no count. With f99ee0f's route and create-rate-limiter.ts put back under the current tests, "a broken copy of a form never lets its valid copy book uncounted" fails `expected 5 to be 4` 3 runs of 3 (1 failed of 37); with the current code it passes. Dropping `.catch(() => {})` at one-copy-of-a-form-at-a-time.ts:14 fails "a copy that fails does not stop the next one" (1 failed of 3). F-271 still holds: its two route tests pass, and a resend after the booking is answered before the limit. Its `|| result.alreadyBooked` hand-back (public-bookings-routes.ts:105) no longer bites any test (dropped, 37 of 37 pass 3 runs of 3), since copies in one API now always meet the booking at book-time.ts:166; it stays for a copy that finds the booking later, as decision 8 says. Files restored, sha256 identical.

### F-277 [P3] closed - Nothing pins that a form's turn is cleared from memory, so a later edit could keep every booked form in the API forever

**File:** backend/lib/booking/one-copy-of-a-form-at-a-time.ts:19 (its tests: backend/lib/booking/one-copy-of-a-form-at-a-time.test.ts)
**Found:** 2026-10-08 by /audit independent (scope: 9.3 third review fixes; lens: tests)
**Why it matters:** The `finally` at :19 removes a form's entry from
`formsInHand` once its last copy ends; it is the only thing that empties the
map, and today it does, on success and on a throw alike. But deleting that
line passed every test of the file and of the bookings route (40 of 40,
restored after, sha256 identical). Without it each public booking that
carries a request key, which the widget always sends (decision 9), leaves
its key and its settled answer (the booking and contact ids) in the API's
memory until the next restart. The rate limiter's own clean-up is pinned for
the same reason ("windows that are over are dropped", through `size()`).
**Suggested fix:** Give the module a small read of how many forms are in
hand, as the limiter's `size()` does, and a unit test that it is 0 after a
copy that books, after one that throws, and after two copies of one form;
shown to fail with the line at :19 removed.
**Resolution:** Fixed 2026-10-08 in 9.3's fourth review fixes: one-copy-of-a-form-at-a-time.ts exports one object, `oneCopyOfAFormAtATime`, with `book` (the route calls `oneCopyOfAFormAtATime.book`) and `formsInHand()`, the count of forms in hand, as the limiter's `size()`. Test: "every form is cleared from memory once its copies end: booked, failed, or two at once" (0 after a copy that books, 0 after one that throws, 1 while two copies of one form run, 0 after); fails with the clearing line removed (restored after). Backend 77 files, 876 tests pass.
Closed 2026-10-08 by re-review of 9.3's fourth fix (scope: 011c991..16a02b3): the finally at one-copy-of-a-form-at-a-time.ts:20 still clears a form once its last copy ends, and `formsInHand()` (:25-27) reads the module's map size, as the limiter's `size()` does. Deleting the clearing line fails "every form is cleared from memory once its copies end" at its first check (`formsInHand()` 1, expected 0; 1 failed of 4); file restored, sha256 identical. `git diff -w 011c991 16a02b3` on public-bookings-routes.ts shows only `oneCopyOfAFormAtATime(` becoming `oneCopyOfAFormAtATime.book(` and the `.catch` moved to its own line; the bookTime arguments and the hand-back are unchanged, and `git grep oneCopyOfAFormAtATime` finds no other caller. Names and the one-line comment on `formsInHand()` match coding-standards.md. Full backend suite 77 files, 876 passed; `npx tsc --noEmit -p backend` passes.

### F-278 [P2] closed - A Book now with an empty bookingId calls the service list's route, reads its answer as a service and crashes the host page

**File:** packages/booking-component/api-client/fetch-booking-service.ts:17-24 (the call: booking-modal.tsx:103-104; the crash: booking-modal/service-screen.tsx:18; the cause: hono's client, node_modules/hono/dist/client/utils.js:12)
**Found:** 2026-10-09 by /audit independent (scope: step 9.4, f341569..90a6a1e; lens: all)
**Why it matters:** `BookNowTrigger` takes `bookingId?: string`, and the
modal treats anything but `undefined` as a named service. Hono's client
fills a path parameter without encoding it and drops the segment when the
value is empty (`v ? "/" + v : ""`), so `bookingId=""` asks
`/public/<slug>/booking-links`, the list route, which answers 200.
`fetchBookingService` trusts every 200 as one service and returns
`{ state: "ok", service: undefined }`. Shown with a scratch test in the
package (removed after) against the running API: the URL built was
`http://localhost:3401/public/clinic-dev/booking-links` and the result
`{"state":"ok"}` with no service. The modal then renders the service screen,
which reads `props.service.layout` on `undefined`, a TypeError during render;
with no error boundary in the package that takes down the host's page, not
only the window. A host passing a blank id from its own content (a
`bookingId` field left empty instead of null, the shape face-and-body's
`Service.bookingId: string | null` invites) is the realistic way in; an id
holding a `/` or `?` likewise reaches another route, though those answer a
refusal today. The spec says a service id that is not offered shows
"Nothing can be booked online right now."
**Suggested fix:** Treat a blank `bookingId` as "nothing to book" (or as no
id, opening the list) before any call, encode the path parameters
(`encodeURIComponent`) where the package calls the client, and have
`fetchBookingService` return "cannot-load" when a 200 carries no
`bookingLink`. A unit test of `fetchBookingService` through
`hc<PublicAppType>` with a fake fetch: a blank id never reaches the list
route, and a 200 without `bookingLink` is a problem, shown able to fail.
**Resolution:** Fixed 2026-10-09 in 9.4's review fixes (Frank's yes): fetch-one-service.ts (fetch-booking-service.ts before the rename in 859b64d) answers "nothing to book" for a blank slug or id before any call, encodes both path values, and reads a 200 with no bookingLink as "cannot load"; fetch-service-list.ts does the same for a blank slug and a 200 without the business or its list. New tests through hc<PublicAppType> over a fake fetch (fetch-one-service.test.ts, fetch-service-list.test.ts): 5 of them fail on the code before the fix and pass after (restored, sha256 identical); 18 of 18 pass. Live on the booking preview, painting-dev: a blank id shows "Nothing can be booked online right now." with "Call 403 555 0100", and the page stays up.
Closed 2026-10-09 by re-review of 9.4's review fixes (scope: 90a6a1e..bc34f31): with 859b64d's fetch-one-service.ts and fetch-service-list.ts put back under the new tests, 5 of 18 fail (blank id and blank slug ask nothing, a 200 without the expected shape is a problem, "a/b?c" stays one segment); with bc34f31's code 18 of 18 pass; files restored, sha256 identical. A scratch Hono app behind `hc<PublicAppType>` shows the server decodes each value once, so `c.req.param()` gets exactly what the host passed ("a/b?c", "50%", and a literal "a%2Fb" sent as `a%252Fb`), no double encoding; against the running API `clinic-dev` lists 10 services and a real uuid answers its service, while odd ids and slugs ("a/b?c", "..", "clinic-dev/booking-links/x", "clinic-dev?x=1") all come back "nothing to book". The rename leaves no old name anywhere in the repo outside history and findings (`git grep` for each old file and function name), the package's dist holds only the new paths, and `npm run build --workspace=frontend` passes.

### F-279 [P1] open - The calendar reads the API's times with the visitor's own time-zone rules, so an older browser shows every Alberta time from Nov 1 an hour early

**File:** packages/booking-component/booking-window/month-calendar/format-time-of-day.ts:4-7 (also group-times-by-day.ts:9; shown at screens/month-layout/day-times-view.tsx:40 and month-details-screen.tsx:35,50; the same pattern is older in frontend/components/customer-booking/change-time-panel.tsx:44-54)
**Found:** 2026-10-09 by /audit independent (scope: step 9.5, c67bc85..2001dc7; lens: all)
**Why it matters:** The API works out each free time with its own
time-zone rules and sends only the instant (`2026-11-02T15:00:00.000Z`).
The component turns that back into a day and a clock time with whatever
rules the visitor's browser carries. The two disagree for America/Edmonton,
the zone of every dev business and of the four tenants: the API's Node
(tz data 2026c) keeps Edmonton on UTC-6 after Nov 1 2026, while Chromium
150 (VS Code's Electron 43 on this laptop, tz data 2025c) falls back to
UTC-7. Shown against the running API: clinic-dev's Chemical Peel on Monday
Nov 2 (the clinic opens at 9:00) answers 39 times from 15:00Z to 00:30Z;
formatted the component's way (`Intl.DateTimeFormat("en-CA", { timeZone,
hour, minute })`) Node says "9:00 a.m." to "6:30 p.m." and Chromium 150
says "8:00 a.m." to "5:30 p.m.". Oct 12 reads "9:00 a.m." in both. So from
Nov 1, three weeks away, a visitor whose browser predates the change picks
"8:00 a.m." and is booked at 9:00, which is what the API, the dashboard and
the server-written emails say. The zone line reads "Mountain Time" either
way, so nothing on screen shows the mismatch. Decision 11 asks for the
business's clock, and the business's clock is the one the API computed with.
**Suggested fix:** Let the API name its own clock: the times route sends,
beside each instant, the business's date and time of day it computed it
from (for example `{ startsAt, date: "2026-11-02", time: "9:00 a.m." }`, or
the UTC offset at that instant), and the component groups by that date and
shows that label instead of re-deriving both with the browser's rules; the
details rail does the same with the chosen time. A unit test that a start
whose label the API sent is shown with that label, not re-derived. The 7b
change-time panel has the same pattern (only a note, it predates this
feature).
**Resolution:**

### F-280 [P3] open - The guard that drops a slow answer for a month or person no longer shown is pinned by no test

**File:** packages/booking-component/booking-window/screens/month-layout/use-month-times.ts:45 (and the first-day choice at month-service-screen.tsx:84-86)
**Found:** 2026-10-09 by /audit independent (scope: step 9.5, c67bc85..2001dc7; lens: tests)
**Why it matters:** `if (!live) return;` is the only thing that stops a
late answer for the previous month or person landing on the calendar: a
customer who switches from one person to another while the first answer is
on its way would see the first person's times under the second one's name,
and Next would carry the second person's id with a time they may not have
free. The guard is right today, but deleting the line leaves the package's
suite green (41 of 41; file restored, sha256 identical), because the hook
and the screen's own choices (the first day with a time when a month loads,
the picked time cleared on a change of month or person) have no test; the
package has no DOM test environment. The project's test gate says a step
that adds logic adds its tests, and the spec names stale answers among this
step's rules ("Changing the person reloads the month").
**Suggested fix:** Move the two choices into plain functions beside the
others in `month-calendar/` (which day is shown for a month's days and the
picked date; whether an answer belongs to the question now asked, keyed by
from, to and person), use them from the hook and the screen, and test them,
each shown able to fail.
**Resolution:**
