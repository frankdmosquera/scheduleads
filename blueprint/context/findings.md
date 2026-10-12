# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-32 [P3] fixed - A pick is the package's display name, so a renamed holiday would take a business's booking page down

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
item 12 in `build-plan.md`. Stays unverified until then. Fixed in feature 12e, step 12e.3 (ca5748d, 08df35d, e65d66d): a pick the holiday list no longer has closes nothing and never fails (`closedHolidays`), the booking window logs it, the save refuses it and the Days off page marks it to untick; test "a holiday the list no longer knows is skipped and the other picks still close". Awaits an /audit pass to close.

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
**Resolution:** Still open 2026-10-11 (independent review of feature 12f): feature 12f renamed the column, and the same blank lines now sit above `addressMode: "required",` (and `"not_asked"`) in those fixtures.

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

### F-326 [P3] unverified - A time field cleared mid-edit may snap back while the owner is still typing

**File:** frontend/components/settings/day-windows-editor.tsx:43-48
**Found:** 2026-10-10 by independent review of step 12a.1 (scope: 86675f7..bbd7510; lenses: quality, security, performance, tests)
**Why it matters:** An unfinished time keeps the window's last whole time on purpose; in some browsers the controlled field may redraw the old value while a segment is being retyped. Not seen in a browser yet.
**Missing validation:** Type over one segment of a time field by keyboard in Chrome and Edge.
**Resolution:**

### F-331 [P3] unverified - A booking made while a save of hours is running can land outside the new hours and never be listed

**File:** backend/lib/booking/book-time.ts:155, 214-226, 254; backend/lib/settings/save-business-hours.ts:31-62
**Found:** 2026-10-10 by independent review of step 12a.2 (scope: 0f33b77..47dc46e; lenses: quality, security, performance, tests)
**Why it matters:** book-time reads the hours and checks the start (findBookingChoices, which may wait on Google) before its transaction, with no lock on the business's availability_rule row. If a save locks the row and reads the upcoming bookings in between, the new booking is not yet committed, so the save does not see it; it then commits against the old hours. The owner is told the list is complete and it is not. Unverified: needs the two to overlap within one booking's check time; no reproduction was run.
**Suggested fix:** Inside the booking's transaction, read the business's availability_rule row `for share` (it waits while a save holds it `for update`) and refuse with the existing "unavailable" answer if the row changed since the hours were read; or record the gap as accepted.
**Resolution:**

### F-332 [P3] open - "Which windows apply on this date" now lives in three copies that the spec requires to agree

**File:** backend/lib/bookable-hours/apply-outside-hours-rules.ts:25-43; backend/lib/scheduling/apply-free-times-rules.ts:34-39, 57-60; backend/lib/bookable-hours/apply-bookable-hours-rules.ts:48-54
**Found:** 2026-10-10 by independent review of step 12a.2 (scope: 0f33b77..47dc46e; lenses: quality, security, performance, tests)
**Why it matters:** windowsOn re-implements the person/business one-off date merge of applyBookableHoursRules and copies free times' WEEKDAYS, weekdayOf and "a one-off date replaces the week" lookup. The step is only correct while these agree, and nothing ties them: F-330 is one such drift already. Today the merge copy matches (checked case by case: own week takes only own dates; following takes the business's with own winning; an empty one-off list replaces the day in both).
**Suggested fix:** One exported helper in lib/bookable-hours/ (for example `windowsOnDate(weeklyHours, dateHours, date)`, with the merge in one place) used by both applyFreeTimesRules and applyOutsideHoursRules.
**Resolution:**

### F-334 [P3] unverified - The list's times use the browser's time-zone rules, which the booking window deliberately avoids

**File:** frontend/components/settings/outside-hours-list.tsx:37; backend/lib/scheduling/local-start-times.ts:1-4
**Found:** 2026-10-10 by independent review of step 12a.2 (scope: 0f33b77..47dc46e; lenses: quality, security, performance, tests)
**Why it matters:** local-start-times.ts formats times on the API "never re-deriving them with the visitor's browser, whose rules may be older". The outside list formats in the browser. Node here carries tzdata 2026c, where America/Edmonton stays on MDT after November 2026; a browser with older rules would show an Alberta booking after November 1 an hour early and as MST, on the one list whose point is the time. The spec's contract chose browser formatting, so this is a question for the spec, not a build slip. Unverified: no browser with stale rules was tried.
**Suggested fix:** Have outsideHoursOf add a `when` string per row with formatBookingTime on the API, as localStartTimes does, and show that.
**Resolution:**

### F-348 [P3] unverified - A booking made while a person is being turned off can land on them and never be listed

**File:** backend/lib/booking/book-time.ts:213-215; backend/lib/settings/lock-business-resources.ts:1-4; backend/lib/settings/save-resource.ts:59-71
**Found:** 2026-10-10 by independent review of step 12d.2 (scope: 2a517f5..f1f8427; lenses: quality, security, performance, tests)
**Why it matters:** book-time reads who is offered (active) before its transaction and never locks the person or the business row (by design, "no key update" lets bookings through). If the turn-off commits between that read and the booking's insert, the new booking lands on a person now off and was not in the answer's list. Same shape as F-331 for hours. Unverified: needs the two to overlap; no reproduction run.
**Suggested fix:** Inside the booking's transaction, read the chosen person's row `for key share` (or `for share`) and refuse as unavailable when it is no longer active; or record the gap as accepted with F-331.
**Resolution:**

### F-383 [P3] open - Comments and the spec's step 12e.3 still describe the merged province-and-country list and the main/other split

**File:** backend/lib/bookable-hours/holiday-package.ts:79; backend/lib/bookable-hours/closed-holidays.ts:17; backend/lib/settings/find-holiday-choices.ts:20; backend/routes/settings-routes.ts:331; blueprint/context/current-feature.md:15, 123-136
**Found:** 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..e65d66d; lenses: quality, security, performance, tests)
**Why it matters:** The last fix made a picked province's own list stand alone and dropped the main/other split, but four comments still say the old thing: `holidaysBetween` "Every holiday of the business's province and country", closed-holidays.ts "province and country both list some" (the Map's reason), find-holiday-choices.ts `holidays` "the country's, and the province's when one is picked", and the GET /days-off/holidays comment "with a province, the province's too". The spec's Goal (line 15) and step 12e.3 ("Close all main holidays ticks the nine public ones", "the province's and the country's, each with ... whether it is a main (public) one", "Close all main holidays" in the frontend bullet and the Done when) still describe the old picker, while In scope and the GET contract were amended. A reader checking the rule against the code, or `/complete` reading the spec, finds the opposite of what runs. No behaviour: every path already uses the one list.
**Suggested fix:** Reword the four comments to "the province's own list when one is picked, the country's otherwise" (and drop the closed-holidays.ts Map note, or say it keeps one entry per date and name), and amend the Goal and step 12e.3 lines to the statutory list and "Close them all".
**Resolution:**

### F-393 [P3] open - A booking's answers keep the question words the request sends, so a stranger can add lines that read as the business's own questions

**File:** backend/lib/booking/check-answers.ts:36-42; packages/shared/zod-validation/booking-links-validation-schemas/create-booking-validation-schema.ts:36-40; frontend/components/leads/lead-page-screen.tsx:154-156; backend/emails/booking-notification.tsx:113-123
**Found:** 2026-10-11 by /audit independent (scope: current; lenses: quality, security, performance, tests)
**Why it matters:** Before feature 12f a lead's answer snapshot took each question's words from the business's own booking_question rows. Now every entry's `question` comes from the public request: for a live id the sent words replace the business's, and an id the business does not have is kept as a question "removed since the form opened". Anyone posting to the public bookings route can add up to 20 pairs with any words up to 200 characters (for example "Deposit already paid?" / "Yes"), and the lead page and the booking notification email show them in the same question-and-answer rows as the business's real questions, with nothing saying the business never asked them, or asked them in other words. React escapes the text, so there is no injection; the risk is an owner misled by a line that looks like his own form's. It follows directly from Frank's decision at 12f.1's review (answers keep the words the customer read), so it is a trade-off to weigh, not a breach of the spec.
**Suggested fix:** Frank's call. Keep the decided behaviour but mark the difference: record in each snapshot entry whether its words matched the live question (for example `asked: "as is" | "reworded" | "not current"`) and have the lead page and the email add "(question since changed)" for the last two; or keep removed questions (a soft delete) so an id that was never this business's can be dropped while a removed one is still kept. One route test for a made-up id.
**Resolution:**

### F-396 [P3] unverified - A booking made or moved while a save adds a reminder can miss that reminder

**File:** backend/lib/settings/save-texts.ts:36-60; backend/lib/jobs/enqueue-booking-texts.ts:40-43; backend/lib/booking/book-time.ts:358; backend/lib/booking/move-booking.ts:227
**Found:** 2026-10-12 by independent review of step 12g.1 (scope: 3cb0d0b..c1f8281; lenses: quality, security, performance, tests)
**Why it matters:** A booking or a move reads text_settings with a plain select inside its own transaction, and saveTexts' lock (`for no key update` on the business row) lets bookings through by design. If a booking's transaction reads the settings before the save commits and itself commits after the save has listed the upcoming bookings, it queues only the old reminders and the save never sees it: that customer misses the added reminder. A move in the same window misses it the same way: the save queues the reminder at the booking's old move number, which the sending job then skips as "a later move replaced it". Same shape as F-331 and F-348. Unverified: needs the two transactions to overlap; the save's per-booking loop (F-397) widens the window; no reproduction run.
**Suggested fix:** Read the settings in enqueueBookingTexts `for share` when an executor is given, so a booking waits for a save in progress (and then reads the new reminders), and a save's update waits for a booking in progress (and then lists it); the job key keeps any overlap from queuing twice. Or record it as accepted beside F-331.
**Resolution:** Carried 2026-10-12, Frank's call: the same shape as F-331 and F-348 (a plain read of the settings inside a booking's transaction while a save runs), kept with them.

### F-404 [P3] open - No test fails if a reminder queued when the booking was made loses its job key, though that is the usual way a reminder is removed and added back

**File:** backend/routes/settings-routes.test.ts:1444-1453; backend/lib/jobs/enqueue-booking-texts.ts:41-49; backend/routes/settings-routes.test.ts:77-101
**Found:** 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests)
**Why it matters:** The job key is the only thing that keeps a reminder from going twice: send-booking-text.ts checks for an earlier send only from the second attempt on. The spec's test "a reminder removed and added back sends once" makes its booking with a direct insert (makeBooking writes the row, never through book-time.ts), at a moment the 1200-minute reminder has already passed, so every job it counts was queued by the Texts save. The common case, a reminder queued when the customer booked, then removed and added back on Settings while it waits, is never exercised: if enqueueBookingTexts went back to enqueueJob without a key (or with a different key shape), every suite still passes and that customer gets the reminder twice.
**Suggested fix:** One test that books through enqueueBookingTexts (or the public booking route) with a reminder still ahead, removes and re-adds that reminder through PUT /settings/texts, and expects one job; or assert the booking-time job's key equals the one the save writes.
**Resolution:**

### F-405 [P3] open - Every member's People read carries each worker's personal phone, though only a role that may change the business ever sees it

**File:** backend/lib/settings/find-people-settings.ts:23, 47, 58; backend/routes/settings-routes.ts:231-237; frontend/components/settings/people-screen.tsx:126-172
**Found:** 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests)
**Why it matters:** GET /settings/people answers any member, and since this feature it includes `workerTexts`: each person's own phone. The page shows a phone only inside a person's card, and cards open only for `canEdit`, so a member without the permission (for example a worker with the `member` role) is never shown the numbers but receives every colleague's personal mobile in the JSON. The spec's contract does list `workerTexts` on the People read, and reads are for any member, so this is a data-minimisation trade-off rather than a broken rule; the work emails already on that read are the business's own addresses, while these phones are personal.
**Suggested fix:** Frank's call. Answer `workerTexts` only when `canEdit` (an empty list otherwise), or give non-editors only whether each person gets texts (`textsCanGo`) without the phone; one route test that the `member` role's read carries no phone.
**Resolution:**

### F-406 [P3] open - The job runner's retry limit now lives in two files

**File:** backend/lib/jobs/enqueue-jobs.ts:9-10, 29; backend/lib/jobs/enqueue-job.ts:10-11, 25
**Found:** 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests)
**Why it matters:** enqueueJobs copies `const MOST_ATTEMPTS = 10` and its decision-4 comment from enqueue-job.ts instead of importing it. Reminders now go through enqueueJobs while confirmations and every other job go through enqueueJob, so a change to the retry policy made in one file leaves reminders, or everything else, on the old limit with nothing to notice it.
**Suggested fix:** Export the constant from enqueue-job.ts (or a small jobs constants file) and import it in enqueue-jobs.ts.
**Resolution:**

### F-407 [P3] fixed - The Calendar page says "only your main calendar counts" when the connection itself needs reconnecting, though then no calendar is read at all

**File:** frontend/components/settings/busy-calendars-part.tsx:39; backend/lib/calendar/find-calendar-choices.ts:44-45; frontend/lib/api-client/calendar/fetch-calendar-choices.ts:31
**Found:** 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests)
**Why it matters:** `reconnect_needed` from GET /calendar/calendars has two causes: a connection made before 12h (no list permission, still reading the main calendar), and a connection Google stopped accepting (`needs_reconnect`, where getFreshAccessToken throws and every busy read fails, so the person is "try again" or left out). The page answers both with "Until then only your main calendar counts.", which is true for the first and false for the second, under a card that is at the same moment saying Reconnect.
**Suggested fix:** Give the two causes their own code or message (for example keep `reconnect_needed` for the broken connection and add a distinct one for "connected before the list"), and show "Until then only your main calendar counts" only for the second.
**Resolution:** Fixed 2026-10-12: the two causes are apart. A connection made before 12h answers "Reconnect ... Until then only your main calendar counts."; one Google stopped accepting answers "Reconnect your Google calendar. Until then none of your calendars is read, so customers cannot book you." (find-calendar-choices.ts `no_list_permission`, calendar-routes.ts refuseChoices); the page shows the API message as it is. Tests: both messages in calendar-routes.test.ts.

### F-408 [P3] fixed - With nothing ticked, a busy read still renews the Google key, and a connection Google stopped accepting still makes the person unbookable

**File:** backend/lib/calendar/get-busy-times.ts:20-22
**Found:** 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests)
**Why it matters:** The empty-pick return sits after getFreshAccessToken, which refreshes an expiring key at Google's token endpoint and throws CalendarReconnectNeededError on a `needs_reconnect` row. A person who chose that nothing in Google counts (Decision 3) is therefore still shown as "try again" or left out of "any available" whenever their Google permission lapses, and every free-times read for them can still cost a token call. The spec says none ticked "reads nothing from Google"; the test only counts free/busy calls, so it passes. Whether a lapsed connection should still block a person who picked nothing is a product call (the booking event write would fail too).
**Suggested fix:** Frank's call. If "nothing ticked" should never block, read the row's `busyCalendarIds` (and status) before asking for a fresh key and return `[]` first; add a test with a `needs_reconnect` row and an empty pick.
**Resolution:** Fixed 2026-10-12, keeping the spec ("None ticked reads nothing from Google", decision 3): getBusyTimes reads the pick first and returns [] before asking for a fresh key. Test: nothing ticked with a needs_reconnect row and an expired key makes no token or free/busy call.

### F-409 [P3] fixed - A moved booking's own span is now crossed off every ticked calendar, so an event in "Work" inside that span is read as free

**File:** backend/lib/calendar/google-calendar-provider.ts:73; backend/lib/scheduling/find-free-times.ts:137-143
**Found:** 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests)
**Why it matters:** When a booking moves, its own start to end is cut out of the person's Google busy blocks (7b decision 11), because the booking's event sits in the main calendar and free/busy cannot say which event is which. findBusyBlocks now flattens all ticked calendars into one list, so the cut also removes busy time from other calendars, which never hold the booking. Example: a 10:00-11:00 booking, a "Work" event at 10:00-11:00 added later; moving the booking to 10:30 is offered although Work says busy. Narrow (the new time must overlap the old span), and the main calendar had the same blind spot before, but for the other calendars it is now avoidable.
**Suggested fix:** Keep which calendar each block came from (or return the main calendar's blocks apart) and cross the moved booking off the main calendar's blocks only; one find-free-times test with an overlapping event in a second calendar.
**Resolution:** Fixed 2026-10-12: findBusyBlocks keeps each calendar apart (`CalendarBusyBlocksType`, the main one found under its own key or the one key left over), and getBusyTimes takes `crossOffOnMain`, crossing a moved booking off the main calendar only; find-free-times passes it. Test: the same hour busy in the main calendar and in Work, with the span crossed off, leaves Work busy.
