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

### F-410 [P3] open - A person with nothing ticked whose connection Google stopped accepting is told "customers cannot book you", though they can

**File:** backend/routes/calendar-routes.ts:42; backend/lib/calendar/get-busy-times.ts:38; backend/lib/calendar/find-calendar-choices.ts:33
**Found:** 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests)
**Why it matters:** The F-408 repair made an empty pick return [] before the key is read, so a `needs_reconnect` row with nothing ticked never blocks the person and customers can book them. The F-407 repair's message for that same row reads "Until then none of your calendars is read, so customers cannot book you." findCalendarChoices throws on the status before the pick is looked at, so the page says the opposite of what the booking window does for that one combination. Narrow (nothing ticked and a lapsed Google permission at once), and the Reconnect itself is still the right advice.
**Suggested fix:** Drop the "so customers cannot book you" clause, or word it from the pick (for an empty pick, say only that bookings cannot be written into Google until reconnected); no new test needed beyond the message assertion already there.
**Resolution:**

### F-411 [P3] open - A ticked calendar the person hid from their list at Google shows as "No longer in your Google account" and cannot be ticked again once unticked

**File:** backend/lib/calendar/google-calendar-provider.ts:89-92; frontend/components/settings/busy-calendars-part.tsx:135; backend/lib/calendar/save-busy-calendars.ts:29-30
**Found:** 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests)
**Why it matters:** listCalendars asks Google's calendarList without `showHidden`, whose documented default is false, so a calendar the person chose "Hide from list" for at Google is left out although it is still in the account and free/busy still reads it. If it was ticked, the page files it under "No longer in your Google account" (wrong words); once unticked and saved, the save refuses it as `unknown_calendar`, so it can never be ticked again until it is un-hidden at Google. The spec's "left the account" means deleted or unsubscribed, which hidden is not. Found from the request shape and Google's documented default; not seen against a real account (that check is in 10b).
**Suggested fix:** Set `showHidden=true` on the list request (deleted entries stay out by default), and one route test that the request carries it.
**Resolution:**

### F-412 [P2] closed - A built-in Google calendar ticked on the Calendar page makes the person's whole calendar unreadable

**File:** backend/lib/calendar/google-calendar-provider.ts; backend/lib/calendar/find-calendar-choices.ts
**Found:** 2026-10-12 by the hand check of step 12b.1 (12h's code, merged as item-12h-done)
**Why it matters:** Google lists its own holiday calendar ("Holidays in Canada", an id under `group.v.calendar.google.com`) and 12h offered it as a tick box. Free/busy answers `notFound` for it, and since one unreadable ticked calendar makes the person unreadable (12h decision 2), ticking it made Frank's whole calendar unreadable: "try again" for a picked person, left out of "any available". Seen live: the Calendar page said Google could not be read, and the API logged `Google could not read a calendar's busy times (notFound)`.
**Suggested fix:** Never offer Google's built-in calendars, never ask free/busy about them, and drop one ticked before from the pick.
**Resolution:** Fixed 2026-10-12 on `feature/12b-calendars`: `is-google-virtual-calendar.ts` names them; `listCalendars` skips them, `findBusyBlocks` answers them empty without asking Google, and `findCalendarChoices` leaves one ticked before out of the pick, so the next save drops it. Tests: get-busy-times.test.ts ("a built-in Google calendar ticked is never asked about, and blocks nothing"), calendar-routes.test.ts ("Google's own holiday calendar is never offered, and one ticked before is no pick at all"). Seen live after: the Calendar page reads Frank's Google again with the holiday calendar still ticked in the database. Closed 2026-10-12 by independent review of step 12b.1 (91b217c..3aafcf3): re-read google-calendar-provider.ts (listCalendars skips the suffix; findBusyBlocks asks free/busy only for the rest, answers the built-in ones `busy: []` and calls nothing when only they are ticked, while askFreeBusy keeps every 12h guarantee: one call, every asked calendar must come back, "primary" filed under the account's address, an errored calendar throws), find-calendar-choices.ts (picked filtered, so `missing` stays empty and the save refuses the id as unknown), and the two tests, which fail if either filter is removed. Both suites pass. One residual edge is its own entry, F-414.

### F-413 [P2] closed - A standby day shows the person's bookable hours on the Calendar page, though customers cannot book them that day

**File:** backend/lib/schedule/find-schedule-week.ts:197 (and the contract comment at :45)
**Found:** 2026-10-12 by independent review of step 12b.1 (scope: 91b217c..3aafcf3; lenses: quality, security, performance, tests)
**Why it matters:** A day's `hours` is documented as "when customers can book", and the booking window drops a person's standby dates entirely (`applyFreeTimesRules` skips `standby.has(date)`, read through `findStandbyDates`). findScheduleWeek never reads `standby_date`, so on Carlos's standby day the owner sees his full 8 to 5 as bookable while the website offers him nothing that day. It is the one input to "when can customers book" that the calendar leaves out, and it says the opposite of what the booking window does.
**Suggested fix:** Read the shown person's standby dates for the week (`findStandbyDates`) and mark the day (for example `standby: true` with `hours: []`, or the hours kept and labelled "on standby, hidden from customers"); one route test with a standby date in the week.
**Resolution:** Fixed 2026-10-12: findScheduleWeek reads the person's or place's standby dates for the week (findStandbyDates, as the booking window does); a standby day answers `standby: true` and no hours, and the page says "On standby: not offered to customers". Test: schedule-routes.test.ts "a standby day shows no bookable hours, as the booking window offers none", proved able to fail. Closed 2026-10-12 by independent review of step 12b.1, check of the fixes (3aafcf3..25f814c): find-schedule-week.ts reads findStandbyDates for the shown resource over the week's seven dates, the same helper and inclusive range the booking window uses for people and places (find-free-times.ts:111), and a standby day answers `standby: true` with `hours: []` while its items stay; schedule-screen.tsx says "Closed" first, then the standby line. The test fails without the repair (no `standby` field, and 8 to 5 hours). Suites, build and lint pass.

### F-414 [P3] closed - Only a built-in Google calendar ticked, and a lapsed connection, still makes the person unreadable

**File:** backend/lib/calendar/get-busy-times.ts:39
**Found:** 2026-10-12 by independent review of step 12b.1 (scope: 91b217c..3aafcf3; lenses: quality, security, performance, tests)
**Why it matters:** The F-412 repair filters built-in calendars inside the Google provider, after the "nothing ticked" check. A connection whose stored pick is only a built-in calendar (ticked under 12h, never re-saved) therefore still goes to getFreshAccessToken: if the connection needs reconnecting it throws, so the person is unreadable (left out of "any available", "Google could not be read" on the Calendar page) although nothing they ticked can count, which F-408's rule says must never block them; with a near-expired key it also refreshes it for nothing. Narrow: needs the old pick plus a lapsed permission.
**Suggested fix:** Apply `isGoogleVirtualCalendar` to the pick in getBusyTimes before the empty check (line 39 and 42), so an only-built-in pick is "nothing ticked"; extend the existing built-in-calendar test with a `needs_reconnect` connection.
**Resolution:** Fixed 2026-10-12: getBusyTimes counts only calendars that are not Google's built-in ones before asking for a key, so a pick of only a holiday calendar reads nothing and never makes the person unreadable. Test: get-busy-times.test.ts "only a built-in Google calendar ticked never asks for a key, though the connection needs reconnecting". Closed 2026-10-12 by independent review of step 12b.1, check of the fixes (3aafcf3..25f814c): get-busy-times.ts applies isGoogleVirtualCalendar to the stored pick before getFreshAccessToken and again to the fresh pick, so an only-built-in pick returns [] with no key asked; a mixed pick still reaches the provider, which filters as F-412 closed. The new test (expired key, `needs_reconnect`) fails without the repair, since the token call or the reconnect error happens. The other getFreshAccessToken callers (find-calendar-choices, the booking event writers) are not on the busy-time path.

### F-415 [P3] closed - No test places an item that spans several local days, or reads a week with a clock change

**File:** backend/routes/schedule-routes.test.ts; backend/lib/schedule/find-schedule-week.ts:186
**Found:** 2026-10-12 by independent review of step 12b.1 (scope: 91b217c..3aafcf3; lenses: quality, security, performance, tests)
**Why it matters:** `touches` places an item on every local day from its start's date through its last moment's, which is what lets a week of time off (12b.3's "any length") or an overnight Google event show on each day. The only cross-midnight case tested (Friday's time off ending 00:00 UTC) still passes if `touches` checked the start's date alone, so breaking multi-day placement fails nothing. The fixed one-day UTC widening and the day boundaries are also never exercised in a week holding the autumn or spring change. The code reads correct today; the tests would not notice it breaking.
**Suggested fix:** Add one item spanning Friday afternoon to Monday morning (expect it on Fri, Sat, Sun and Mon; and an item ending exactly at local midnight on its start day only), and run one week across a clock change (for Edmonton, the week of 2026-10-26 or 2027-03-08).
**Resolution:** Fixed 2026-10-12: two tests in schedule-routes.test.ts. "an item across several local days shows on each, and only those" (Saturday to Sunday time off), proved able to fail by placing items by their start only; "a week with the spring clock change has seven days, and places items by the clock after it" (Edmonton, March 8, 2026). Writing it showed the tz data (2026c) keeps Alberta on daylight time from March 2026, so the step's tests now say UTC-6 for November. Closed 2026-10-12 by independent review of step 12b.1, check of the fixes (3aafcf3..25f814c): the weekend test expects exactly Sat and Sun, so placing by the start alone fails it; the spring test reads the week of March 2, 2026 and expects 05:00Z on the 9th on Sunday and 06:00Z off the week, which a fixed pre-change offset (UTC-7) would put on Sunday too. Residual, not a new entry: the suggested "ends exactly at local midnight, start day only" case was not added, so the `- 1` in `touches` (find-schedule-week.ts:192) is still untested. The tz-data dependence the repair brought in is F-416.

### F-416 [P3] closed - The Calendar week's tests now pass only on a Node whose tz data is 2026c or later

**File:** backend/routes/schedule-routes.test.ts:64-78
**Found:** 2026-10-12 by independent review of step 12b.1, check of the fixes (scope: 3aafcf3..25f814c)
**Why it matters:** The F-415 repair moved the suite's fixed week (Nov 16, 2026) and its UTC fixtures (tuesdayTen, fridayOff, wednesdayGoogle) to UTC-6, which holds only under tz data 2026c, where Alberta stays on daylight time after March 8, 2026. Nothing pins the runtime (no `engines`, no `.nvmrc`), and Frank works from more than one machine: on a Node built with older tz data the same instants read an hour earlier in Edmonton, so the week tests that compare times fail although the code is right. A November week is the one choice the rule change makes ambiguous; a week between March 8 and November 1, 2026 is UTC-6 under both rule sets, as is the spring test's March 8 change. Seen here on Node v26.7.0, `process.versions.tz` 2026c, where 2026-11-17T16:00Z reads 10:00 MDT.
**Suggested fix:** Move the suite's fixed week to one inside March 8 to November 1, 2026 (for example the week of June 15), keeping the UTC-6 fixtures, and say in the comment that the week was picked to read the same under either tz data.
**Resolution:** Fixed 2026-10-12: the test week moved to Monday Sep 14, 2026, daylight time (UTC-6) in Edmonton under any tz data; the spring change test (March 8) holds under old and new data alike. Its 9 tests pass. Closed 2026-10-12 by independent review of step 12b.1, check of the fixes (25f814c..0ed3baa): no November date is left in the file; Sep 14, 2026 is a Monday and Sep 20 a Sunday; the whole week (with the fetch window Sep 13 00:00Z to Sep 22 00:00Z) sits inside March 8 to November 1, so Edmonton is UTC-6 under old and 2026c data alike, and every fixture reads as its comment says: 16:00Z Tue 10 am, 15:00Z Wed 9 am, 19:00Z Fri to 00:00Z Sat is Fri 1 to 6 pm, closed Sep 17 a Thursday. The weekend test keeps its shape (Sat 10 am to Sun 7 pm, 01:00Z on the 21st), so placing by the start alone still fails it and Monday stays out; the spring test is untouched and its March 8 change is in both rule sets. The week being now in the past changes nothing: the hours are resolved from the week's own Monday (find-schedule-week.ts:77-79), never from today. `npm run test --workspace=backend -- routes/schedule-routes`: 9 passed, on Node v26.7.0, tz 2026c; the old data was not run here, so that half rests on the dates above.

### F-417 [P3] closed - Three lines of 12b's spec promise refusals that the owner's booking path never gives

**File:** blueprint/context/current-feature.md:24-28 (In scope, Book by hand), :74-77 (12b.2's scene), :119-123 (`POST /schedule/bookings`)
**Found:** 2026-10-12 by independent review of step 12b.2 (scope: 4e7877e..9b12f37; lenses: quality, security, performance, tests)
**Why it matters:** The code follows bookTime's settled owner path (12f: "The owner's own bookings skip both", the contact rule and a required address; decision 13: a walk-in already under way is taken, only an earlier day is `in_the_past`), and the route, schema comment and test agree with it. The spec still says otherwise in three places: In scope asks for "the customer's name and phone or email, the address when the service asks one"; the contract promises "`400` on a field for a missing contact or address as `bookTime` answers" (bookTime answers neither for `manual`, so that 400 can never happen); the scene says "a time already past" is refused, but 9:00 this morning booked at 3 pm is made. Summit's Estimate is `addressMode: "required"`, and the form labels its box "Address (optional)", so the by-hand check of the scene can read as a failure, and 12b.3 or `/complete` may build on the wrong reading. Frank reads the build log, not this file, so the difference has not reached him either.
**Suggested fix:** Amend the three lines to what is built and settled: name only required for the owner, the address box shown when the service asks one and left optional for the owner (12f), `in_the_past` for an earlier day in the business's zone, an earlier time today taken as a walk-in (decision 13); drop the "400 on a field for a missing contact or address" clause; say it in the step's log entry.
**Resolution:** Fixed 2026-10-12: the spec's In scope, 12b.2's story and the POST contract now say what 12f and decision 13 settled: a name is enough, phone, email and address are the owner's to give or not, only an earlier day is refused; and they name 409 reconnect_needed (F-419) and 503. Closed 2026-10-12 by independent review of step 12b.2, check of the fixes (9b12f37..39d16fc): In scope (current-feature.md:29-32) now asks only a name, with phone, email and the address "if the owner has them", and "never an earlier day"; the scene (:78) says "a day already gone"; the contract (:124-127) has `in_the_past` for an earlier day, drops the missing contact or address 400 and adds 409 `reconnect_needed` and 503 `unavailable`, which is what the route answers (schedule-routes.ts:196-222) and bookTime does for `manual` (book-time.ts:235, an earlier day only). No "phone or email" or "missing contact" wording is left in the spec. One leftover, too small to record: the Tests list (:147) still says "a past time are refused", the test's own title, whose case is yesterday, so it reads true.

### F-418 [P3] closed - The form's "Booked." notice is never seen: the week reloads and unmounts the form at once

**File:** frontend/components/schedule/book-by-hand-form.tsx:89-97; frontend/components/schedule/schedule-screen.tsx:66-69,183
**Found:** 2026-10-12 by independent review of step 12b.2 (scope: 4e7877e..9b12f37; lenses: quality, security, performance, tests)
**Why it matters:** On a 201 the form sets its notice and calls `onBooked`, which is ScheduleScreen's `ask`: `setResult(null)` swaps the whole week, form included, for "Loading…". The form unmounts with its notice, and the new week mounts a fresh form with none, so "Booked. The customer hears as your settings say." is dead code and the only sign of success is the booking appearing on the week (if the reload fails, there is no sign at all). The words are also wrong for a name-only booking, where the customer hears nothing. The same remount reloads the services list after every booking.
**Suggested fix:** Refresh the week without dropping the shown one (keep `result` while the new answer loads, or let `ScheduleWeek` refetch in place), or lift the notice into ScheduleScreen so it survives the reload; word it so it is true without a phone or email (for example "Booked for Mrs Lee, Thu 4:30 pm.").
**Resolution:** Fixed 2026-10-12: a booking reads the week again in place (the screen's own Try again count), so the form stays, keeps its notice and does not reload the services. With no phone or email the notice says the customer hears nothing from us. Checked by hand on Diego's Friday: the notice stays and the booking shows. Closed 2026-10-12 by independent review of step 12b.2, check of the fixes (9b12f37..39d16fc): `onBooked` is now `onRefresh`, which only bumps `attempt` (schedule-screen.tsx:104,189) and never calls `setResult(null)`, so the shown week stays while the effect on `[asked, attempt]` (:58-67) reads the same week again and replaces `result` in place; `BookByHandForm` keeps its key (`resourceId`, :186), so it is not remounted, its notice survives and its services effect (book-by-hand-form.tsx:41-60, on `[personId]`) does not run again. The notice is chosen from phone or email before they are cleared (:91-103), so a name-only booking says the customer hears nothing. Only a reload that comes back unreachable swaps the week (and the form) for the Try again notice, which says why. Frontend build and lint pass.

### F-419 [P3] closed - An owner booking for a person whose Google needs reconnecting is told "Try again shortly", which never works

**File:** backend/routes/schedule-routes.ts:192-199
**Found:** 2026-10-12 by independent review of step 12b.2 (scope: 4e7877e..9b12f37; lenses: quality, security, performance, tests)
**Why it matters:** For the owner, `findBookingChoices` asks the person's Google (Google wins, decision 11), and `getFreshAccessToken` throws `CalendarReconnectNeededError` for a `needs_reconnect` connection with calendars ticked, so every by-hand booking for that person is `unavailable`. The route answers 503 "Google did not answer, so that time cannot be checked. Try again shortly." That is right for an outage, but for a lapsed connection no retry ever succeeds: the owner cannot book Carlos by hand at all until Carlos reconnects or unticks, and nothing tells him so. The Calendar page shows "Google could not be read" for that week too, with the same no-reason wording.
**Suggested fix:** Keep the rule, change the words to cover both cases ("Google could not be read for Carlos, so that time cannot be checked. If it keeps happening, Carlos reconnects Google on his Calendar settings."), or carry a `reconnect` reason from getBusyTimes through findBookingChoices so the route can say which.
**Resolution:** Fixed 2026-10-12: when bookTime answers unavailable and the person's connection needs reconnecting, the route answers 409 reconnect_needed, "This person's Google calendar needs reconnecting... They reconnect on Settings, Calendar."; 503 stays for Google not answering. Test: "a person whose Google needs reconnecting is told so, never to try again", proved able to fail. Closed 2026-10-12 by independent review of step 12b.2, check of the fixes (9b12f37..39d16fc): for the owner a person is always named, so bookTime's `unavailable` comes only from that person's own Google read (find-booking-choices.ts:75-88; rooms are read from commitments, never Google), and `needsReconnect` reads that same person's one connection, scoped to the business (schedule-routes.ts:46-60; `calendar_connection` is unique per resource). A lapsed connection with nothing ticked never reaches Google, so it is never `unavailable` and never mislabelled; a token Google stops accepting mid-call is read after the failure, so it too gets the reconnect words. `reconnect_needed` is an existing refusal code, the form shows its message through `readSaveRefusal`, and the page it names exists (`/settings/calendar` in the build). The new test sets Carlos's seeded connection to `needs_reconnect`, expects 409 `reconnect_needed`, restores it in `finally`, and passes alone (`-t "reconnecting"`) and in the suite.

### F-420 [P3] closed - The "busy time" refusal test passes only after the test before it has booked

**File:** backend/routes/schedule-routes.test.ts:582-586
**Found:** 2026-10-12 by independent review of step 12b.2 (scope: 4e7877e..9b12f37; lenses: quality, security, performance, tests)
**Why it matters:** "a busy time, time off and a past time are refused" expects `time_taken` at 6:30 pm because "Carlos is busy with Mrs Lee", a booking made by the previous test. Run alone (`-t "busy time"`, or `.only` while debugging), the first booking is made with 201 and the test fails although the rule is fine; reordered, its leftover booking is not in `made`, so its jobs are not cleaned up. The rule itself is tested; only the test's independence is not.
**Suggested fix:** Make the busy booking inside the test (book once, push its id to `made`, expect 201, then book the same time again and expect 409 `time_taken`), or move the "same time again" check into the first test.
**Resolution:** Fixed 2026-10-12: the busy-time test makes its own booking first, at a time of its own; each booking test passes run alone (checked one by one with -t) and together. Closed 2026-10-12 by independent review of step 12b.2, check of the fixes (9b12f37..39d16fc): the test now books Ms Kay at 9:30 pm (1290), expects 201 and pushes her id to `made`, then books the same minute for Mr Park and expects 409 `time_taken` (schedule-routes.test.ts:589-596), so it needs nothing from the test before it and its booking's jobs are cleaned in `afterAll`. 9:30 pm is used by no other test, and the reconnect test's 11 pm still books clear of it. `-t "busy time"` alone: 1 passed, 13 skipped; the whole file: 14 passed.

### F-421 [P2] closed - A place's time off, with a booking moved to a time inside it, is refused as "changed meanwhile" although another room is free

**File:** backend/lib/schedule/save-time-off.ts:87-94,126-132; backend/lib/booking/find-booking-choices.ts:110-133
**Found:** 2026-10-12 by independent review of step 12b.3 (scope: 2503027..5aed73b; lenses: quality, security, performance, tests)
**Why it matters:** The time off may be for a place (the route takes any resource), but the `move_into_time_off` check covers only the same person. For a move, findBookingChoices lists the room going off as free (its time off is not held yet, and the moving booking's own time is left out), rooms ordered by name, and holdFirstFreeChoice holds the first. When that is the room going off, the move holds it inside the span, the time off's own hold then collides, and the whole save rolls back as 409 `time_taken`, "Something in that time changed meanwhile". Every retry gives the same answer, although other rooms are free at that time. Keeping the same start in another room cannot be done either: the same start with the same person is `unchanged`, answered "That new time is not free". At Riverbend (five rooms), closing one room for an afternoon can only be saved by moving its bookings out of the afternoon or cancelling them. Found by reading the code. No test has a place's time off.
**Suggested fix:** When the time off is a place, keep that place out of the move's rooms where the new span overlaps the time off (for example drop those choices from the plan, or pass the span into findBookingChoices), and count the same start in another room as a move. Add one route test with a clinic-dev room off over a booking moved inside the span. If moves for a place are meant to leave the span, say so in the spec and answer `move_into_time_off` for it.
**Resolution:** Fixed 2026-10-12: a place's time off passes the place to prepareBookingMove as `leavingPlace`; the move's choices drop that place wherever the new span overlaps the time off, and a booking still in that place is never "already there" (prepare and applyBookingMove both), so the same start in another room is a move. With no other room free the move answers `time_taken`, "That new time is not free". Route test "a room going off" (Room A off 9 am to 1 pm, one booking kept at 10 in Room B, one moved to noon in Room B); it fails with either half undone. Closed 2026-10-12 by independent review of step 12b.3, check of the fixes (28fe13a..107e315): the customer's and the owner's single move are unchanged (no leavingPlace, so both "already there" checks reduce to their old form); the filter uses the span with buffers against the time off, half-open, and drops only the room going off; the test covers the same start and a new time inside the span.
### F-422 [P3] closed - Time off over time off already there is refused as "changed meanwhile", every time

**File:** backend/lib/schedule/save-time-off.ts:126-132; backend/routes/schedule-routes.ts:393-399
**Found:** 2026-10-12 by independent review of step 12b.3 (scope: 2503027..5aed73b; lenses: quality, security, performance, tests)
**Why it matters:** findBookingsInTheWay looks only at bookings, so time off already in the span is first met by the final holdTime. Its refusal answers 409 `time_taken`, "Something in that time changed meanwhile. Nothing was saved: look again." Marking Carlos off all Friday when Friday afternoon is already off (12b.1's own scene) always gets that answer, and looking again changes nothing. The owner has to guess that the afternoon must be removed first, after choosing a move or cancel for every booking in the way (each one correctly undone).
**Suggested fix:** Before the transaction, read the resource's active time off over the span and refuse it in its own words ("Already off from 1 pm to 5 pm that day: remove it first, or start after it"). Keep the in-transaction refusal for a real "meanwhile". Add one route test.
**Resolution:** Fixed 2026-10-12: saveTimeOff reads the resource's active time off over the span before the bookings in the way, and refuses it as 409 `already_off`, "Already off from <its start> to <its end>. Remove that time off first, or pick a time around it.", before any booking is chosen for. The in-transaction refusal stays for a real meanwhile. Route test "time off over time off already there"; it fails with the check undone (answers bookings_in_the_way). Closed 2026-10-12 by independent review of step 12b.3, check of the fixes (28fe13a..107e315): findCommitments' half-open overlap means time off that only touches the span is not refused; a test covers it.
### F-423 [P3] closed - A booking its customer moves while the save runs is still cancelled or moved by it

**File:** backend/lib/schedule/save-time-off.ts:66-80,117-125; backend/lib/booking/cancel-booking-in-transaction.ts:57-61; backend/lib/booking/apply-booking-move.ts:206-215
**Found:** 2026-10-12 by independent review of step 12b.3 (scope: 2503027..5aed73b; lenses: quality, security, performance, tests)
**Why it matters:** The bookings in the way are read before the transaction, and before each move's Google read, which can take seconds. Once a row is locked, the cancel checks only that it is confirmed and has not begun, and applyBookingMove only that it is not cancelled, not begun and not already at the new start. Suppose a customer moves Friday's booking to next Wednesday through their link in that window. The owner's Friday time off then cancels the Wednesday booking (the customer is told of a move, then of a cancel), or moves it again from Wednesday, although it is no longer in the way. Nothing is left half done, but the save acts on a booking that changed meanwhile instead of refusing. The window is narrow.
**Suggested fix:** In the time off save, after each row is locked, compare its start and person with the entry read before the transaction, and throw ChangedMeanwhileError when they differ. One way is an optional `expected: { startsAt, personId }` on cancelBookingInTransaction and applyBookingMove, used only by this save.
**Resolution:** Fixed 2026-10-12: inside the transaction, before any cancel or move, every booking chosen for is locked (one statement, ordered by id) and compared with what the owner saw: still confirmed, same start, same person, or ChangedMeanwhileError undoes the lot (409 `time_taken`). Done in the save rather than as an `expected` option on the shared cancel and move, so the customer's paths are untouched. Route test "a booking its customer moves while the save runs" (Ben moved a week on during Ana's Google read): Ben keeps his new time, no job added; it fails with the check undone. Closed 2026-10-12 by independent review of step 12b.3, check of the fixes (28fe13a..107e315): one SELECT ... ORDER BY id FOR UPDATE first in the transaction, so two saves queue rather than deadlock; the later locks in cancel and move are no-ops in the same transaction; the test refuses from inside the transaction.
### F-424 [P2] closed - The Simulate case "a move to a time taken meanwhile saves nothing, not even the cancel" never reaches the transaction

**File:** backend/routes/schedule-routes.test.ts:802-828 (and :830-874)
**Found:** 2026-10-12 by independent review of step 12b.3 (scope: 2503027..5aed73b; lenses: quality, security, performance, tests)
**Why it matters:** Cara's 9 am booking is made before the save, so prepareBookingMove refuses Ana's move (the `bookingId: ana` the test asserts) before the transaction starts, and Ben's cancel is never tried. The test would still pass if the cancels ran in their own transaction ahead of the moves, which is exactly what decision 3 forbids. The one test that fails inside the transaction ("two moves to one free time") has no cancel, and no test checks that a refused save leaves no job (the cancellation email, the worker text, the Google removal). So "no customer told of a cancel that did not finish" is untested. Two smaller rules are untested too: a booking's held time is never removable by DELETE (404, the booking still held), and an owner move to a time already gone is 400 `in_the_past`.
**Suggested fix:** Make this case fail inside the transaction after a cancel: cancel Ben, and move Ana and a third booking to the same free time, so the second hold fails. Then assert Ben is `confirmed`, `emailsOf(ben)` is empty, Ana is unmoved and there is no time off. Also add a DELETE of a booking's commitment id (expect 404) and a move to yesterday (expect 400 `in_the_past`).
**Resolution:** Fixed 2026-10-12: the old case is renamed "a move to a time already taken is refused before anything is saved" (what it proves). The new "a move to a time taken meanwhile saves nothing, not even the cancel" cancels Ben, then moves Ana and Cara to the same free time, so the second hold fails inside the transaction after the cancel: Ben confirmed with no job added (emails, texts, Google), Ana and Cara unmoved, no time off. It fails when the cancels run outside the transaction. Added: a booking's own held time DELETEd is 404 and stays active; a move to yesterday is 400 `in_the_past`. Closed 2026-10-12 by independent review of step 12b.3, check of the fixes (28fe13a..107e315): each move is free alone, so the second hold fails inside the transaction after the cancel; the job count is meaningful (the cancel's email, Google removal and worker text all carry bookingId); the DELETE 404 and in_the_past tests are present.
### F-425 [P3] closed - The time off form shows nothing when the API refuses a move's day or time

**File:** frontend/components/schedule/time-off-form.tsx:125-128 (the shown keys at :160-201 and :287)
**Found:** 2026-10-12 by independent review of step 12b.3 (scope: 2503027..5aed73b; lenses: quality, security, performance, tests)
**Why it matters:** The route answers `field: "bookings.N.startMinute"` for a move into the hour skipped in spring (schedule-routes.ts:299). The schema answers `bookings.N.date` ("Pick a day.") when the owner clears a move's day box, and can also answer `resourceId` or `bookings`. The form files the error under that key but shows only from.*, to.*, `to` and `booking-<id>`, so the button comes back and nothing is shown. Also, a booking already begun gets "Choose move or cancel." from the form's own check, although the form offers it neither.
**Suggested fix:** Map `bookings.N.*` to `booking-<id>` of the N-th booking sent (the order matches the list), and show any other field in the notice. Leave the begun ones out of the choice check, since their own notice already says to start the time off after them.
**Resolution:** Fixed 2026-10-12: the form maps `bookings.N.*` to the N-th booking sent and shows it under that booking, shows its own span fields under their boxes, and puts any other field in the notice. Begun bookings are left out of the choice check and not sent; the API's own "already begun" answer is shown. Checked in the browser at http://localhost:3400/calendar?date=2026-10-15: Carlos off Thu Oct 15, Mrs Lee (test) moved with the day cleared shows "Pick a day." under her booking; nothing saved. Closed 2026-10-12 by independent review of step 12b.3, check of the fixes (28fe13a..107e315): the route's bookings.N index is the array the form sends, begun bookings skipped before sending, so N maps to the right booking.
### F-426 [P3] closed - The time off contract in the spec differs from what the route answers

**File:** blueprint/context/current-feature.md:129-138; backend/routes/schedule-routes.ts:348-399
**Found:** 2026-10-12 by independent review of step 12b.3 (scope: 2503027..5aed73b; lenses: quality, security, performance, tests)
**Why it matters:** The contract lists only 409s, and `bookings_in_the_way` always with `{ bookings }`. The route also answers 400 `in_the_past` and 503 `unavailable` for a move, and 400 for a skipped clock time. It answers `bookings_in_the_way` with a `bookingId` and no `bookings` for a move whose booking changed, and for a person who does not do the service. For that person the words "A booking changed meanwhile" are wrong. The form copes, since it branches on `bookings`, but `/complete` and the build log build on the spec.
**Suggested fix:** Amend the contract lines to the answers the route gives. Give the person who does not do the service its own words (for example `not_found`, "That person does not do this service").
**Resolution:** Fixed 2026-10-12: the POST /schedule/time-off contract in current-feature.md now lists every answer the route gives: 404, 409 already_off, 409 bookings_in_the_way with and without bookings, per move 400 bad_request, 400 in_the_past, 409 time_taken, 503 unavailable, 400 { field } including bookings.N.startMinute, and 409 time_taken for a meanwhile. A person who does not do the service now has its own words, 400 bad_request "That person does not do this service. Pick someone who does." with bookingId, checked against the booking's own people before the move is prepared. Route test covers it; it fails with the check undone. Not closed by the check of the fixes (28fe13a..107e315): the contract missed 409 no_business_hours (schedule-routes.ts:272). Fixed again 2026-10-12: the clause is added. Closed 2026-10-12 by independent review of step 12b.3, check of the fixes (107e315..dda246d): the contract (current-feature.md:133-145) now names every answer of the POST /time-off handler, 409 no_business_hours included (schedule-routes.ts:272); the move reasons not_found, already_cancelled and already_started land in the bookings_in_the_way fallback, as written.

### F-427 [P3] closed - The two "meanwhile" tests do not prove the refusal came from inside the transaction

**File:** backend/routes/schedule-routes.test.ts:861-862, :896-897
**Found:** 2026-10-12 by independent review of step 12b.3, check of the fixes (scope: 28fe13a..107e315; lenses: tests)
**Why it matters:** Both tests check only `error.code` `time_taken`. A move refused before the transaction answers the same code, with a `bookingId`. If a later change made either move refuse early, both would still pass without reaching the transaction, the gap F-424 was about.
**Suggested fix:** Add `expect(body).not.toHaveProperty("bookingId")` to both.
**Resolution:** Fixed 2026-10-12: both tests now assert no bookingId, with a comment saying why. Proved able to fail: the route's meanwhile answer given a bookingId made both tests fail; put back after. Closed 2026-10-12 by independent review of step 12b.3, check of the fixes (107e315..dda246d): both tests assert no bookingId (schedule-routes.test.ts:862-865, :905-908); every move refused before the transaction answers with one, and the only time_taken without one is the in-transaction catch (save-time-off.ts:194).
