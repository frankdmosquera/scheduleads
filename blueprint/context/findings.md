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

### F-193 [P3] open - A deploy's stop exits without waiting for the requests in flight, so a booking being made at that moment is cut

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
**Resolution:**

### F-194 [P3] open - installJobTables ships in the API but only one test calls it, and its comment says the tests use it before their first job, which they do not

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
**Resolution:**

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

### F-239 [P3] open - The record says identical replies are never taken for one and both ways are claimed, which the built check does not promise

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
**Resolution:**

### F-240 [P3] closed - The shared-phone test puts the two people in different businesses, so a one-phone-per-business rule would still pass it

**File:** backend/lib/text/worker-text-settings-rules.test.ts:86-91
**Found:** 2026-10-07 by independent step review (scope: 8c.1, ddca0e1..e165362; lenses: quality, security, performance, tests)
**Why it matters:** The contract says "The phone is not unique: two people
may share one", and the table comment says the same. The test that pins it
makes Pedro in business "share-first" and Pedro in business "share-second",
so it only proves there is no unique index on `phone` alone. A
`unique(organizationId, phone)` added later (the likely mistake, since 8b's
`text_settings` has unique numbers) would pass it, while the real case is
inside one business: two of Summit's painters on the crew lead's phone. The
test name promises more than it checks.
**Suggested fix:** Give the second person to the same business (a second
`resource` row in `first.organizationId`) and insert both rows with the same
phone. Keep the cross-business case as a second line if wanted.
**Resolution:** Fixed 2026-10-07 with Frank's yes: the test is now "two people of one business may share one phone" (Carlos added to Pedro's business, both rows the same phone). Proved: a temporary unique ("organizationId", phone) on the dev database failed it, and it passed again once dropped. The cross-business line was not kept: nothing promises it beyond the phone not being unique on its own, which the one-business case already covers. Re-review of 8c.1's fixes (2026-10-07): closed. worker-text-settings-rules.test.ts:86-94 now makes Carlos a second `resource` in Pedro's own business (`pedro.organizationId`) and inserts both rows with the same phone, so a `unique(organizationId, phone)` would refuse the second insert; Carlos goes with the tagged business in afterAll (the organization delete cascades through resource). The dev database keeps no leftover from the temporary-unique proof: `worker_text_settings` has only its pkey, `person_fk`, `phone_check` and not-nulls. Backend tests 747/747 passed three runs in a row. Nothing new introduced.

### F-241 [P3] closed - NORTH_AMERICAN_NUMBER is a regex pattern, not a number, and the same rule now lives in two shapes

**File:** packages/shared/db/text-tables/north-american-number.ts:4; packages/shared/helpers/textable-phone-number.ts:6
**Found:** 2026-10-07 by independent step review (scope: 8c.1, ddca0e1..e165362; lenses: quality, security, performance, tests)
**Why it matters:** 8c.1 lifted the constant out of `text-settings-table.ts`
into its own file so a second table can share it, which makes it a named,
imported thing. The import reads as "a North American number", but it is the
source of a Postgres regular expression for a stored phone ("+1" and ten
digits), and the file sits among the tables. The coding standards ask that
the imported name carry the full meaning. The rule it encodes also exists as
`NORTH_AMERICAN` in `textable-phone-number.ts` (the typed shape, before
"+1"), so the two are kept in step only by a comment.
**Suggested fix:** Rename to say what it is, for example
`STORED_TEXTABLE_PHONE_PATTERN` in `stored-textable-phone-pattern.ts`, and
keep the pointer comment to `textable-phone-number.ts`. A rename only: the
SQL in the migrations is unchanged, so no new migration.
**Resolution:** Fixed 2026-10-07 with Frank's yes: renamed to `STORED_TEXTABLE_PHONE_PATTERN` in `packages/shared/db/text-tables/stored-textable-phone-pattern.ts`, keeping the pointer to `textable-phone-number.ts`; both tables import it. A rename only: `db:generate` reports "No schema changes", backend build clean, shared 154 and backend 747 tests passed (3 runs). Re-review of 8c.1's fixes (2026-10-07): closed. The diff is a pure rename (value unchanged) that keeps the pointer comment; `git grep` finds no `NORTH_AMERICAN_NUMBER` or `north-american-number` outside this ledger entry, and both `text-settings-table.ts` and `worker-text-settings-table.ts` import the new name. `db:generate` reports "No schema changes, nothing to migrate" and wrote no file; backend build, `format:check`, shared 154/154 and backend 747/747 (three runs) pass. Only a stale, gitignored `packages/shared/dist/db/text-tables/north-american-number.*` from an earlier build remains on this machine; `./db` does not export it and nothing imports it. Nothing new introduced.

### F-242 [P3] closed - The added rule cannot tell a superseded added job, so a booking moved away and straight back will text its person the same "new booking" twice once 8c.3 adds jobs on moves

**File:** backend/lib/text/send-worker-text.ts:40-44; backend/lib/jobs/worker-text-job.ts:20-22
**Found:** 2026-10-07 by independent step review (scope: 8c.2, b3b655c..7b24848; lenses: quality, security, performance, tests)
**Why it matters:** Not a fault in 8c.2 as built (today only `book-time.ts`
adds a worker job, so each booking has one added job). It is a trap for
8c.3. The added job sends whenever the booking is confirmed, not started and
still this person's (decision 5 as written); the payload's `sequence` is
written but dropped by `worker-text-job.ts`, and nothing looks at the
person's earlier `worker_added` entries. 8c.3 adds an added job on a move
onto a person, and its own Done when names the case "a booking moved away and
back". Marco -> Pedro -> Marco before the jobs run leaves two added jobs for
Marco (the booking's, sequence 0, and the move back's, sequence 2). Both pass
every check at run time, both render the same words, and both are first
tries, so `findSentText` never runs: Marco gets "Summit Painting: new booking
Mon Oct 5, 9:00am. Jane Doe, ..." twice, against "never sent twice" in the
spec's scope. (Decision 5 tolerates an added and a moved text repeating one
time, which reads differently; two identical texts are not that case.)
**Suggested fix:** Decide it in 8c.3's plan, before `move-booking.ts` adds
its jobs: for example, added skips when a `worker_added` or `worker_moved`
entry for this person and booking was recorded at or after this job's
`changedAt` (the same entries decision 5's "knew of it" reads), with a test
of the same name as the Simulate case. Or state in decision 5 that the
duplicate is tolerated, so it is a choice and not a surprise.
**Resolution:** Carried to 8c.3 with Frank's yes (2026-10-07): spec decision 5 now skips an added or moved text when an added or moved text to that person for that booking was recorded at or after the job's changedAt, and 8c.3's Done when has the two cases (moved away and straight back texts "new booking" once; a moved text a late "new booking" already covered sends nothing). Stays open until 8c.3 builds and tests it. Fixed 2026-10-07 in 8c.3: send-worker-text.ts skips an added or moved text when findWorkerNewsTold finds an added or moved entry for that person and booking at or past the job's move number (each sms_sent worker entry now records the move number its text described; a time comparison would rest on two clocks agreeing), and each booking's worker texts run in one lane (worker-text-lane-of.ts) so the rule reads every earlier text. Tests: "a booking moved away and back sends the first no taken off, and one moved away and straight back before the jobs ran texts the first \"new booking\" once, not twice" and "a moved text that a late \"new booking\" already covered sends nothing"; proved: removing the rule fails both. Audit of 8c.3 (2026-10-07): closed. Reviewed send-worker-text.ts, find-worker-news-told.ts, worker-text-job.ts, enqueue-worker-text.ts, worker-text-lane-of.ts, move-booking.ts and cancel-booking.ts at 44d36f0. Traced Marco -> Pedro -> Marco before the jobs run: the booking's added job (sequence 0) sends and records `sequence` 2 (the booking as the text described it), Pedro's added skips as another person's, Pedro's taken off skips as never told, and the move back's added (sequence 2) finds 2 >= 2 and skips, so one "new booking". The rule suppresses only when an added or moved text already described the booking at or past the job's move number, and every later change adds its own job at a higher number (a cancel cannot be undone), so no due text is wrongly skipped. Every enqueue (book-time, move, cancel) goes through enqueueWorkerText, so all of a booking's worker texts share one lane. Both named tests pass; backend 785/785 three runs. Nothing new from the repair's logic; the finding number it put in a code comment is recorded separately as F-244.

### F-243 [P3] closed - "Off your day" counts any earlier added or moved text as "knew of it", so a person whose last text already said it left, or who never heard the time that is going, is told it is off at a time they never had

**File:** backend/lib/text/send-worker-text.ts:71-73; backend/lib/text/find-worker-news-told.ts:30
**Found:** 2026-10-07 by /audit (scope: 8c.3, c630b85..44d36f0; lenses: quality, security, performance, tests)
**Why it matters:** Decision 5's aim is that nobody is told a booking left
their day that they never heard was on it. The taken-off rule reads only
`worker_added` and `worker_moved` entries and passes when any exists
(`told.length > 0`), whatever came after. Two paths, on the same "before the
jobs run" premise as the spec's own Simulate cases: (1) Pedro booked at 9:00
and told; moved to Maria and Pedro's "off your day, 9:00" goes; moved back to
Pedro and cancelled before those jobs run. The move back's added skips (the
booking is cancelled), then the cancel's taken off finds Pedro's sequence-0
entry and sends "off your day" at the new time: a second "off your day" for a
booking he was last told had left, at a time he never heard. (2) Pedro told
9:00; moved to 10:00, then to Maria before the jobs run. The moved text skips
(another person's), and the taken off sends "off your day, 10:00", a time he
was never told. No one drives to an empty house (the text says it is off), so
P3: a confusing text, not a missed one.
**Suggested fix:** Decide it in the spec first. The smallest repair uses the
move numbers 8c.3 already records: read `worker_removed` entries too, and let
taken off go only when this person's newest added or moved entry is newer than
their newest removed one; optionally also only when that entry described the
time being taken off. Or state in decision 5 that these cases are tolerated,
so it is a choice and not a surprise.
**Resolution:** Independent review of 8c.3 (2026-10-07): agree, P3. Traced both paths at 44d36f0: whyNotNews (send-worker-text.ts:71-73) passes "off your day" on `told.length > 0`, and findWorkerNewsTold (find-worker-news-told.ts:30) never reads `worker_removed`, so path (1) sends a second "off your day" and path (2) names a time that was never texted. The same root cause, the ledger not modelling what the person last heard, also makes the told case of "moved away and back" send an identical "new booking" twice (the 8c.3 test at worker-text-job.test.ts:618-630 asserts exactly that, same words, same 9:00am); decision 5 chooses that ("the move back sends added"), so it is not filed separately, but one ordered read of added, moved and removed entries would settle both. Fixed 2026-10-07 with Frank's yes: "off your day" goes only when the person's latest text about the booking was an added or moved one, newer than any "off your day" they got (findWorkerTextsTold now reads worker_removed entries too), with its own log reason "the person was already told it is off their day". The second path (a time a skipped moved text never told them) is accepted as is and written into decision 5: the customer's name still says which booking. Test: "a person already told a booking is off their day gets no second off your day"; proved: the old rule fails it. Re-review of 8c.3's fixes (2026-10-07): left fixed. The defect is gone: send-worker-text.ts:102-105 lets "off your day" go only when an added or moved entry's move number is above the newest worker_removed one, and putting back `told.onTheirDay.length > 0` fails "a person already told a booking is off their day gets no second off your day" (1 failed, 29 passed; file restored, same sha256). But the new comparison trusts the move number an "off your day" entry records, which on a retry recovered through findSentText is the booking's number when the retry ran, not when the text went, so it can now hide a later "off your day" that the old rule sent: F-247 path (1). Close together with F-247. Re-review of 8c.3's second fixes (2026-10-07): closed. The regression that held it open is gone: send-worker-text.ts:136 records a text a retry finds with the job's move number (`text.sequence`), so F-247 path (1) records the lost "off your day" at 1, Marco's move-back "new booking" at 2 stays newer, and move 3's "off your day" goes (worker-text-job.test.ts:892, "a lost off your day found on its retry does not stop a later one after a new booking"). Sent-now entries record the booking's move number at send time, which only grows, and an on-day and an off-day text can never both go at the same move number (one needs the person on a confirmed booking, the other not), so the "latest text" comparison at send-worker-text.ts:102-105 orders sent-now texts as they went. Backend 789/789, three runs. Nothing new from this rule.

### F-244 [P3] closed - The sender's file comment grew into a 15-line block restating the rules below it, and names a finding number

**File:** backend/lib/text/send-worker-text.ts:1-15 (finding number at line 6)
**Found:** 2026-10-07 by /audit (scope: 8c.3, c630b85..44d36f0; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md (Comments) asks for a short file-level
comment, the reasoning beside the line it explains, and "No history in code
comments (step numbers, finding numbers ...)". 8c.3 grew the header from 7 to
15 lines; lines 3-9 restate, rule by rule, what `whyNotDue` (48-63) and
`whyNotNews` (65-77) decide, far from those lines, and line 6 ends with
"F-242".
**Suggested fix:** Keep the header to why the module exists (every worker text
goes through it so the rules cannot drift; never to a texting number; the
retry check; the timeline entry). Move the "new booking"/"moved" and "off your
day" rules into a line or two above `whyNotDue` and `whyNotNews`, and drop
"F-242" (the build log carries it).
**Resolution:** Independent review of 8c.3 (2026-10-07): agree, P3. send-worker-text.ts:1-15 restates the rules of whyNotDue (48-63) and whyNotNews (65-77) line by line far from them, which coding-standards.md "Comments" names as unwanted ("a long block at the top that explains lines far below it"), and line 6 carries "F-242", the only finding number in backend/lib (`grep -rn "F-[0-9]{3}" backend/lib`). Fixed 2026-10-07 (standards, no decision needed): send-worker-text.ts's top comment is back to five lines naming the decisions, the rules sit beside whyNotDue, whyNotNews and the knew-of-it line, and no finding number is left anywhere in backend/lib code. Re-review of 8c.3's fixes (2026-10-07): closed. send-worker-text.ts:1-5 is a five-line header naming decisions 5-8 only; the rules sit beside whyNotDue (39), whyNotNews (56-58) and the knew-of-it line (100-101); `grep -rnE "F-[0-9]{3}" backend/lib` (non-test, excluding dist) finds nothing. The new files' headers (has-worker-text-in-doubt.ts, find-worker-texts-told.ts) are four lines each and carry no history. Nothing new introduced.

### F-245 [P2] fixed - A taken-off text runs ahead of a retrying "new booking" that may already have reached the person, finds no timeline entry, and is dropped for good

**File:** backend/lib/text/send-worker-text.ts:71-73, 90-91, 133-139; backend/lib/jobs/worker-text-lane-of.ts:1-4
**Found:** 2026-10-07 by independent step review (scope: 8c.3, c630b85..44d36f0; lenses: quality, security, performance, tests)
**Why it matters:** "Knew of it" reads only recorded `sms_sent` entries, but decision 7 exists because a text can reach the person without being recorded: sendText throws a retryable SendTextError on a timeout or lost answer (send-text.ts:55-70) after Twilio may have taken it. The lane does not hold the order across a failure (enqueue-job.ts:15 and the spec's Data / contracts: "A failed try waits behind later jobs of its lane"). Path: Pedro's "new booking" goes out at Twilio, the answer is lost, the job is rescheduled; if its retry's findSentText also fails (Twilio degraded), the waits grow toward hours. Jane cancels meanwhile. The cancel's taken-off job runs first in the lane, `told` is empty and Pedro's added switch is on, so it logs "the person never knew of this booking" and completes. The "new booking" retry then stops at whyNotDue ("the booking was cancelled", line 90-91) before the findSentText check at 133-139, so nothing records that he was told. Pedro has "new booking Tue 7:30" and never "off your day": the empty-house case the Goal names. worker-text-lane-of.ts:2-4 claims the lane makes the rules "read every text an earlier change sent", which is untrue while an earlier job is retrying. No test covers a retrying added text followed by a cancel.
**Suggested fix:** Decide in the spec, then: when a taken-off text finds `told` empty, look for an unfinished worker_text job for the same booking and person added before it (the runner's jobs table, as the lane test already queries) and, if one is still waiting, throw so the taken-off retries behind it; or, on attempt > 1 of an added or moved text that is no longer due, still run findSentText and record the text when it went, so a taken-off job retried after it sees the entry. Add a test of the same name: a "new booking" whose first try times out after Twilio took it, then a cancel, texts the person "off your day".
**Resolution:** Fixed 2026-10-07 with Frank's yes: "knew of it" also counts an added or moved text to that person for that booking that was tried and still waits for a retry (backend/lib/jobs/has-worker-text-in-doubt.ts, read from the runner's own table), so it may have reached them and they get "off your day"; the lane comment now says a waiting retry is read from the runner. Test: "an off your day still goes when the new booking may have reached them and waits to retry"; proved: removing the check fails it. Re-review of 8c.3's fixes (2026-10-07): left fixed. The defect is gone: replacing `(await hasWorkerTextInDoubt(...))` with `false` fails that test (1 failed, 29 passed; file restored, same sha256). The private-table read is judged acceptable: graphile-worker's public `jobs` view (sql/000017.sql) has no payload, so `_private_jobs` is the only place the booking and person can be matched; the query is bound parameters plus `sql.identifier(jobSchema)`; `^0.18.0` admits 0.18.x only and the test above exercises the query, so a schema change on upgrade fails a test. `attempts > 0` does mean "started at least once" in 0.18 (getJobs.js:186 increments on pick, returnJobs.js:19 gives it back for a job fetched but never started); the "removed" job running now is excluded by kind, and lane serialization stops another of the booking's worker texts running beside it. But the repair let an "off your day" go on a waiting try, which with the recovered retry's move number can leave the person last told "off your day" for a booking that is theirs again (F-247 path (2), probed), and the check counts more than tries that may have reached them (F-248). Close together with F-247. Re-review of 8c.3's second fixes (2026-10-07): left fixed. The order this finding names (the taken-off runs while the retry waits) is handled and tested (worker-text-job.test.ts:818), and F-247 path (2) now ends on "new booking" (worker-text-job.test.ts:913). But the mechanism its Why names, a not-due retry stopping at whyNotDue (send-worker-text.ts:86-87) before findSentText (133-139) so nothing records it, still loses the text in the other order: a retry due before the cancel but picked after it runs first, completes, leaves no job for hasWorkerTextInDoubt, and the cancel's "off your day" logs "the person never knew of this booking". Probed (temporary test, restored, same sha256): Marco gets only "new booking", no entries, no jobs left. Decision 5's amendment says of F-245 "a lost answer never leaves them driving to an empty house", which does not hold yet: filed as F-249. Close together with F-249.

### F-246 [P3] closed - "Each switch off stops only its own text" never turns the taken-off switch off: ignoring removedOn passes every test

**File:** backend/lib/text/send-worker-text.ts:42-46; backend/lib/jobs/worker-text-job.test.ts:738-753
**Found:** 2026-10-07 by independent step review (scope: 8c.3, c630b85..44d36f0; lenses: quality, security, performance, tests)
**Why it matters:** 8c.3's Done when lists "each switch off stops only its own text". The tests turn addedOn off (8c.2, and the cancel-elsewhere case) and movedOn off ("each switch off stops only its own text"), but no test sets removedOn to false. Proved: changing `removed: "removedOn"` to `removed: "active"` in SWITCH_OF leaves all 137 tests under lib/jobs/worker-text-job.test.ts and lib/text passing, so a business that turns a person's "off your day" texts off could keep sending them and nothing would catch it. The code is correct today; the Done when claim is unproved for one of its three switches.
**Suggested fix:** Extend "each switch off stops only its own text" with a removedOn-off case (a cancel logs "the person has that text off" for worker_removed and sends nothing, while the added and moved texts still go).
**Resolution:** Fixed 2026-10-07 (makes the agreed Done when hold): "each switch off stops only its own text" now also turns off only the "off your day" switch and checks the new booking and moved texts still go and the cancel's does not; proved: mapping that switch to the wrong field fails it. Re-review of 8c.3's fixes (2026-10-07): closed. worker-text-job.test.ts:752-766 books with only Marco's removedOn off, moves and cancels, and checks the new booking and moved texts go, the cancel's does not, and "worker_removed not sent, the person has that text off" is logged. Proved again: `removed: "active"` in SWITCH_OF fails "each switch off stops only its own text" (1 failed, 138 passed over worker-text-job.test.ts and lib/text; file restored, same sha256). Nothing new introduced.

### F-247 [P2] fixed - A retry recovered through findSentText records the booking's move number when it ran, not when its text went, and the fix's new "latest text" and "in doubt" rules now order texts by that number

**File:** backend/lib/text/send-worker-text.ts:102-107, 132, 137-141; backend/lib/text/find-worker-texts-told.ts:47-50
**Found:** 2026-10-07 by re-review of 8c.3's fixes (scope: 286078b..5e108e7; lenses: quality, security, performance, tests)
**Why it matters:** `record` stamps `sequence: context.sequence`, the booking now. On a retry whose first try reached Twilio but lost its answer, findSentText finds the old text and records it at today's move number, though the person read it before any later change. Before the fix, "off your day" entries were never read and any added/moved entry passed, so this did not matter; the fix makes both rules depend on it. Probed with two temporary tests in worker-text-job.test.ts (restored, same sha256), each giving the lost try's retry a run time before the next change's job, as a runner restart or the up-to-two-second poll gap does: (1) Marco told at move 0; moved to Pedro (move 1), Marco's "off your day" taken but answer lost; moved back (move 2), "new booking" goes ahead of the retry; moved to Pedro again (move 3). The retry finds the old "off your day" and records it at 3; move 3's "off your day" then logs "the person was already told it is off their day". Marco's texts: new booking, off your day, new booking; entries `[added 0, added 2, removed 3]`; the booking is Pedro's and Marco's last text says it is his. (2) Marco's "new booking" taken, answer lost; moved to Pedro (move 1), the in-doubt check sends "off your day" (entry 1); moved back (move 2). The "new booking" retry runs first, finds its old text and records it at 2; move 2's "new booking" then logs "the person was already told after this change". Marco's texts: new booking, off your day; entries `[removed 1, added 2]`; the booking is his and his last text says it is off, so he misses it. At 44d36f0 both ended with the right last text. Same trigger class as F-245 (a lost answer), plus a narrow timing window, hence P2.
**Suggested fix:** When a retry records a text findSentText found, record the move number of the change it was sent for (`text.sequence`) rather than the booking's now, so the timeline says what the text actually told them; with that, path (1) records 1 and move 3's "off your day" goes, path (2) records 0 and move 2's "new booking" goes. Add both paths as tests (each needs the lost try's run time moved ahead of the next change's job).
**Resolution:** Fixed 2026-10-07 (makes decision 5 hold, no new decision): a text a retry finds already went is recorded with the change it was sent for (the job's move number), not the booking's move number when the retry ran; a text sent now still records the booking as it is. Tests: "a lost off your day found on its retry does not stop a later one after a new booking" and "a lost new booking found on its retry does not stop a later one after an off your day" (each asserts the retry asked Twilio once, and the person's last text); proved: recording the retry's current move number fails both, 3 runs of 3. The tests release the held retry ahead of the other due jobs, since the runner breaks no tie between jobs due at the same moment. Re-review of 8c.3's second fixes (2026-10-07): left fixed. The defect is gone: both probed paths are now tests that walk the order they name (holdRetries keeps the lost try's retry back, releaseRetries puts its run_at an hour before the next change's job, and each asserts one GET, the retry's findSentText), and changing send-worker-text.ts:136 back to `record(sent, context.sequence)` fails both (2 failed, 30 passed; file restored, same sha256). `text.sequence` is a lower bound of what a found text told them, which can at worst let a later "new booking" or "moved" repeat; traced against every lane order I could build, it gives a wrong last text only through F-249's drop. But the repair's own comment (send-worker-text.ts:124-125) and the Data / contracts line it added say the found text "went at its first try" and so told "only the change it was sent for", neither of which is always true: F-250. Close together with F-250.

### F-248 [P3] closed - The in-doubt check counts every try of a "new booking" or "moved", including ones that never reached Twilio and jobs that gave up, though the spec and comment say "tried and still waits for a retry, so it may have reached them"

**File:** backend/lib/jobs/has-worker-text-in-doubt.ts:1-4, 21; blueprint/context/current-feature.md (decision 5, amendment)
**Found:** 2026-10-07 by re-review of 8c.3's fixes (scope: 286078b..5e108e7; lenses: quality, security, performance, tests)
**Why it matters:** The query is `attempts > 0` with no other condition. In graphile-worker 0.18 a job that used its last attempt stays in `_private_jobs` with `attempts = max_attempts` (only `is_available` turns false, sql/000011.sql:67), so a "new booking" that gave up counts as in doubt for that booking and person forever, not "still waits for a retry". And a try counts whatever failed it: send-text.ts retries refusals about the agency's own account and missing keys in production (its NEVER_RETRY comment), and any throw before sendText (a database error) also leaves `attempts = 1`; none of those can have reached the person. Path: Twilio refuses the account for an afternoon; Pedro's "new booking" keeps failing; Jane cancels; once the account is fixed, if the cancel's job runs before the added retry it finds the added job waiting, so Pedro gets a lone "off your day" for a booking he never heard of, the outcome decision 5's "knew of it" exists to prevent. The bias is the safe direction (an extra confusing text rather than a missed one), so P3, but the code does more than the amendment says.
**Suggested fix:** Decide in decision 5: either accept it and say so ("any try, waiting or given up, counts"), rewording the file comment to match; or narrow the query to `attempts < max_attempts` for "still waits", and, if wanted, to tries whose `last_error` is a timeout, no answer or unreadable answer, the only failures after which Twilio may have taken the text.
**Resolution:** Fixed 2026-10-07 (keeps Frank's rule of thumb for F-245, "when unsure, tell him"): accepted and reworded rather than narrowed. A job that gave up after its last try may also have reached them, so it still counts; decision 5 and has-worker-text-in-doubt.ts now say "tried and never known to have gone or failed, waiting for a retry or given up", and that a try which never reached Twilio counts too, in the safe direction. Re-review of 8c.3's second fixes (2026-10-07): closed. The code and its words now agree: has-worker-text-in-doubt.ts:1-5 says a try that is waiting or gave up counts, "when unsure, the person is told", and decision 5's amendment says the same, including tries that never reached Twilio; the query (attempts > 0, kinds added and moved, bound parameters, `sql.identifier(jobSchema)`) is unchanged and runs only when the first two "believes" checks fail (send-worker-text.ts:103-107 short-circuits). Nothing new from the rewording; the case where the job is gone before the taken-off reads it is F-249.

### F-249 [P2] closed - A "new booking" or "moved" retry that runs after the booking left the person, but before the taken-off job, completes without asking Twilio, so the in-doubt job is gone and the person who may have the text gets no "off your day"

**File:** backend/lib/text/send-worker-text.ts:86-87, 103-107, 133-139; backend/lib/jobs/has-worker-text-in-doubt.ts:1-5; blueprint/context/current-feature.md (decision 5, amendment)
**Found:** 2026-10-07 by re-review of 8c.3's second fixes (scope: 286078b..21409d8; lenses: quality, security, performance, tests)
**Why it matters:** F-245's repair reads a waiting retry from the runner's table, so it works only while that job is still there. A retry of an added or moved text whose booking is no longer the person's stops at whyNotDue (line 86-87, "the booking was cancelled" or "another person's now") before the findSentText check (133-139), returns, and graphile-worker deletes the job. If that retry runs before the cancel's taken-off job, the taken-off finds no entry, no job in doubt, and logs "the person never knew of this booking". The order is the one F-247's paths used: a retry whose run_at (its failure plus e^attempts seconds) came before the cancel's job, picked after it, which the up-to-two-second poll gap or a runner restart gives, and the runner picks by run_at. Also reached when the taken-off's own first try fails and its retry falls behind. Probed with a temporary test in worker-text-job.test.ts (restored, same sha256): book with Marco, his "new booking" taken but answer lost; holdRetries; cancel; releaseRetries; workDueJobs. Marco's texts: only "Summit Painting: new booking Mon Oct 5, 9:00am. ..."; no worker entries; "worker_removed not sent, the person never knew of this booking" logged; no jobs left. The booking is cancelled and his last text says it is his: the empty-house case decision 5's amendment says a lost answer never leads to. Same trigger class and window as F-247, hence P2.
**Suggested fix:** F-245's second suggestion: on attempt > 1, an added or moved text that whyNotDue rejects still runs the findSentText check (its words built from the job's own change where the booking's time may have moved since) and records the text with `text.sequence` when it went, before returning, so a taken-off that runs after it reads the entry. Or keep the in-doubt fact past the job (for example the retry, when not due, re-adds nothing but records that it may have gone). Add a test of the same name: a "new booking" whose answer was lost, then a cancel, with the retry released ahead of the cancel's job, texts the person "off your day".
**Resolution:** Fixed 2026-10-08 with Frank's yes (keeps his rule "when unsure, tell him", no new decision): a retry of a "new booking" or "moved" whose booking was cancelled or is another person's now still asks Twilio before it ends, and records the text with the change it was sent for when it went, so the "off your day" after it reads the entry (send-worker-text.ts, leftThePerson and foundEarlier); decision 5's amendment says so. Tests: "a lost new booking found on its retry after a cancel still texts the person off your day" (the finding's probe: one GET, Marco gets new booking then off your day, entries added then removed, no jobs left) and "a new booking its retry finds never went sends no off your day after a cancel"; proved: skipping the new check fails both (2 failed, 32 passed; file restored, same sha256). Known limit: the retry looks for the words the booking gives now, so if its time also moved between the lost try and the retry, and the move's own text never ran before the cancel, the text is not found and no "off your day" goes. Re-review of 8c.3's third fixes (2026-10-08): closed. The defect is gone: a retry (attempt > 1) of a "new booking" or "moved" whose booking was cancelled or is another person's now (leftThePerson, send-worker-text.ts:77-78) asks Twilio and, when the text went, records it with `text.sequence` before ending (send-worker-text.ts:123-143, through foundEarlier at 116-121), so the cancel's "off your day" reads the entry. Proved: changing line 127 to `if (false && attempt > 1 && ...)` fails both new tests (worker-text-job.test.ts:932 and 955; 2 failed, 32 passed; file restored, same sha256). No new wrong outcome in the orders probed with temporary tests (restored, same sha256): the "off your day" first and the retry after it (no third text, entries removed 1 then added 0, and a move back to Marco still sends "new booking"); Twilio's list failing on the not-due retry (the job stays with attempts 2, so the in-doubt check sends "off your day", and the retry, released, records the text once with no further text); Marco's worker settings gone before the retry (no Twilio call, "the booking was cancelled" logged); a first try not due (no Twilio call at all). The extra loads and the one Twilio GET run only on a retry of a text whose booking left the person. But the known limit named above is real and is not in decision 5, whose amendment still says a lost answer never leaves them driving to an empty house: F-251.

### F-250 [P3] closed - The comment and the Data / contracts line for a text a retry finds say it "went at its first try" and told "only the change it was sent for"; it may have gone at any earlier try and described a later move

**File:** backend/lib/text/send-worker-text.ts:124-125, 136; blueprint/context/current-feature.md:299-301 (Data / contracts, Timeline)
**Found:** 2026-10-07 by re-review of 8c.3's second fixes (scope: 286078b..21409d8; lenses: quality, security, performance, tests)
**Why it matters:** findSentText looks for the same words since the change was saved (`since: text.changedAt`), so the text it finds may be from try 2 after a try 1 that never reached Twilio, not the first. And an added text renders the booking as it is when it runs (line 117, 122), so a try after a later time move told the person that move, past `text.sequence`. The recorded number is therefore the least the text told them, not what it described. That is the safe direction today (it can only let a later "new booking" or "moved" repeat, and no wrong last text came from it in any lane order traced, apart from F-249), but the comment gives a reason that is not true, and the spec records it as the contract, so the next rule built on `sequence` would trust it as exact.
**Suggested fix:** Reword both to what holds: a text a retry finds is recorded with the change it was sent for, the least it can have told them (it went at some earlier try, about this change or a later one); a lower number at worst lets a later text repeat.
**Resolution:** Fixed 2026-10-08 (wording only): the comment at send-worker-text.ts (record) and the Data / contracts Timeline line now say `sequence` is the least the text told them: sent now, the booking as it is; found on a retry, the change it was sent for, since it went at some earlier try and may describe a later move, so a lower number at worst lets a later text repeat. Re-review of 8c.3's third fixes (2026-10-08): closed. Both now say what holds. The comment beside `record` (send-worker-text.ts:107-108) and the Timeline line (current-feature.md:299-305) call `sequence` the least the text told them: the booking as it is for a text sent now; for one a retry finds, the change it was sent for. That is true: findSentText matches the same words since `text.changedAt` (send-worker-text.ts:118), so a found text went at or after this change and described the booking at a move number at or past `text.sequence`, and every retry that finds one, due or not, records `text.sequence` (line 119). No em dashes in the range.

### F-251 [P3] open - A "new booking" whose answer was lost, then a time move and a cancel before its retry, is not found by the retry, which looks for the words the booking gives now, so the person gets no "off your day"; decision 5 still says a lost answer never leaves them driving to an empty house

**File:** backend/lib/text/send-worker-text.ts:87, 123-143; blueprint/context/current-feature.md:14 (Goal), 121-130 (decision 5, amendment)
**Found:** 2026-10-08 by re-review of 8c.3's third fixes (scope: 5bfd94b..7ed3ef3; lenses: quality, security, performance, tests)
**Why it matters:** F-249's fix renders the retry's words from the booking as it is now (workerMessage, send-worker-text.ts:87, `context.startsAt`), but the lost try rendered the time the booking had then. If the booking's time moved after the lost try and the move's own text never ran while the booking was still the person's, the retry looks for words that were never sent, finds nothing, ends, and leaves no job for hasWorkerTextInDoubt. Probed with a temporary test in worker-text-job.test.ts (restored, same sha256), F-249's own order plus one move: loseFirst("Summit Painting: new booking"); book with Marco; workDueJobs; holdRetries; move to 10:00 keeping Marco; cancel; releaseRetries; workDueJobs. One GET; Marco's texts: only "Summit Painting: new booking Mon Oct 5, 9:00am. ..."; no worker entries; no jobs left; logged "worker_added not sent, the booking was cancelled", "worker_moved not sent, the booking was cancelled" and "worker_removed not sent, the person never knew of this booking". The booking is cancelled and his last text sends him to Jane's at nine: the case the Goal (line 14) and decision 5's amendment ("a lost answer never leaves them driving to an empty house", and "records the text if it went") say cannot happen. F-249's Resolution names this limit, but only here, which Frank does not read; the spec states the opposite as the contract. It needs F-249's window plus a time move inside it, narrower than F-249, and the fixer disclosed it, hence P3 rather than P2.
**Suggested fix:** Frank decides in decision 5: either accept it and say so in the amendment's "Accepted as is" (a retry that finds the booking no longer theirs looks for the words the booking gives now, so a lost "new booking" or "moved" followed by a time move and a cancel before its retry gets no "off your day"); or close it by keeping the doubt when the retry cannot know the words, for example when it is not due, finds nothing, and the booking's time moved since this change (context.sequence > text.sequence), record that the text may have gone (a marker the "believes" check reads, as it reads the waiting job today), so the "off your day" goes, in the "when unsure, tell him" direction. Add the probe above as a test either way.
**Resolution:**
