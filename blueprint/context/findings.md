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

### F-384 [P2] fixed - A customer with the form open when the owner saves the questions gets a refusal they cannot fix

**File:** backend/lib/booking/check-answers.ts:21-29; backend/routes/public-bookings-routes.ts:116-129; backend/lib/settings/save-booking-questions.ts:48-70; packages/booking-component/api-client/send-booking.ts:69-71
**Found:** 2026-10-11 by independent review of step 12f.1 (scope: a315b25..2739035; lenses: quality, security, performance, tests)
**Why it matters:** Before this step a business's questions only ever grew (client setup adds them only when there are none); the Settings save now deletes and changes them, and the booking route checks answers against the live list at submit time. Three paths follow from the code: (1) an answer to a question removed meanwhile makes checkAnswers return `unknown_question`, and the route answers 400 "That is not one of this business's questions."; (2) a question newly made required, or newly added as required, that the open form never showed returns 400 "Answer: <question>" with no field to answer it in; (3) a question whose words were changed in place keeps its id, so the lead's snapshot stores the customer's answer under the new words, which they never read (the snapshot is meant to keep "the question's words as asked"). For (1) and (2) send-booking.ts maps any 400 to `refused` with `canRetry: false`, so the customer is stopped with a message that does not say to reload, and the booking is lost unless they reload and fill the form in again.
**Suggested fix:** Let the booking route tell "the form changed" apart: ignore (or refuse with a distinct code such as `form_changed`) answers to ids no longer asked, and refuse a required question the request did not mention with the same code; have the booking window answer that code with "This form changed, please reload" (or reload the service's questions keeping the typed values). For (3), either send the words shown with each answer and keep those in the snapshot when the id still matches, or have the save give a question whose words changed a new id so (1) covers it. One route test per path.
**Resolution:** Fixed 2026-10-11, Frank's call: the booking is always taken. The form sends every question it showed with its words, blank ones included; a required question it showed must be answered, one it never showed is left blank; an answer to a question removed meanwhile is kept under the words shown, after the business's own; the lead keeps the words the customer read. `unknown_question` is gone. Tests: check-answers.test.ts and public-bookings-routes.test.ts (never showed, removed, reworded, shown and blank), each seen failing with the old rule.

### F-385 [P2] fixed - Moving a question down or removing one drops keyboard focus to the page

**File:** frontend/components/settings/booking-questions-card.tsx:43-47, 157-187
**Found:** 2026-10-11 by independent review of step 12f.1 (scope: a315b25..2739035; lenses: quality, security, performance, tests)
**Why it matters:** Rows are keyed by `row.key`, so on Down React keeps the next row in place and re-inserts the moved row's `li`; re-inserting a node that holds focus runs the browser's focus fixup and focus goes to `body`. Remove unmounts the focused button outright. Up from the second row leaves focus on a button that becomes `disabled`. A keyboard or screen-reader owner reordering the list has to Tab back from the top of the page after every Down and every Remove, and nothing announces the new position. The step was asked to keep Up/Down/Remove keyboard-reachable; they are reachable once, not usable in sequence.
**Suggested fix:** After a move, focus the same control on the row's new index (or the opposite arrow when the pressed one is now disabled); after a remove, focus the next row's Remove (or the previous row's, or "+ Add a question" when the list empties). Refs keyed by row key and a small effect, as useFocusFirstInvalid does. Optionally announce "Moved to position N" in the existing `role="status"` region.
**Resolution:** Fixed 2026-10-11: after Up/Down focus stays on the moved row's same arrow, or its other arrow at the end of the list; after Remove it goes to the next row's Remove, the previous one's, or + Add a question; a status line says "Moved to position N of M." or "Question removed.". Checked in the browser on /settings/booking-form (no frontend test runner yet).

### F-386 [P3] fixed - The questions save locks the business row "for update", which also holds up every booking and lead written for that business

**File:** backend/lib/settings/save-booking-questions.ts:25-30; backend/lib/settings/lock-business-resources.ts:1-4, 20
**Found:** 2026-10-11 by independent review of step 12f.1 (scope: a315b25..2739035; lenses: quality, security, performance, tests)
**Why it matters:** Postgres takes `FOR KEY SHARE` on the referenced organization row whenever a row pointing at it is inserted (booking, lead, contact, booking_question), and `FOR UPDATE` conflicts with that, so while a questions save runs every public booking, lead and contact insert for the business waits on it. The project already has the helper for exactly this, lockBusinessResources, which uses `for("no key update")` and says why: it "still lets bookings and every other row that points at the business be written meanwhile". Two "no key update" locks still exclude each other, so two question saves would still run one after the other. The wait is short (at most about 45 statements), hence P3, but it is drift from the established lock.
**Suggested fix:** Take `for("no key update")` on the organization row (reuse lockBusinessResources, or a shared lockBusiness helper if the name should not say "resources").
**Resolution:** Fixed 2026-10-11: the save takes lockBusinessResources ("no key update"). Test: settings-routes.test.ts "a save does not wait for a lead being written for the business", which answers "waited" with "for update".

### F-387 [P3] fixed - Every "Must be answered" box has the same accessible name

**File:** frontend/components/settings/booking-questions-card.tsx:145-154
**Found:** 2026-10-11 by independent review of step 12f.1 (scope: a315b25..2739035; lenses: quality, security, performance, tests)
**Why it matters:** With several questions a screen reader lists N checkboxes all called "Must be answered", nothing tying each to its question, while the text field beside it is "Question N" and the buttons are "Move question N up" and so on. Moving between form controls the owner cannot tell which question a box belongs to.
**Suggested fix:** Give the box a row-specific name, for example an `aria-label` of "Question N must be answered", or `aria-describedby` pointing at the question's input, matching the buttons' naming.
**Resolution:** Fixed 2026-10-11: each box is named "Question N must be answered". Checked in the browser.

### F-388 [P3] fixed - After a save from another tab removed a question, every later save on this page is refused until a reload

**File:** frontend/components/settings/booking-questions-card.tsx:52-71; backend/routes/settings-routes.ts:353
**Found:** 2026-10-11 by independent review of step 12f.1 (scope: a315b25..2739035; lenses: quality, security, performance, tests)
**Why it matters:** The lock makes the last save win, except when the earlier one deleted a question the later page still lists: the later PUT carries that id and gets `404 "No such question here."`, shown as an error notice. The rows keep the stale id, so pressing Save again gives the same 404 every time; the message does not say the list changed or to reload.
**Suggested fix:** Word the 404 for this case ("These questions changed since you opened the page. Reload to see them.") or have the page reload the list on a 404.
**Resolution:** Fixed 2026-10-11: the 404 says "These questions changed since you opened the page. Reload to see them." Asserted in settings-routes.test.ts.

### F-389 [P3] fixed - A setup file can still give a business more than 20 questions or two the same, which the Settings page then refuses to save

**File:** packages/shared/zod-validation/admin-validation-schemas/client-setup-validation-schema.ts:17, 63; packages/shared/zod-validation/crm-validation-schemas/booking-questions-validation-schema.ts:29-45
**Found:** 2026-10-11 by independent review of step 12f.1 (scope: a315b25..2739035; lenses: quality, security, performance, tests)
**Why it matters:** The question rules now live in two schemas that disagree: the setup file's `questions` takes any number of labels with no duplicate check, while the Settings save allows at most 20 and refuses two with the same words. A business set up with 21, or with a repeated question, opens Booking form with "+ Add a question" disabled and every save refused until it cuts the list, for a list it never wrote. The label rule (1 to 200, trimmed) is also restated rather than shared.
**Suggested fix:** Export the question item schema and the list's max and duplicate refinement from booking-questions-validation-schema.ts and use them for `questions` in the setup schema.
**Resolution:** Fixed 2026-10-11: the setup file's questions use setupQuestionsValidationSchema from booking-questions-validation-schema.ts, the same label rule, 20 cap and duplicate check as the Settings save. Test: run-client-setup.test.ts, seen failing with the old schema.

### F-390 [P2] fixed - The shared contact check `missingContact` lives inside `zod-validation/`, as a second export of a schema file

**File:** packages/shared/zod-validation/crm-validation-schemas/contact-rule-validation-schema.ts:14-25; packages/shared/zod-validation/index.ts:19
**Found:** 2026-10-11 by independent review of step 12f.2 (scope: d4dc8fa..9c102b2; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md says `packages/shared` is "kind, then area, then one file per export", and that "A helper both apps use lives in `helpers/` ... never inside `zod-validation/`, which holds only validation schemas". `missingContact` is exactly that helper (the booking route and the booking window both call it), and it is now the only function anywhere under `zod-validation/`, exported from a file named for `contactRuleValidationSchema`. Frank navigates by folder and file name, so the one rule both sides must share is filed where he would not look for it, and the published booking component imports it through the validation barrel. Moving it later means touching the component's imports again.
**Suggested fix:** Move `missingContact` to `packages/shared/helpers/missing-contact.ts` (with its test beside it, as `textable-phone-number.ts` is), export it the way the other helpers are, and import it from there in book-time.ts and read-booking-form.ts. `contact-rule-validation-schema.ts` keeps only the schema and `ContactRuleType`.
**Resolution:** Fixed 2026-10-11: `missingContact` moved to packages/shared/helpers/missing-contact.ts with its test beside it, exported as `@scheduleads-app/shared/missing-contact`; book-time.ts and read-booking-form.ts import it from there; contact-rule-validation-schema.ts keeps only the schema and `ContactRuleType`.

### F-391 [P3] fixed - A customer with the form open when a service's address is switched on gets "Enter the address." with no box to enter it in

**File:** backend/lib/booking/book-time.ts:217; packages/booking-component/booking-window/screens/booking-form-view.tsx:269-270; packages/booking-component/booking-window/booking-form/read-booking-form.ts:54-55; packages/booking-component/api-client/send-booking.ts:69-70
**Found:** 2026-10-11 by independent review of step 12f.2 (scope: d4dc8fa..9c102b2; lenses: quality, security, performance, tests)
**Why it matters:** The window reads the service's `addressMode` once, when it loads. If the owner changes it from "not asked" to "asked and required" while a customer has the form open, the window draws no Address box and sends no `location`; the route then refuses with 400 "Enter the address.", which send-booking.ts turns into `refused` with `canRetry: false`. The customer has nowhere to type an address and the message does not say to reload, so the booking is lost unless they reload and start over. This is path (2) of F-384 for the address: for questions Frank decided a form opened before a change is always taken, and at this step's plan he decided the opposite address direction (switched off) still books, but the switched-on direction still refuses. It predates this step (the yes/no `asksAddress` had the same gap) and the amended spec states "required" as refused, so this is a consistency question for Frank, not a defect against the spec.
**Suggested fix:** Frank's call. To match the questions rule: the window already always sends `location` for a required service (an empty box is refused by the schema), so the route could take a booking for a required service whose request has no `location` key at all (a form that never showed the box), and still refuse an empty one; one route test for each. Or keep the refusal and word it "This form changed, please reload the page".
**Resolution:** Fixed 2026-10-11, Frank's call (as F-384): a booking that sends no address for a service that requires one is taken with the address blank, since its form never showed the box; an empty address is still refused by the schema ("Enter the address."). The `address_needed` refusal is gone. Tests: public-bookings-routes.test.ts "refuses an empty address" and "takes a booking that sent no address", the second seen failing with the old check.

### F-392 [P3] fixed - The rules card saves "no" for the yes to later texts when it never showed that choice

**File:** frontend/components/settings/booking-form-rules-card.tsx:21, 28-31; backend/lib/settings/save-booking-form-rules.ts:22-28
**Found:** 2026-10-11 by independent review of step 12f.2 (scope: d4dc8fa..9c102b2; lenses: quality, security, performance, tests)
**Why it matters:** When the page loads before the business has text settings, the card holds `askLaterTextsYes: null`, hides the choice, and on Save sends `askLaterTextsYes ?? false`. The route then runs `UPDATE text_settings SET askLaterTextsYes = false` for the business. Today no update happens because only the dev seed creates text settings, but once 12g lets the owner set up texts, a Booking form page left open (or loaded in another tab) before texts were set up will silently switch the box off the next time the owner saves only the contact rule, a choice they were never shown. The card's one PUT carries two independent settings, and "not shown" is sent as "no".
**Suggested fix:** Let the rules save leave the yes alone when the card did not show it: make `askLaterTextsYes` optional (or nullable meaning "unchanged") in bookingFormRulesValidationSchema, have the card send it only when it was shown, and skip the text_settings update when it is absent. One route test: a save without it leaves an existing `true` in place.
**Resolution:** Fixed 2026-10-11: `askLaterTextsYes` is optional in the rules save and left as it is when absent; the card leaves it out when it did not show the choice. Test: settings-routes.test.ts "the rules save" now saves the rule from a page that did not show the choice and keeps the yes, seen failing with the old save.
