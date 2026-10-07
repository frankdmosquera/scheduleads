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
