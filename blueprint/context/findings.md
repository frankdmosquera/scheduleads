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

### F-195 [P2] closed - Decision 8 says the duplicate check looks back a day, which would take a booking's earlier reminder for the one being retried

**File:** blueprint/context/current-feature.md:98-101 (the code it governs: backend/lib/text/find-sent-text.ts:24, 56-62; the wording: current-feature.md:249)
**Found:** 2026-10-07 by /audit (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** Every reminder of one booking has the same words: the
spec's reminder wording names the business, service, time and link, never
how far ahead it is (line 249). Decision 8 tells the caller to look for "the
same body ... in the last day". With Summit's seeded reminders at 1200 and 60
minutes, the 1200 one goes about 19 hours before the 60 one; if the 60 one's
first send loses its answer, a one-day look-back finds the 1200 one, records
it as sent, and Jane gets no last reminder. `findSentText` itself is right: it
takes `since` and matches only texts from then on (minus 60 s of clock slack),
but the spec 8b.2 and 8b.3 build from still describes the unsafe window and
does not say what `since` is. The obvious job field is also wrong for a
reminder: graphile-worker's `created_at` is when the booking was made, before
the earlier reminder went, and `run_at` moves on each retry. Residual even
with the right `since`: two reminders set within a minute of each other (the
schema allows 61 and 60) fall inside the 60 s slack.
**Suggested fix:** Amend decision 8 to "since this text's first try", and say
in 8b.2/8b.3 what that is: the job's creation for the confirmation, the
appointment minus `minutesBefore` for a reminder (never the job's
`created_at`). Optionally make each reminder's words differ (or refuse
reminders less than two minutes apart) so the slack cannot bridge two of them.
**Resolution:** Fixed 2026-10-07 in 8b.1's review fixes: decision 8 now says "since this text's first try", defined as the booking's creation for the confirmation and the appointment minus its minutes for a reminder; the clock slack in find-sent-text.ts is 10 s, under the one-minute smallest gap between two reminders (F-200's test bounds it). 8b.2 and 8b.3 pass that `since`. Closed 2026-10-07 by re-review of 8b.1's fixes: decision 8 (current-feature.md:102-112) no longer says "in the last day" and defines `since` per kind (the booking's creation, the appointment minus its minutes), so neither the job's `created_at` nor the moving `run_at` is left as the obvious reading; find-sent-text.ts:14 is 10 s, under the one-minute gap the schema leaves between two distinct whole-minute reminders. Setting it to 60_000 or 120_000 fails find-sent-text.test.ts:90 (run in this pass, file restored, `git status` clean). One gap remains outside this finding: 8b.3's own text does not cite decision 8 and its Done when has no reminder-retry case, recorded as F-201.

### F-196 [P3] closed - The text settings check's refusal of a blank reminder has no test, and it is the only thing refusing one

**File:** packages/shared/db/text-tables/text-settings-table.ts:49-52 (tests: backend/lib/text/text-settings-rules.test.ts:103-111)
**Found:** 2026-10-07 by /audit (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** Against the local database, `0 < all(array[60,null]::int[])`
is null, which a check accepts, while `array_position(array[60,null]::int[], null)`
is 2 (read-only query run during this audit). So the `array_position` half
is the only guard against a reminder with no minutes, which 8b.3 would turn
into a job with no time. The rules test covers 0 and -30 but no null element,
so deleting that half would leave every test green.
**Suggested fix:** Add `["a blank", [60, null]]` to the reminder `test.each` in
text-settings-rules.test.ts, expecting `text_settings_reminder_minutes_check`.
**Resolution:** Fixed 2026-10-07 in 8b.1's review fixes: text-settings-rules.test.ts refuses a reminder "left blank", [60, null], by text_settings_reminder_minutes_check. Closed 2026-10-07 by re-review of 8b.1's fixes: text-settings-rules.test.ts:106 adds `[60, null]` to the reminder `test.each`, expecting `text_settings_reminder_minutes_check` (23514); with that array `0 < all(...)` is null, so only the `array_position` half refuses it, and dropping that half would fail this case. The backend suite passed three runs in a row with it.

### F-197 [P3] closed - Twilio's answer is read outside the error sorting, so a body that fails to arrive or parse escapes as a plain error

**File:** backend/lib/text/send-text.ts:70-72; backend/lib/text/find-sent-text.ts:55-57
**Found:** 2026-10-07 by /audit (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** The contract (current-feature.md, `sendText`) is that a
failure throws `SendTextError` with `retry`. The `AbortSignal.timeout` also
covers reading the body, and `response.json()` sits outside both try blocks:
a 201 whose body stalls past the limit throws a bare `TimeoutError`
(DOMException), and a 200 list answer that is not JSON, or has no `messages`,
throws a `SyntaxError` or `TypeError` from `.find`. 8b.2's job will branch on
`SendTextError.retry`; these arrive as something else. The send's case is the
very one decision 8 is for (the text went, the answer was lost).
**Suggested fix:** Read the success body inside a try and map a failure to
`SendTextError("no_answer", status, true, ...)`; in findSentText also treat a
missing `messages` array as a retryable `SendTextError`. A test each.
**Resolution:** Fixed 2026-10-07 in 8b.1's review fixes: send-text.ts reads Twilio's answer inside its own handling, so a 2xx whose body is cut off, not JSON or has no id throws SendTextError unreadable_answer, retried (the retry checks first); find-sent-text.ts does the same for a list answer, and reports a timeout as "timeout". Tests: not JSON, JSON without an id, an answer that stops halfway (cut by the time limit), a list answer not JSON or without a list, a list timeout. Closed 2026-10-07 by re-review of 8b.1's fixes: send-text.ts:161-173 reads the 2xx body in a try, and a body that throws, is not JSON or has no string `sid` throws SendTextError("unreadable_answer", status, true); find-sent-text.ts:58-69 does the same for the list and checks `Array.isArray`; a fetch timeout there is now "timeout" (:39-42). The halfway test (send-text.test.ts:131-150) errors the body stream through the same `init.signal` the code passes, so it fails if the read moves back outside the try. No new defect, apart from the error class's code comment not naming the new code (F-203).

### F-198 [P3] closed - The never-retry list may miss Twilio refusals that no retry fixes, and the spec's "check the current list" left no record

**File:** backend/lib/text/send-text.ts:10-12
**Found:** 2026-10-07 by /audit (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** The spec (Notes for the AI) asks for the five codes to be
checked against Twilio's current error reference at 8b.1; nothing in the spec,
code or commit records that it was. From memory, and not checked here because
the audit may not reach the network: 21606 (the From number cannot send to
this destination), 21617 (body over 1600 characters) and 21266 (To and From
the same) are refusals a retry cannot change, and each would be tried 10
times, each retry preceded by a `findSentText` call. Not a wrong text, only
wasted calls and a late log line, hence a lead.
**Suggested fix:** Check the codes against https://www.twilio.com/docs/api/errors
and either add the ones that cannot change on retry or record in the spec that
config refusals stay retried on purpose (fixed config, then the retry sends).
**Step review note (independent, 2026-10-07):** agreed, still unverified (no
network here either). One more thing to settle in the same pass: the list
already sorts config refusals both ways. 21408 (the region not enabled in the
account's geo permissions) is fixed in Twilio's console like 20003 (keys not
taken), yet 21408 is never retried (send-text.ts:12) and 20003 is
(send-text.test.ts:81). Whichever rule is chosen should cover both.
**Resolution:** Fixed 2026-10-07 in 8b.1's review fixes, codes checked against Twilio's error pages that day: never retried are the refusals about this customer or this text, 21211, 21610, 21612, 21614, 21617 (over 1600 characters) and 21266 (to the sending number itself); refusals about the agency's account, 21408, 21606 and 20003, are retried, so a fix in Twilio's console lets the waiting texts go. Spec decision 7 and its notes amended; send-text.test.ts covers each. Closed 2026-10-07 by re-review of 8b.1's fixes: the list now follows one rule, stated alike in decision 7, the spec's notes (current-feature.md:283-287) and send-text.ts:9-14 (refusals about this customer or this text never retry; refusals about the agency's account, 21408, 21606 and 20003, retry), which settles the step review's 21408/20003 split. The codes' meanings match this reviewer's knowledge of Twilio's reference (not re-fetched: no network in this pass). send-text.test.ts:64-89 sorts each code; putting 21408 back in NEVER_RETRY fails "a country not yet switched on in the account fails for now: retried" (run in this pass, file restored, `git status` clean).

### F-199 [P3] fixed - A reply phone may be another business's texting number, which hands one business's customer replies to another, or loses them

**File:** packages/shared/db/text-tables/text-settings-table.ts:37-41; packages/shared/zod-validation/text-validation-schemas/text-settings-validation-schema.ts:42-45
**Found:** 2026-10-07 by independent step review (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** The table and the schema refuse a reply phone equal to the
row's own `fromNumber`, but nothing refuses one equal to another row's
`fromNumber`, and a check cannot see other rows. Following 8b.4 as the spec
writes it (current-feature.md:174-185): if Summit's reply phone is set to
Riverbend's texting number, Summit's passed-on reply goes from Summit's number
to Riverbend's, Twilio posts it to `/texts/incoming`, the business is found by
the number texted (Riverbend), the sender is not Riverbend's reply phone, so it
is passed on to Riverbend's owner: Jane's number and words reach another
tenant. Set both ways, decision 9's own-reply-phone rule drops it instead, and
Jane's reply reaches no one, against decision 2's "a reply is never lost".
Reachable only through a setup mistake (the platform admin types the values),
hence P3; that Twilio delivers between two numbers of one account is assumed,
not tested here.
**Suggested fix:** In 8b.4's pass-on job, refuse (log, without the number) a
reply phone that is any business's `fromNumber`; and have client setup and
Settings (feature 12) refuse such a value when saving. A test for the job's
refusal.
**Resolution:** Carried to 8b.4, where the harm would happen: its spec now says the pass-on job never texts a reply phone that is any business's texting number (then the reply email only, or logged), with a test in its Done when; feature 12's Settings refuses it on save (spec notes). Stays open until 8b.4 builds and tests it. Re-review of 8b.1's fixes (2026-10-07): the carried text is coherent. 8b.4 (current-feature.md:185-206) refuses a reply phone that is any business's texting number when the job runs, so a value saved before or after the other business's number still cannot leak; it falls back to the reply email or a log line, and its Done when has the matching case (worth also asserting that the reply email still gets the text when one is set). The feature 12 half lives only in this spec's Notes for the AI (:288-289), which `/complete` archives with 8b; recorded as F-202 so it outlives this entry. Fixed 2026-10-07 in 8b.4: pass-on-reply.ts never texts a reply phone that is any business's texting number (findTextingBusiness), logs it and still sends the reply email when one is set. Test: "a reply phone that is a business's texting number gets nothing, and the email still goes"; proved: removing the guard fails it. Feature 12's Settings refuses it on save (build-plan item 12).

### F-200 [P3] closed - No test bounds the duplicate check's clock slack, so widening it to a day would keep every test green

**File:** backend/lib/text/find-sent-text.ts:12, 56 (tests: backend/lib/text/find-sent-text.test.ts:66-90)
**Found:** 2026-10-07 by independent step review (scope: 8b.1, 3b47c1c..7582593; lenses: quality, security, performance, tests)
**Why it matters:** The only match dated before `since` is 30 seconds before
(test line 84); the only earlier non-match is 31 hours before (line 71, Oct 6
09:00 against Oct 7 16:00). Any `CLOCK_SLACK_MS` from 30 s up to 31 h passes
the suite, so a change that widened the slack toward the one-day look-back the
spec's decision 8 still describes would take an earlier reminder with the same
words for the one being retried (the risk F-195 records) without a red test.
The slack's upper side is the part that keeps two reminders of one booking
apart.
**Suggested fix:** Add a case with the same words a few minutes before `since`
(for example 16:00 minus 2 minutes, outside the 60 s slack), expecting null.
**Resolution:** Fixed 2026-10-07 in 8b.1's review fixes: find-sent-text.test.ts finds the same words 5 s before the first try and refuses them a minute before, so a slack of a minute or more fails a test. Closed 2026-10-07 by re-review of 8b.1's fixes: find-sent-text.test.ts:82-96 bounds the slack on both sides (15:59:55 found, 15:59:00 not, against a 16:00:00 first try). Proved in this pass: CLOCK_SLACK_MS at 120_000 and at 60_000 each fail "the same words a minute or more before the first try are another text" (1 failed, 14 passed); the file was restored and `git status` showed it unchanged.

### F-201 [P3] closed - 8b.3 never says which `since` a reminder's retry passes, and its Done when has no case where an earlier reminder has gone

**File:** blueprint/context/current-feature.md:171-183 (rule: decision 8 at :102-112; the check: backend/lib/text/find-sent-text.ts:70-77)
**Found:** 2026-10-07 by re-review of 8b.1's fixes (scope: 7582593..9b8793a, with 3b47c1c..9b8793a as context; lenses: quality, security, performance, tests)
**Why it matters:** F-195's harm is decided by the job, not by `findSentText`:
the job picks `since`. The fix defined it in decision 8 only. 8b.2 points to
decision 8 ("On a retry, decision 8 first"), but 8b.3 names neither decision 8
nor the retry check, and F-195's suggested warning (never the job's
`created_at`, which for a reminder is when the booking was made) is written
nowhere. 8b.3's Done when lists cancels, moves, removed reminders and late
starts, but no "the 60-minute reminder's retry still sends after the
1200-minute one went", so a job that passes the booking's creation or the
job's `created_at` would keep every planned test green while Jane loses her
last reminder. find-sent-text.test.ts:90 bounds only the slack, given a
correct `since`.
**Suggested fix:** In 8b.3, add "on a retry, decision 8 first, with `since`
the appointment minus its minutes (never the job's `created_at`)" and a Done
when case: with Summit's 1200 and 60 reminders, the 1200 one sent, the 60
one's first send losing its answer, the retry still sends the 60 one.
**Resolution:** Fixed 2026-10-07 after the re-review: 8b.3's spec says a reminder's retry checks Twilio with since = the appointment minus its minutes, never the job's created_at or run_at, and its Done when adds "the 60-minute reminder's retry still sends after the 1200-minute one went". Closed 2026-10-07 by /audit of 8b.2 (bab087f..23ebb83): current-feature.md:207-211 says 8b.3's retry checks Twilio first (decision 8) with since = the appointment minus its minutes, never the job's created_at or run_at, and :217-218 has the 60-after-1200 retry case in the Done when. 8b.2's code does not pre-empt it: the only `since` passed today is the confirmation's, the booking's creation (send-confirmation-text.ts:66), and booking-text-job.ts leaves the reminder path to 8b.3.

### F-202 [P3] closed - The feature 12 half of F-199 lives only in this spec's notes, which are archived with 8b, and item 12 has no line for text settings at all

**File:** blueprint/context/current-feature.md:288-289 (plan: blueprint/build-plan.md:264-307)
**Found:** 2026-10-07 by re-review of 8b.1's fixes (scope: 7582593..9b8793a, with 3b47c1c..9b8793a as context; lenses: quality, security, performance, tests)
**Why it matters:** The fix commit records "Feature 12 (Settings): saving text
settings refuses a reply phone that is any business's texting number" in 8b's
Notes for the AI. `/complete` archives this spec with feature 8b, and feature
12's spec is drafted from build-plan.md, whose item 12 (264-307) names no
text settings at all, although the spec's Out of scope puts the Settings
screen for texts in feature 12. The earlier carried note of the same kind,
F-32, was written onto item 12 for that reason. Once 8b.4 closes F-199, the
save-time refusal survives only in an archive nobody specs from. The run-time
guard in 8b.4 still protects Jane, so the cost is a Settings screen that
accepts a value the job then silently ignores.
**Suggested fix:** With Frank's yes (the build plan is his), add to item 12 a
line for the text settings screen, including the F-199 refusal on save (and
the no-repeats rule the table cannot enforce).
**Resolution:** Fixed 2026-10-07 on Frank's yes: build-plan item 12 has a "Text settings" line (the number, the confirmation, any reminders, where replies go, nothing on by default; saving refuses a reply phone that is any business's texting number), and the overview's Settings line names text settings, its fingerprint refreshed. Closed 2026-10-07 by re-review of 8b.2's fixes: build-plan.md:303-307 has the Text settings line under item 12, saving refusing a reply phone that is any business's texting number (cited as "8b, F-199", the form item 12 already uses for F-50 and F-32); project-overview.md:87 names text settings; the source-hash recomputed by the overview rule from the working-copy bytes (project-plan.md, one zero byte, build-plan.md with completion marks normalized) is caf441cf8a70c963705f9e8b3acee89b7dd51c13037524915aee2f9760643bcb, matching project-overview.md:3.

### F-203 [P3] closed - SendTextError's list of codes leaves out the new "unreadable_answer" (and "http_NNN")

**File:** backend/lib/text/send-text-error.ts:7 (codes thrown: backend/lib/text/send-text.ts:168-173, backend/lib/text/find-sent-text.ts:63-68, backend/lib/text/twilio-error-code.ts:10)
**Found:** 2026-10-07 by re-review of 8b.1's fixes (scope: 7582593..9b8793a, with 3b47c1c..9b8793a as context; lenses: quality, security, performance, tests)
**Why it matters:** The field's comment reads "Twilio's error code, "timeout",
"no_connection" or "no_keys"". The fix commit adds a fourth code,
"unreadable_answer", thrown by both send-text.ts and find-sent-text.ts, and
`twilioErrorCode` already returns `http_<status>`. 8b.2 will log this code on
`sms` failures, so a reader of the class is told the set is closed when it is
not. Nothing branches on the code today (callers branch on `retry`), hence P3.
**Suggested fix:** Name every code in the comment ("Twilio's error code,
"http_502", "timeout", "no_connection", "no_keys" or "unreadable_answer"").
**Resolution:** Fixed 2026-10-07 after the re-review: the comment on SendTextError's code lists http_<status> and unreadable_answer too. Closed 2026-10-07 by /audit of 8b.2 (bab087f..23ebb83): send-text-error.ts:7-8 names "http_<status>", "unreadable_answer", "timeout", "no_connection" and "no_keys"; every `new SendTextError` in backend/lib (send-text.ts:33, 58, 65, 75, 89; find-sent-text.ts:41, 50, 63) throws one of those or Twilio's own code, and twilio-error-code.ts returns only Twilio's code or `http_<status>`. 8b.2 logs the code only for a never-retry refusal (send-confirmation-text.ts:77), whose codes are Twilio's fixed numbers.

### F-204 [P3] closed - The confirmation is one piece only for business names of up to 30 plain characters; nothing keeps a longer name, or one with | ~ { } [ ] ^ \, to one piece

**File:** backend/lib/text/render-confirmation-text.ts:15-20 (test: backend/lib/text/render-confirmation-text.test.ts:11, 75)
**Found:** 2026-10-07 by /audit (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** Decision 4 says each text fits one billed piece. With a
32-character app address the fixed parts take 130 characters, so the name
gets 30. Measured against the built renderer (scratch script, Wed Sep 30
11:45am, the test's link): a 30-character name gives 160, a 31-character name
161, "Face & Body Aesthetics Clinic Inc." 164, two pieces each. Business names
are allowed up to 80 characters (business-name-validation-schema.ts:11), so
the four tenants' current names pass only by luck of length. Separately, the
test counts every plain character as one, but `[ ] \ ^ { | } ~` are GSM-7
extension characters that cost two each: "Face | Body {Clinic} ~ Spa" renders
at 156 characters, 160 septets, and one more such character would split it
while `text.length <= 160` still passes. 8b.3's reminder wording
(" reminder: " is two characters longer than ": booked ") leaves 28.
**Suggested fix:** Decide with Frank what a too-long text does (a short
"text name" in text_settings, cutting the name, or a limit refused at client
setup / Settings), and record the budget in the spec; count extension
characters as two in the one-piece test (or strip them in `plainText`). Cover
the reminder's wording in 8b.3's length test.
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: text-piece-length.ts counts the eight double-cost characters as two, and fit-business-name.ts cuts a business name a word at a time from its end until the text fits 160; render-confirmation-text.ts uses it (8b.3's reminder will too). Tests: a 70-character name keeps its start, the time and the link and fits; a name full of | { } ~ [ ] ^ fits by that count. Spec decision 4 says so; the deploy notes say APP_ORIGIN must stay short (about 30 characters) and must not name the product. Re-review of 8b.2's fixes (2026-10-07): left `fixed`. The code holds: probed against the built renderer, the 70-character Summit name is cut to "Summit Painting and Decorating" at 160, and the name full of | { } ~ [ ] ^ to "Face | Body {Clinic} ~ Spa" at 156 characters, 160 by the piece count. But the test does not pin the double count where the fitter uses it: with fit-business-name.ts:14 changed to `text.length > ONE_PIECE`, all 20 tests in render-confirmation-text.test.ts still pass (run in this pass; file restored, cmp identical, `git status` unchanged), because the next word, "[Calgary]", overshoots both counts. A name that splits the two counts would pin it: "Face | Body Aesthetics Clinics" makes a text of 160 characters but 161 by the piece count, which the fitter cuts to "Face | Body Aesthetics" (153) and a length count would send whole, in two pieces. The repair also brings F-210. Fixed again 2026-10-07 after the re-review: render-confirmation-text.test.ts has "a name whose text is 160 characters but more by the double count is cut to fit" (Face | Body Aesthetics Clinic AB, cut to Face | Body Aesthetics Clinic); proved: the fitter counting text.length fails it. Closed 2026-10-07 by the audit of 8b.3: probed against the built renderers (backend/dist, Wed Sep 30 11:45am, the tests' 30-character origin), "Face | Body Aesthetics Clinic AB" makes a confirmation of 160 characters but 161 by the piece count, so a length-counting fitter would send it whole, while fit-business-name.ts:18 cuts it to "Face | Body Aesthetics Clinic" (158 by the count; the reminder 160); render-confirmation-text.test.ts pins it. The reminder goes through the same fitter (render-reminder-text.ts:9-13), and render-reminder-text.test.ts covers the four tenants and a 70-character name at the longest time, each one piece by textPieceLength.

### F-205 [P3] closed - The email preview's sample link and the link helper's comment still describe the old link

**File:** backend/scripts/email-preview.ts:36-37; backend/lib/booking/booking-page-url.ts:1
**Found:** 2026-10-07 by /audit (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** Decision 11 changed the link to 22 + 22 base64url
characters. The preview script says "A link of the right shape" over
`/b/00000000-0000-4000-8000-000000000000.sample`, the old 36-hex form, so the
preview's email shows a link about twice the real length and the comment is
now false. booking-page-url.ts says the address is "as the customer's emails
link it"; since 8b.2 the confirmation text carries it too
(send-confirmation-text.ts:54).
**Suggested fix:** Make the sample a packed-shape link (for example 22 and 22
characters) and say emails and texts in booking-page-url.ts.
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: the email preview's sample link has the packed shape (22.22 characters), and booking-page-url.ts says emails and texts carry it. Closed 2026-10-07 by re-review of 8b.2's fixes: email-preview.ts:37-38 samples `/b/AAAAAAAAQACAAAAAAAAAAA.sampleSignatureForPrev`, 22 + 22 characters (the first part is the sample uuid 00000000-0000-4000-8000-000000000000 packed), and booking-page-url.ts:1-3 says emails and texts link it.

### F-206 [P3] closed - 8b.2 brings the first step numbers and history into code comments

**File:** backend/lib/text/send-confirmation-text.ts:1-2; backend/lib/jobs/booking-text-job.ts:8-9; backend/lib/jobs/booking-text-job.test.ts:1; backend/lib/booking/booking-page-token.test.ts:25, 55
**Found:** 2026-10-07 by /audit (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md:358-359: "No history in code comments
(step numbers, finding numbers, ...): that lives in the build log." `git grep`
for `// ... step N.M` finds no match at bab087f and three at 23ebb83
("step 8b.2", "step 8b.3", "step 8b.2"). The token test adds history too:
"Packed once, in 8b before any customer had one" and "as links once were".
Feature and decision pointers ("feature 8b, decision 11") are the codebase's
usual form and are not part of this.
**Suggested fix:** Drop the step numbers (keep "feature 8b"), and say what the
token test checks rather than when the link changed ("the booking id written
out in full opens nothing").
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: the step numbers are out of send-confirmation-text.ts, booking-text-job.ts and booking-text-job.test.ts, and the history lines are out of booking-page-token.test.ts; `git grep -n "step 8b"` in backend finds none. Closed 2026-10-07 by re-review of 8b.2's fixes: `git grep -n -E "step [0-9]+[a-z]?\.[0-9]|F-[0-9]{2,}"` over backend, packages and frontend code finds only an old migration comment (F-06), and the token test's comments (booking-page-token.test.ts:24-25, :55) say what is checked, with no history. The fix's new files (fit-business-name.ts, text-piece-length.ts) carry none either.

### F-207 [P3] closed - plainText drops letters that do not decompose, so "Bjørn" becomes "Bjrn" and "Cœur" becomes "Cur"

**File:** backend/lib/text/plain-text.ts:9-15
**Found:** 2026-10-07 by /audit (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** NFKD splits é, è, ç and ô into a letter and a mark, but
ø, æ, œ, ß, ł and đ have no decomposition, so the last replace deletes them.
Measured with the built renderer: "Bjørn's Painting" is sent as "Bjrn's
Painting". Every tenant is in Canada, where œ appears in French names
("Cœur", "Sœurs"). Decision 4 asks for plain ASCII, not for dropped letters;
the business's own name is the one word the text must get right.
**Suggested fix:** Map the few letters NFKD leaves alone before the final
replace (ø→o, æ→ae, œ→oe, ß→ss, ł→l, đ→d, and their capitals), with a test
case in render-confirmation-text.test.ts.
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: plainText spells out the letters NFKD does not split (o for ø, ae for æ, oe for œ, ss for ß, l for ł, d for đ, th for þ, and their capitals, plus ð and dotless i). Test: "Bjørn's Cœur Straße Łódź" becomes "Bjorn's Coeur Strasse Lodz". Closed 2026-10-07 by re-review of 8b.2's fixes: plain-text.ts:9-26 maps the 16 letters NFKD leaves whole, and the character class at :32 lists the same 16; render-confirmation-text.test.ts:40-44 passes. Proved in this pass: with the map's replacement changed to "", that test fails (received "Bjrn's Cur Strae odz"); the file was restored byte for byte (cmp) and `git status` showed it unchanged.

### F-208 [P3] closed - The "no time zone" skip has no test, the one skip case of 8b.2's Done when left uncovered

**File:** backend/lib/text/send-confirmation-text.ts:42 (tests: backend/lib/jobs/booking-text-job.test.ts)
**Found:** 2026-10-07 by /audit (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** 8b.2's Done when says "each skip case sends nothing", and
the step lists six: not confirmed, started, no settings, confirmation off, no
time zone, no textable phone. The job test covers five; nothing builds a
business without its own availability rule. Today `tsc` would refuse a null
zone reaching `renderConfirmationText`, but a change that defaults it (say to
the server's zone) keeps both the build and the suite green while the text
states a wrong time; without the guard and the types, `Intl.DateTimeFormat`
throws "Invalid time zone specified: null" (checked with node) and the job
retries ten times for nothing.
**Suggested fix:** A case in booking-text-job.test.ts: book, then delete the
business's own availability rule before working the job; expect no Twilio
call and the "the business has no time zone" log line.
**Step review note (independent, 2026-10-07):** agreed, P3. The guard is
reachable only that way: `availability_rule_row_kind_check`
(availability-rule-table.ts) refuses a business row without a timezone and
`availability_rule_business_unique` allows one per business, so the left join
in find-booking-text-context.ts yields null only when the business's own row
is gone, which is what the suggested test sets up.
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: booking-text-job.test.ts has "a business with no time zone: nothing is sent" (its hours row removed after booking), which checks the logged reason. Closed 2026-10-07 by re-review of 8b.2's fixes: booking-text-job.test.ts "a business with no time zone: nothing is sent" removes the business's hours after booking and checks no Twilio call and the logged reason. Proved in this pass: with the guard removed and the zone defaulted to America/Edmonton, that test fails (1 failed, 13 passed); file restored (cmp), `git status` unchanged.

### F-209 [P3] closed - The lost-answer test does not pin which `since` the confirmation's retry passes; the booking's time or the retry's own time would keep it green

**File:** backend/lib/jobs/booking-text-job.test.ts:361-392 (code: backend/lib/text/send-confirmation-text.ts:66)
**Found:** 2026-10-07 by independent step review (scope: 8b.2, bab087f..23ebb83; lenses: quality, security, performance, tests)
**Why it matters:** Decision 8 and F-201 put the harm in the job's choice of
`since`: the booking's creation for the confirmation. The only job-level test
of the check lists Twilio's text with `date_created: new Date()` (test line
377), the real clock at list time, while the booking's time NINE is
2026-10-05 (line 47), already in the real past, and the job clock is pinned to
2026-10-02. So `since: context.startsAt` (earliest Oct 5 14:59:50, before the
listed Oct 7 date) and `since: new Date()` at the retry (earliest 10 s before
a date taken after it) both still find the text and pass, as `createdAt` does.
In production both are wrong: the confirmation goes days before `startsAt`, so
a `startsAt` cutoff never finds it and Jane gets the text twice; a retry-time
cutoff misses any text sent more than 10 s before the retry, which is every
timed-out send (10 s limit plus the e^1 s wait). 8b.3 adds the reminder's
`since` (the appointment minus its minutes) to the same job, the likeliest
moment for the confirmation's to be unified with it, and nothing would turn
red. find-sent-text.test.ts bounds only the slack, given a correct `since`.
**Suggested fix:** In that test, set the booking's `createdAt` to a fixed
moment before NINE (for example update it to 2026-10-02T13:59:00Z after
booking) and list the text dated a minute after it; add a twin case with the
same words dated a minute before that `createdAt`, expecting a POST.
**Resolution:** Fixed 2026-10-07 in 8b.2's review fixes: the lost-answer test pins the booking's creation to 2026-10-01 12:00 and runs twice, the same words dated a minute after (found, nothing sent again, SM7 recorded) and a minute before (another text, sent). Proved: since: context.startsAt fails the first case. Closed 2026-10-07 by re-review of 8b.2's fixes: booking-text-job.test.ts pins the booking's createdAt to 2026-10-01 12:00 and lists the same words a minute after (found, GET only, SM7 recorded) and a minute before (sent, SM1 recorded); send-confirmation-text.ts:66 passes context.createdAt. Proved in this pass: `since: jobClock.now()` fails the minute-after case and `since: new Date(0)` fails the minute-before case (1 failed, 13 passed each); file restored (cmp), `git status` unchanged.

### F-210 [P3] closed - A business name cut to fit can end on "&", a comma or a hyphen, so the text opens "Summit Painting, Decorating &: booked"

**File:** backend/lib/text/fit-business-name.ts:14-17
**Found:** 2026-10-07 by re-review of 8b.2's fixes (scope: 23ebb83..f5c4f6d, with bab087f..f5c4f6d as context; lenses: quality, security, performance, tests)
**Why it matters:** The fitter drops whole words from the end and stops at
the first fit, whatever the last word left is. Probed against the built
renderer (Wed Sep 30 11:45am, the test's 32-character origin):
"Summit Painting, Decorating & Renovations Ltd." is sent as "Summit
Painting, Decorating &: booked Wed Sep 30, 11:45am. ..." (159), and a name
cut after a lone "-" or a word ending in "," reads the same way. The
business's name is the part of the text the customer reads to know who it is
from (the reasoning F-207 was fixed on), and decision 4 says only that a long
name "loses words from its end", not that it may end mid-phrase. Reachable
only for names over about 30 characters, hence P3.
**Suggested fix:** After a cut, also drop trailing words that hold no letter
or digit ("&", "-", "|") and trailing commas, hyphens and colons from the
last word kept; a test with "Summit Painting, Decorating & Renovations Ltd."
expecting "Summit Painting, Decorating: booked". Whether to drop "and" and
"of" too is a wording call for Frank, not needed for the fix.
**Resolution:** Fixed 2026-10-07 after the re-review: fit-business-name.ts trims a joining mark (& + , ; : / ( - and spaces) from the end of a cut name. Test: "a cut name never ends on a joining mark"; proved: cutting without the trim fails it. Closed 2026-10-07 by the audit of 8b.3: fit-business-name.ts:12 trims & + , ; : / ( - and spaces from the end of a cut name, and the fit is measured on the trimmed name (:20); probed against the built renderers, "Summit Painting, Decorating & Renovations of Southern Alberta Ltd." opens "Summit Painting, Decorating: booked" (155) and "Summit Painting, Decorating reminder:" (157). The confirmation test pins it and the reminder uses the same function.

### F-211 [P3] closed - fit-business-name.ts exports an unused ONE_PIECE beside the function, and the test keeps its own copy of 160

**File:** backend/lib/text/fit-business-name.ts:8 (test: backend/lib/text/render-confirmation-text.test.ts:11)
**Found:** 2026-10-07 by re-review of 8b.2's fixes (scope: 23ebb83..f5c4f6d, with bab087f..f5c4f6d as context; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md:113-114 puts backend files at one
file per export, and the spec repeats it for backend/lib/text (one export per
file, current-feature.md:257-260). The fix adds a second export,
`ONE_PIECE`, that nothing imports (`git grep ONE_PIECE` finds only its own
use at :14 and the test's separate `const ONE_PIECE = 160`). The piece size
now lives in two places that must change together, and text-piece-length.ts,
whose comment names "a text piece's 160", is where the measure belongs.
**Suggested fix:** Keep 160 private to the fitter (drop the `export`), or
move the fit check beside the measure (`fitsOnePiece(text)` in its own
file) and have both the fitter and the test use it rather than their own 160.
**Resolution:** Fixed 2026-10-07 after the re-review: ONE_PIECE is no longer exported from fit-business-name.ts; it is the file's own constant. Closed 2026-10-07 by the audit of 8b.3: `git grep ONE_PIECE` finds the fitter's private const (fit-business-name.ts:8, used at :18) and each test file's own copy (render-confirmation-text.test.ts:11, render-reminder-text.test.ts:9), the first option the suggested fix allowed; fit-business-name.ts exports only the function.

### F-212 [P3] closed - The spec's Wording and file list, and 8b.3, were not brought along with decision 4's new count and the fitter

**File:** blueprint/context/current-feature.md:307, 255-262, 205-219 (rule: decision 4 at :83-85; test: backend/lib/text/render-confirmation-text.test.ts:14-15)
**Found:** 2026-10-07 by re-review of 8b.2's fixes (scope: 23ebb83..f5c4f6d, with bab087f..f5c4f6d as context; lenses: quality, security, performance, tests)
**Why it matters:** The fix amended decision 4 (160 counting the eight
double-cost characters as two; a too-long name loses words), but the Wording
block that 8b.3 and 8b.4 are written from still says "at most 160
characters" (:307), the file list (:255-262) names neither
fit-business-name.ts nor text-piece-length.ts, and 8b.3's Done when
(:214-219) has no one-piece case for the reminder, whose " reminder: " is two
characters longer than ": booked " (F-204's own suggestion was to cover it
there). F-204's resolution says "8b.3's reminder will too" use the fitter;
only this ledger says so, and 8b.3 is built from the spec. Separately, the
test's "longest app address the texts are planned for" is
`https://app.scheduleads-mail.com` (32 characters, naming the product), while
the deploy note this fix added says the address must be about 30 characters
and must not name the product.
**Suggested fix:** Wording: "one piece by decision 4's count, a long name
fitted as decision 4 says"; list the two new files under 8b.2; add to 8b.3's
Done when "with the same app address and the longest time, the reminder is
plain and one piece by the piece count, a long name cut". Give the test's
sample origin a neutral name of the same length.
**Resolution:** Fixed 2026-10-07 after the re-review: the spec's Wording block counts by textPieceLength and names fitBusinessName, the file list names fit-business-name.ts and text-piece-length.ts, 8b.3's Done when has the reminder's one-piece cases through fitBusinessName, and the tests' sample app address is https://booking.example-app.ca (30 characters, not the product's name). Closed 2026-10-07 by the audit of 8b.3: current-feature.md's Wording block counts "at most 160 by `textPieceLength`" and cuts a long name "by `fitBusinessName`"; the file list names fit-business-name.ts, text-piece-length.ts and render-reminder-text.ts; 8b.3's Done when has the reminder through fitBusinessName and the four tenants' one-piece cases, built as render-reminder-text.test.ts; both render test files use https://booking.example-app.ca, and `git grep scheduleads-mail` in backend finds nothing.

### F-213 [P3] fixed - The reminder retry's `since` is pinned only against the booking's creation; a `since` of the retry's own time or its run_at keeps every test green

**File:** backend/lib/text/send-booking-text.ts:94-101 (test: backend/lib/jobs/booking-text-job.test.ts:603)
**Found:** 2026-10-07 by /audit (scope: 8b.3, 0e863ac..6a646a9; lenses: quality, security, performance, tests)
**Why it matters:** 8b.3 says the reminder's retry checks Twilio with
`since` = the appointment minus its minutes, "never the job's `created_at`
(the booking's time) or `run_at` (which moves with each retry)" (F-201). The
one reminder retry test ("the 60-minute reminder's retry still sends after
the 1200-minute one went") lists a text dated at the 1200-minute moment
(2026-10-04 19:00Z) and fails only for a `since` at or before that, such as
the booking's creation or the pinned job clock. A `since` of `new Date()` or
the job's `run_at` (both the real day, 2026-10-07, in the tests, after
makeDue) also passes over that text and sends, so the test stays green. No
reminder test has the lost-answer case the confirmation has
(booking-text-job.test.ts:362-411): a reminder Twilio took at its own moment,
its answer lost, the retry finding it and sending nothing. With either wrong
`since` in production, every reminder whose answer was lost is sent twice,
which is what decision 8 exists to prevent. Same gap F-209 closed for the
confirmation.
**Suggested fix:** A reminder twin of the confirmation's lost-answer
`test.each`: the 60-minute reminder's first try taken with its answer lost,
Twilio listing the same words dated a minute after the reminder's moment
(found: POST then GET, nothing sent again, the listed sid recorded with
minutesBefore 60) and dated a minute before it, past the 10-second slack
(sent again).
**Resolution:** Fixed 2026-10-07 in 8b.3's review fixes: booking-text-job.test.ts has "a reminder's retry after its answer was lost" twice, the same words dated a minute after the reminder's moment (found, not sent again, SM7 recorded) and a minute before (sent). Proved: since = new Date() fails the first case.

### F-214 [P3] fixed - A reminder job whose payload has no minutes is sent as the confirmation text

**File:** backend/lib/jobs/booking-text-job.ts:10-24
**Found:** 2026-10-07 by /audit (scope: 8b.3, 0e863ac..6a646a9; lenses: quality, security, performance, tests)
**Why it matters:** The payload type allows `{ kind: "reminder",
minutesBefore: null }`, and the job turns anything that is not a reminder
with minutes into `{ kind: "confirmation" }`. A malformed reminder payload,
or a later kind added to `booking_text` without this line, would send the
customer a "booked" text they never asked for, bill it, and record it as a
confirmation, instead of failing where it can be seen. Not reachable from the
only producer today, enqueue-booking-texts.ts:35-46, which always sets the
minutes for a reminder, hence P3.
**Suggested fix:** Make the payload a union (`{ kind: "confirmation";
minutesBefore: null } | { kind: "reminder"; minutesBefore: number }`) and
map each kind explicitly, throwing on anything else, so an impossible
payload never becomes a text.
**Resolution:** Fixed 2026-10-07 in 8b.3's review fixes: BookingTextJobPayloadType is a union (a confirmation's minutesBefore is null, a reminder's a number); the job sends a reminder only with its minutes, a confirmation only as one, and throws for anything else. Test: "a job that is neither text sends nothing and fails, so it is seen"; proved: falling back to the confirmation fails it.

### F-215 [P3] fixed - No test books with one reminder already past and another still ahead, so adding none once any is past keeps every test green

**File:** backend/lib/jobs/enqueue-booking-texts.ts:42 (test: backend/lib/jobs/booking-text-job.test.ts:557)
**Found:** 2026-10-07 by independent review of 8b.3 (scope: 0e863ac..6a646a9; lenses: quality, security, performance, tests)
**Why it matters:** 8b.3 says "none added for a time already past", which
means each reminder is judged on its own: a booking made 90 minutes ahead
with Summit's [1200, 60] gets the 60 and not the 1200. The only past-time
test ("a booking made 30 minutes ahead gets no 1200-minute reminder") books
at 8:30 for 9:00, where both reminders are past, and expects none. Every
other reminder test books on the Friday, where none is past. So changing
`continue` at :42 to `return` or `break` (stop at the first past one, with
the settings stored [1200, 60]) still passes all seven reminder tests, and
in production every booking made under 20 hours ahead would lose its
60-minute reminder too. Found by reading; not mutation-run, since this pass
edits no source.
**Suggested fix:** In that test, or a twin, book 90 minutes ahead (7:30 for
9:00) and expect exactly one job, `{ runAt: 2026-10-05T14:00Z, minutesBefore:
60, sequence: 0 }`, and the 60-minute reminder sent.
**Resolution:** Fixed 2026-10-07 in 8b.3's review fixes: "a booking made 90 minutes ahead gets its 60-minute reminder and not its 1200-minute one" expects exactly the 60-minute job; proved: continue changed to break fails it.

### F-216 [P3] fixed - The spec's file list still names a booking-texts.ts for the wording, and the text job test's header still says it covers the confirmation

**File:** blueprint/context/current-feature.md:269; backend/lib/jobs/booking-text-job.test.ts:1
**Found:** 2026-10-07 by independent review of 8b.3 (scope: 0e863ac..6a646a9; lenses: quality, security, performance, tests)
**Why it matters:** 8b.3 edited this list to add send-booking-text.ts and
render-reminder-text.ts, and the same list says the wording is one file per
text ("so the reminder's wording is its own file in 8b.3"), yet two lines
down it still names `booking-texts.ts` (the wording), which does not exist
(`ls backend/lib/text`). 8b.4 builds from this list, and the passed-on
reply's wording could land in a booking-texts.ts beside the one-per-file
render files. The test file now holds the reminders' seven cases, but its
first line reads "A booking's confirmation text as a job".
**Suggested fix:** Drop `booking-texts.ts` (the wording) from the list, or
name the reply's wording file 8b.4 will add (for example
render-reply-text.ts); say "A booking's texts as jobs" in the test's header.
**Resolution:** Fixed 2026-10-07 in 8b.3's review fixes: the spec's file list no longer names booking-texts.ts (the wording is one render file per text), and booking-text-job.test.ts's first lines say it holds the confirmation and the reminders.
