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

### F-307 [P3] open - The setup command still says nothing when a person the file gives no own hours or no worker texts has such a row by hand

**File:** packages/shared/client-setup/run-client-setup.ts:156, 177
**Found:** 2026-10-10 by the independent review of the address fix (scope: current, 2428dbd..0e8fbb1; lenses: quality, security, performance, tests)
**Why it matters:** F-304's repair compares a person's own hours only `if (person.weeklyHours !== undefined || person.dateHours?.length)` and their worker texts only `if (person.workerTexts)`. The setup file's own meaning of a missing week is "no row, the business's week" and of missing workerTexts "no texts" (client-setup-validation-schema.ts:29, 32). So a person listed without hours who was given their own week by hand, or one listed without texts who was given worker-text settings by hand, works or is texted differently from what the file says, and the command prints no "differs, kept" line. Same class as F-304, the case its repair did not reach. Not reachable with today's only setup file (agentsweb.ts has `people: []`); nothing is lost, every row is kept.
**Suggested fix:** Drop the two `if` guards so the row is read for every listed person that exists, and report a saved row against the file's `null`/`[]` or missing texts; one more hand edit in the "keeps a row changed by hand" test (Room A or a person with no hours given a week).
**Resolution:**

### F-308 [P3] open - The Google event without an address is not shown by any test, though the step's Done when names it

**File:** backend/lib/calendar/google-calendar-provider.ts:72; backend/lib/calendar/write-booking-event.test.ts
**Found:** 2026-10-10 by the independent review of the address fix (scope: current, 2428dbd..0e8fbb1; lenses: quality, security, performance, tests)
**Why it matters:** The step's Done when reads "tests show ... every email, invite, event and worker text renders without one". The emails (booking-emails.test.ts), the invite (booking-ics.test.ts) and the worker text (render-worker-text.test.ts) each gained a no-address case; the event did not: write-booking-event.test.ts only writes bookings with "12 Main Street, Calgary", and google-calendar-provider.ts has no test file, so `location: event.location ?? undefined` (which relies on JSON.stringify dropping an undefined key) is checked by reading only. The code is correct as read; the gap is the missing proof the spec asks for.
**Suggested fix:** One write-booking-event case for a booking saved with `location: null` asserting the event handed to the provider has `location: null`, and, if a provider test is ever added, that the body sent to Google has no `location` key.
**Resolution:**

### F-309 [P3] open - The setup file's hours get their input type through `as unknown as`, the repo's only double cast, where z.preprocess takes the input type as a generic

**File:** packages/shared/zod-validation/admin-validation-schemas/client-setup-validation-schema.ts:14-24
**Found:** 2026-10-10 by the independent review of the address fix (scope: current, 2428dbd..0e8fbb1; lenses: quality, security, performance, tests)
**Why it matters:** F-305 is fixed by casting the preprocess to `z.ZodType<output, Omit<input, "resourceId">>` through `unknown`. A double cast tells the compiler to stop checking that the declared types match the schema; `git grep "as unknown as"` finds no other one in backend, frontend or packages. Zod 4's own signature (`preprocess<A, U extends core.SomeType, B = unknown>(fn: (arg: B, ...) => A, schema: U): ZodPreprocess<U, B>`, node_modules/zod/v4/classic/schemas.d.ts:816) sets the input type directly, which is what F-305's suggested fix named. Behaviour and the editor check are correct today.
**Suggested fix:** `z.preprocess<unknown, BusinessHoursType, Omit<z.input<BusinessHoursType>, "resourceId">>(fn, businessAvailabilityRuleValidationSchema)` with no cast; the type probe from F-305 should still refuse a wrong field.
**Resolution:**

### F-310 [P3] open - 34 test fixtures gained a stray blank line before `asksAddress: true`

**File:** backend/lib/booking/book-time.test.ts:90, 102 and 32 more lines across the backend test files and booking-window.test.ts:71
**Found:** 2026-10-10 by the independent review of the address fix (scope: current, 2428dbd..0e8fbb1; lenses: quality, security, performance, tests)
**Why it matters:** The column was added to every test's bookingLink rows by a mechanical edit that left an empty line inside each object literal (`git diff 2428dbd..0e8fbb1 -U1` shows 34 added empty lines directly above `asksAddress: true,`). Prettier keeps single blank lines, so format:check passes and nothing catches it; the fixtures now read as half-finished edits and the next mechanical change will copy the shape.
**Suggested fix:** Remove the empty line above each `asksAddress: true,` in those fixtures (a test-only chore; no behaviour changes).
**Resolution:**

### F-318 [P3] open - the due-time zone choice has no saved test

**File:** backend/routes/leads-routes.test.ts:213-236; backend/lib/crm/add-next-step.ts:40-44
**Found:** 2026-10-10 by the final independent review of feature 11 (main...648ba0c)
**Why it matters:** F-314 added logic (the business's zone, else the browser's; a skipped spring hour and an impossible date refused) that no test pins, so a regression to the browser's zone would pass the suite.
**Suggested fix:** One test that checks the saved dueAt for a business with a zone; one for a spring-forward time (400, field dueLocal) and for 2026-02-30T09:00.
**Resolution:** Carried on purpose: under the workspace rule of 2026-10-10 (tests only where a mistake would really hurt), an hour off on a note to self did not earn a test yet.

### F-319 [P3] open - the repeat-save "already a contact" flag has no saved test

**File:** backend/routes/leads-routes.test.ts:181-198; backend/lib/crm/add-lead-by-hand.ts:89-106
**Found:** 2026-10-10 by the final independent review of feature 11 (main...648ba0c)
**Why it matters:** F-316's timestamp comparison is untested; reversed, a retry would show "Already a contact" for someone new.
**Suggested fix:** The same form twice with a known email, expect joinedExistingContact true on both answers; with a new email, false on both.
**Resolution:** Carried on purpose, for the same reason as F-318: only a notice on screen is at stake.
