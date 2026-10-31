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

### F-179 [P3] fixed - A self-stop during a Postgres restart may restart the API into a database that is still down, until Railway's retries run out

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
**Resolution:** Fixed in 10b.1 (bd239f2): the runner's first start retries every 2 seconds for up to 60 while Postgres refuses or is starting up, proved by `retry-while-database-refuses.test.ts`. Observed on the live app 2026-10-21 at 01:37 UTC: Postgres and then the API restarted back to back; Postgres was taking connections again about 4 seconds after its restart, before the new API's runner started, so the API came up with no retry needed and no crash. The wait itself was not reached live, because that needs the live database kept down on purpose, judged not worth the risk. With Postgres back in seconds and a 60-second wait, the crash loop this finding feared does not arise.
Independent review of 10b.1, 2026-10-21: left `fixed`, not closed. The helper and its tests are sound (graphile-worker 0.18.0 rethrows the raw pg error and releases its pool when a start fails, dist/runner.js `runInternal` and dist/lib.js `withReleasers`, so the retries leak nothing), but the wait was never reached live and F-431 leaves open whether the live private host fails with a code it waits for. Close with F-431.
Independent review of feature 10b, 2026-10-23: re-examined, left `fixed`. Unchanged since 10b.1's review; the four helper tests pass, and graphile-worker 0.18.0's `RETRYABLE_ERROR_CODES` (dist/lib.js:354-362) still list `EHOSTUNREACH` and `ETIMEDOUT`, which the helper does not wait for, so F-431 still decides it.

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
Re-examined 2026-10-25 by /audit independent current (fix "One card per person", a2efedb..9dedc67): the premise "cards open only for `canEdit`" no longer holds. A member now gets "See" on every row (people-screen.tsx:299-312), and the read-only card renders PersonTextsPart inside a disabled fieldset, whose phone input shows each colleague's personal number on screen (person-texts-part.tsx:145-148; change-resource-form.tsx:102). The spec asks for "the same card, every field read-only", so this is as specified; the trade-off this finding names is now on the page, not only in the JSON. Still Frank's call; stays open.

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

Carried by Frank, 2026-10-22 (10b.2.4): both are about what the Calendar page says, and the page gets its own UI pass; logic first, the look later. Looked at on the real account in 10b.2: connect, ticks and busy times all worked.

### F-411 [P3] open - A ticked calendar the person hid from their list at Google shows as "No longer in your Google account" and cannot be ticked again once unticked

**File:** backend/lib/calendar/google-calendar-provider.ts:89-92; frontend/components/settings/busy-calendars-part.tsx:135; backend/lib/calendar/save-busy-calendars.ts:29-30
**Found:** 2026-10-12 by /audit independent (scope: current; lenses: quality, security, performance, tests)
**Why it matters:** listCalendars asks Google's calendarList without `showHidden`, whose documented default is false, so a calendar the person chose "Hide from list" for at Google is left out although it is still in the account and free/busy still reads it. If it was ticked, the page files it under "No longer in your Google account" (wrong words); once unticked and saved, the save refuses it as `unknown_calendar`, so it can never be ticked again until it is un-hidden at Google. The spec's "left the account" means deleted or unsubscribed, which hidden is not. Found from the request shape and Google's documented default; not seen against a real account (that check is in 10b).
**Suggested fix:** Set `showHidden=true` on the list request (deleted entries stay out by default), and one route test that the request carries it.
**Resolution:**

Carried by Frank, 2026-10-22 (10b.2.4): both are about what the Calendar page says, and the page gets its own UI pass; logic first, the look later. Looked at on the real account in 10b.2: connect, ticks and busy times all worked.

### F-428 [P3] open - A move placed right beside the time off, whose buffer reaches into it, is refused as "changed meanwhile", every time

**File:** backend/lib/schedule/save-time-off.ts:108-114,183-188; backend/routes/schedule-routes.ts:413-420
**Found:** 2026-10-12 by /audit independent (scope: current, 91b217c..b2d83d4; lenses: quality, security, performance, tests)
**Why it matters:** The same-person guard that answers "That new time is inside the time off itself" with the booking's id compares only the appointment's own times (`moving.endsAt - moving.startsAt`, no buffers), but the move then holds its span with both buffers (appointmentSpan in prepareBookingMove). Most seeded services carry a 10 to 15 minute buffer after. So Carlos off from 1 pm, his 2 pm one-hour job moved to noon the same day: the guard passes, prepareBookingMove passes (the time off is not held yet), the move holds noon to 1:15, and the time off's own hold collides at 1:00. The whole save rolls back as 409 `time_taken` with no `bookingId`, "Something in that time changed meanwhile. Nothing was saved: look again." Nothing changed meanwhile, every retry gives the same answer, and the form puts it in the notice instead of under the booking. The same happens for a move placed right after the time off ends when the service has a buffer before. Refusing is right (the buffer would sit in the time off); the words and the missing `bookingId` break the contract line "409 time_taken for a move into the time off itself", each with `{ bookingId }`. Found by reading the code; no test moves a buffered booking next to the span.
**Suggested fix:** In the same-person check, compare the move's span with buffers (appointmentSpan of the new start with the booking's service, or the plan's `span` after prepareBookingMove) against the time off, and answer `move_into_time_off` with the booking id. Add one route test: time off from 1 pm, a booking moved to end exactly at 1 pm on a service with a buffer after, expecting 409 with `bookingId`.
**Resolution:**

### F-429 [P3] open - The three new schedule schemas hand-write one calendar-date check, where the package already uses z.iso.date()

**File:** packages/shared/zod-validation/schedule-validation-schemas/book-by-hand-validation-schema.ts:16-23; schedule-week-query-validation-schema.ts:9-17; time-off-validation-schema.ts:10-17
**Found:** 2026-10-12 by /audit independent (scope: current, 91b217c..b2d83d4; lens: quality)
**Why it matters:** Each of the three schemas this feature adds carries its own copy of a YYYY-MM-DD regex plus a `Date.UTC` round-trip refine. The package's other date fields (close-day, open-closed-day, date-hours, availability-rule closedDates) use Zod's own `z.iso.date()`, which checks a real calendar date. Three copies of a hand-rolled check are three places to keep in step, and `Date.UTC` maps years 0 to 99 to 1900 to 1999, so the copies do not even mean exactly what `z.iso.date()` means. Low risk today; it is drift from the package's own way.
**Suggested fix:** Use `z.iso.date({ error: "Pick a day." })` (or one shared `calendarDateOf(message)` in the package) in all three schemas, keeping each field's words.
**Resolution:**

### F-431 [P3] unverified - The runner's first start waits only for "refused" and "starting up", while the live database is reached by a private host name

**File:** backend/lib/jobs/retry-while-database-refuses.ts:6-11
**Found:** 2026-10-21 by /audit (scope: current, c89e355..ce8474c; lenses: quality, security, performance, tests)
**Why it matters:** The live `DATABASE_URL` host is `postgres.railway.internal`, Railway's private network. While Postgres is down, a connection there may fail as a lookup error (`ENOTFOUND`, `EAI_AGAIN`) or a timeout (`ETIMEDOUT`) rather than `ECONNREFUSED` or `57P03`, and those are thrown at once, so the API would crash and lean on Railway's 10 restarts, the case F-179 was about. The Oct 21 live check could not show which error comes, because Postgres was back in about 4 seconds, before the API asked. Missing validation: the error the API gets from `postgres.railway.internal` while Postgres is down.
**Suggested fix:** When a Postgres outage is next seen (or on a planned stop), read the API's error code from its log; if it is a lookup or timeout error, add that code to `isDatabaseNotUpYet` with a test. Independent review of 10b.1 agrees and keeps it `unverified`: graphile-worker 0.18.0's own `RETRYABLE_ERROR_CODES` (dist/lib.js) treat `EHOSTUNREACH` and `ETIMEDOUT` as a database not reachable yet, which supports adding at least those two.
**Resolution:**

### F-444 [P3] fixed - No check exercises the daily, weekly and monthly folders before the merge, and the Done when names only "the next scheduled run"

**File:** .github/workflows/database-backup.yml:73-77; blueprint/context/current-feature.md (12c.1 Done when)
**Found:** 2026-10-23 by independent review of step 12c.1 (scope: 8640e41..0dd870b; lenses: quality, security, performance, tests)
**Why it matters:** The folder rule is the one piece of logic in the step, and it decides which copies outlive 3 days. The only proven run stored to `6h/` at 15:56 UTC; `daily/`, `weekly/` (`%u` = 7) and `monthly/` (`%d` = 01) first run after the merge, on the first 00 UTC, first Sunday and the 1st. The code reads correctly, but a slip there fails silently: no error, just no long-lived copy, noticed only when one is needed.
**Suggested fix:** Add to 12c's Done when (or `/complete`'s checks) one listing of `daily/` after the first 00 UTC run, `weekly/` after the first Sunday and `monthly/` after the first 1st following the merge, each written in the log.
**Resolution:** Fixed 2026-10-23: with F-439's rule the first run fills every empty folder, so run 39987049465 stored a copy in each of `6h/`, `daily/`, `weekly/`, `monthly/` before the merge. Re-examined 2026-10-23 by the independent review of 24ba21a..7208529: the code fills every empty folder on the first run (database-backup.yml:86-93), but the run itself was not re-observed (this review does not touch GitHub Actions), so it stays `fixed`.

### F-455 [P3] fixed - The overview's plan fingerprint was not recomputed after 12i, the item 13 note and 22c changed the build plan

**File:** blueprint/context/project-overview.md:3, 106-107
**Found:** 2026-10-23 by /audit independent current (scope: c08bc8d..58d7cf1; lenses: quality, security, performance, tests)
**Why it matters:** The marker `033b8a4b…` is `/overview`'s hash of the plans as they stood at 69549ad..ecf9778, and only in an all-CRLF form. 3d61d87, 37b3f74, a72e921 and 58d7cf1 then changed build-plan.md (item 13 waits on IA a la Orden, 12i added, 22c split from 22a). Recomputed by the contract at 58d7cf1: `08062e4d…` on the committed blobs, `ea36dec9…` on the checked-out files (project-plan CRLF, build-plan LF), `58377cd6…` all-CRLF; the marker matches none, so every `/status` reports drift and a later real plan change looks the same. The text is also behind the plan: it carries 12i and the item 13 note, but not 22c, and lines 106-107 say "calendar half before 13" twice. `/complete` ticking 22a does not change the normalized hash, so it will not repair this by itself.
**Suggested fix:** Add 22c to the overview's item 22 line, drop the repeated "(calendar half before 13)", and recompute the marker from the final plans by `/overview`'s contract over the checked-out bytes (or rerun `/overview`).
**Resolution:** Fixed 2026-10-23 by /complete for 22a: the overview's item 22 line names 22c and no longer repeats "calendar half before 13"; the marker is recomputed over the checked-out plans with 22a ticked, `ea36dec9…`, the checked-out form the review computed.

### F-456 [P3] open - The spec still describes Google's verification, the seven-day check and the fresh connect as 22a's work after the amendment moved them to 22c

**File:** blueprint/context/current-feature.md:31-35, 51, 66, 80-84, 92-94
**Found:** 2026-10-23 by /audit independent current (scope: c08bc8d..58d7cf1; lenses: quality, security, performance, tests)
**Why it matters:** The 22a.2 amendment and its Done when say submitting verification, Google's answer, the seven-day check and the fresh connect moved to 22c, but In scope still lists "then submit for verification", Build loop says "the feature stays open until it answers", step 22a.2 is still titled "Google publishes, then approves", and Testing still lists the seven-day `calendar:check` and a fresh connect after approval. Files / areas does not name `frontend/app/icon.svg`, which this branch changed. `/complete` archives this spec as the record of what 22a delivered, so the archive would claim checks that were never run, and 22c's spec could be written from it as if they were done.
**Suggested fix:** Before `/complete`, move the verification submission and the two after-approval checks out of In scope, Build loop, the 22a.2 title and Testing (one line pointing at 22c each), and add `frontend/app/icon.svg` to Files / areas.
**Resolution:**

### F-463 [P2] open - No test carries a Spanish booking from the database into its emails or its page, so swapping the two languages would pass

**File:** backend/lib/email/find-booking-email-context.ts:52, 130-132; backend/lib/booking/find-booking-page.ts:52, 100-101; backend/routes/public-booking-page-routes.ts:87; backend/routes/schedule-routes.ts:178
**Found:** 2026-10-24 by /audit independent current (scope: c217353..296314a; lenses: quality, security, performance, tests)
**Why it matters:** The Done when asks the backend tests to show "a Spanish booking's confirmation, moved and cancelled emails in Spanish and its owner notification in the business's language ... and the customer page answering in the booking's language". The email tests (`booking-emails.test.ts`) render from hand-built facts, and the send-* tests that load facts from the database only ever use English rows, so if `findBookingEmailContext` put the business's language where the booking's goes (or the reverse), every test would still pass. The customer page route's test only adds `language: "en"` to its expected answer: no test opens a Spanish booking's page (its `language` and its `when` in Spanish), and none asks the page's move times with `language=es`. The owner's own booking taking the business's language (schedule route, no language sent) and the setup file's `language` (applied only while the business has no service, listed as a difference after) have no test either.
**Suggested fix:** Add one database-backed test per rule that would hurt: a booking saved with `language: "es"` at an English business sends a Spanish confirmation and an English owner notification (subjects through the faked Resend); the page route answers that booking with `language: "es"` and a Spanish `when`, and its times route with `language=es` writes Spanish `when`; an owner's booking at a Spanish business is stored `"es"`. One `run-client-setup` case for `language` if the setup rule is meant to hold.
**Resolution:** Partly fixed 2026-10-24 on feature/12i: a database-backed test now takes a Spanish booking through its page and its move times (language=es). Still untested from the database: the email facts (findBookingEmailContext needs a business ready to send, whose key save calls Resend), the owner's own booking taking the business's language, and the setup file's language. Carried. Re-examined 2026-10-24 by /audit independent current (c217353..d5ec3d3): still open. The page and move-times parts are now covered (public-booking-page-routes.test.ts "a Spanish booking"). Still no database-backed test reads booking.language and organization.language into the email facts (findBookingEmailContext: a swap of row.language and business.language would pass every test), none checks an owner's booking from schedule-routes.ts taking the business's language, and none runs the setup file's language through applyBusinessShape or findDifferences.

### F-467 [P3] open - On a phone, a day left open in a month that runs out of times hides the calendar with no way back to it

**File:** packages/booking-component/booking-window/screens/month-layout/month-service-screen.tsx:77, 100-103, 144, 165-174; packages/booking-component/booking-component.css (the 760px query, `.sa-pick--day > :first-child`)
**Found:** 2026-10-24 by /audit independent current (scope: c217353..d5ec3d3; lenses: quality, security, performance, tests)
**Why it matters:** Below 760px, `dayOpen` hides the calendar and the only way back is the Back button inside `DayTimesView`. When `dayOpen` is true but the month has no times left, `shownDate` is null and the screen draws the "No times left in ..." block instead, which has no Back. `dayOpen` is cleared only by a month change or that Back, so the customer sees neither the calendar nor its month arrows. It is reached by changing the person in the rail while a day is open (`changePerson` keeps `dayOpen`) to one with no times that month, or by coming back from the form (a time taken, or Back to the times: `place` sets `dayOpen`) after the month's last time went. In any month but the last, the block's Next month button still moves on; in the last bookable month (or a one-month horizon) the only ways out are changing the person again or closing the window. Code-path evidence; not seen in a browser, and jsdom applies no CSS.
**Suggested fix:** Show the calendar whenever there is no day to show: set the `sa-pick--day` class only when `dayOpen && shownDate !== null` (or clear `dayOpen` in `changePerson` too). One jsdom check on the class is enough.
**Resolution:**

### F-468 [P3] open - The window's day and month names now build a new Intl formatter on every call, about 42 per calendar draw

**File:** packages/booking-component/booking-window/month-calendar/format-day-name.ts:9; format-month-name.ts:8; called per day button in screens/month-layout/month-calendar-view.tsx:78
**Found:** 2026-10-24 by /audit independent current (scope: c217353..d5ec3d3; lenses: quality, security, performance, tests)
**Why it matters:** Before 12i each formatter was built once at module level. Now `formatDayName` and `formatMonthName` construct an `Intl.DateTimeFormat` inside the function, and the calendar calls `formatDayName` for every day button (up to 42) on every render of the service screen, which re-renders on each pick, person change and times answer. Measured here in Node: 42 constructions plus formats take about 3.4 ms; a low-end phone is several times slower. Small, but it is new work on the screen a phone customer taps through, for no gain: there are only two languages.
**Suggested fix:** Keep one formatter per language at module level (a `Record<BookingLanguageType, Intl.DateTimeFormat>` built lazily or up front), as the code did for English before.
**Resolution:**

### F-486 [P3] open - The Calendar's Day, Week and Month views were built on this branch but the spec does not record them

**File:** blueprint/context/current-feature.md:29-36, 96-110; frontend/components/schedule/schedule-screen.tsx; frontend/components/schedule/schedule-time-grid.tsx; frontend/components/schedule/schedule-month-grid.tsx; frontend/lib/calendar-dates.ts
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..247d810; lenses: quality, security, performance, tests)
**Why it matters:** Commits ec5f6f0, 81749cb and 06c05ec ("From Frank's walk of 12j") replace the Calendar's week list with a Day, Week and Month time grid (about 700 lines), add `google=skip` to the week route for the Month view, and move Book by hand and Time off behind buttons. The spec, which `/complete` archives as the record of feature 12j, mentions only "the schedule" being translated: there is no step, In scope line, Done when or Data / contracts entry for the views or the new query value. F-476 and F-480 were real defects in this unlisted work, found only by review. Anyone reading the archive later will not find where the Calendar's grid came from or what it was checked against.
**Suggested fix:** Before `/complete`, add the views to the spec as an amendment to 12j.2 (or a note under Build steps): what they show, `google=skip` under Data / contracts, and how they were checked (the Month, Next, Today walk recorded in F-476).
**Resolution:**

### F-498 [P3] unverified - A change of the business's time zone never lists the bookings it moves outside a service's own window

**File:** backend/lib/settings/save-business-hours.ts:66-69
**Found:** 2026-10-25 by /audit independent (re-review of 12k.2 at 1eef929; lens: quality)
**Why it matters:** A service's window is clock time in the business's zone. A save of the business's hours that changes the zone lists the bookings that no longer fit the people's hours, but never reads `service_hours`, so a 2:00 booking of an afternoons-only service that becomes 11:00 in the new zone, still inside the person's hours, is not listed though customers could no longer book that time. Reasoned from the code, not reproduced. Since F-493 the business's week and one-off dates no longer reach a service window, so only the zone can. Rare, and no booking is changed, so only the notice is incomplete.
**Suggested fix:** Run each service's window through the same before and after check when the zone changes, or record in the spec that a zone change lists only the people's hours.
**Resolution:**
Rechecked 2026-10-25 by /audit independent (review of 12k.3 at 398cfb1): save-business-hours.ts is unchanged since 1eef929 and still never reads `service_hours`; still reasoned, not reproduced. Stays unverified.

### F-503 [P3] fixed - The overview's plan fingerprint was not recomputed after b273b0e changed the project plan's decision 26

**File:** blueprint/context/project-overview.md:3
**Found:** 2026-10-25 by /audit independent (final review of 12k at 735afbb; lens: quality)
**Why it matters:** The marker `996777de…` is `/overview`'s hash of the plans in their checked-out CRLF form at 0da782d (recomputed here by the contract: project-plan bytes, a zero byte, build-plan with `- [x]` normalized). b273b0e then rewrote decision 26 in project-plan.md, and the same computation over the checked-out files at 735afbb gives `be1b829e…` (`21af3cbc…` on LF blobs), so every `/status` now reports overview drift and a later real plan change will look the same, which is what F-455 repaired at 22a. The overview's text needs no change: it never carried decision 26's old "anyone" line (its only who-does-what mentions are lines 64, 92 and 265).
**Suggested fix:** Recompute the marker over the checked-out plans by `/overview`'s contract (or rerun `/overview`), at `/complete` once 12k is ticked, since ticking does not change the normalized hash.
**Resolution:** Fixed 2026-10-25 at /complete: the marker is recomputed by /overview's contract over the checked-out CRLF form of both plans, with 12k ticked: `be1b829e1f2aa70643b5ebfa16810c16878757015340c4a5c7e88cc743114ea3` (the same computation reproduces the old `996777de…` on the plans before b273b0e).
Still open 2026-10-25 by /audit independent (final review of 12k at 58c8bf5): 58c8bf5 touches neither plan nor the overview, project-overview.md:3 still reads `996777de…`, and the same computation over the checked-out plans still gives `be1b829e…`. For `/complete`, by its own contract.

### F-517 [P3] open - The spec says "no new package, no major version", but the lockfile adds three packages and moves one a major version, all inside the shadcn CLI chain

**File:** blueprint/context/current-feature.md:29
**Found:** 2026-10-26 by /audit independent (review of fix/npm-audit-warnings at 2a42e92; lens: quality)
**Why it matters:** Comparing the two lockfiles: `@shadcn/registry` 0.2.0 (with its own `cn` 0.2.6), `type-fest` 4.41.0 and nested copies of `content-type` 2.1.0 and `obug` 3.0.0 are added; `cosmiconfig` 9.0.2 and shadcn's private `zod` 3.25.76 are removed; `content-disposition` moves 1.1.0 to 2.0.1 because `express` 5.3.0 asks for `^2.0.1`; `why-is-node-running` steps back 3.2.2 to 3.2.1 because `vitest` 5.0.5 pins it exactly. All of it follows from `shadcn` 4.21.0 to 4.22.1, `express` 5.2.1 to 5.3.0 and `vitest` 5.0.2 to 5.0.5, nothing the live API imports, and no `package.json` changed, so the change is sound. The statement is true for direct dependencies only, and Frank reads the record rather than the lockfile; `shadcn` sits in the frontend's `dependencies`, so its new packages also install on Vercel.
**Suggested fix:** Say "no new direct package and no major version of one; the shadcn CLI pulls in @shadcn/registry and type-fest and moves content-disposition to 2.x" in the spec and the build log entry at `/complete`.
**Resolution:**

### F-529 [P3] open - The spec's Open questions still ask whether someone is working on the DesignPicker change, which step 2 answered and stashed

**File:** blueprint/context/current-feature.md:176-178
**Found:** 2026-10-26 by the second final independent review of feature 17 (scope: current, main..eb2a6a3 and face-and-body main..3396aa1; lenses: quality, security, performance, tests)
**Why it matters:** Step 2 (line 115) and her repo's own `current-feature.md` record that the uncommitted `DesignPicker.tsx` change was stashed because nobody was working on it, and `git stash list` in face-and-body holds it ("DesignPicker work in progress, stashed for feature 11 on 2026-10-26"). The Open questions section still asks "is someone still working on it?" and says 17.2 "cannot branch off her main cleanly until" it is settled, so the archived spec shows a question as open that the feature closed, and does not say where the work now sits.
**Suggested fix:** Mark the question answered in the spec: stashed on 2026-10-26 on `design/copy-my-picks` (nobody was working on it), found with `git stash list` in face-and-body.
**Resolution:**

### F-532 [P2] open - The card says emails come from a saved sender's domain even when Resend will refuse that domain and every email goes from booking-crm.com

**File:** backend/lib/email/resolve-business-sender.ts:36-46; backend/lib/email/find-email-sending-state.ts:30
**Found:** 2026-10-27 by /audit independent current (scope: 7abbf56..3ae2eca; lenses: quality, security, performance, tests)
**Why it matters:** The spec's contract is that the card "never says one thing and the email does another". For a saved sender the resolver does no DNS look and always reports `ownDomain`, so `fromOwnDomain` is true and the card reads "Booking emails come from hola@ialaorden.com" for any saved address, a gmail.com one included. If that domain is not in the agency's Resend (the businesses that used their own Resend accounts until now are the likely case), Resend answers 403 on every email and each one goes from `bookings@booking-crm.com` after a wasted call, while the card keeps naming the business's domain. The email-sending route test asserts `fromOwnDomain: true` for a saved sender with no signing-record check.
**Suggested fix:** Apply the signing-record check to the saved sender's domain too (or to the website domain the F-531 fix ties it to), and fall to `booking-crm.com` with `fromOwnDomain: false` when it is absent; cover it in the resolver and card tests.
**Resolution:** fixed 2026-10-27 with F-531: a saved sender is used only when its website domain shows Resend's signing record, the same check the card reads, so the card and the email agree. Test: resolve-business-sender.test.ts (a saved sender whose domain is not in Resend goes from booking-crm.com).
Reopened 2026-10-27 by /audit independent current (fresh subagent, 7abbf56..6e76d60): the part about a saved sender with no DNS look at all (a gmail.com one included) is gone, but the case this finding names as likely is not. `hasResendSigningRecord` (has-resend-signing-record.ts:16-18) proves only that `resend._domainkey.<domain>` carries a key, and that record is published for a domain verified in any Resend account, the business's own included, since every Resend account uses the same `resend` selector. For a business whose domain was set up in its own Resend account (the pre-25a model, decision 6), the resolver reports `ownDomain`, the card reads "Booking emails come from bookings@<its domain>.", the agency key gets a 403 on every email and each one goes from `bookings@booking-crm.com` after a wasted call. The card and the email still disagree for exactly those businesses. Suggested repair: when the 403 fallback fires, mark that domain as not set up in the same one-hour answer cache (so the card and later emails follow booking-crm.com), or compare the published key against the agency's own record for that domain; and move such domains into the agency's Resend before release.

### F-533 [P3] open - `.env.example` still says each business's booking emails go through its own Resend account

**File:** .env.example:80-86
**Found:** 2026-10-27 by /audit independent current (scope: 7abbf56..3ae2eca; lenses: quality, security, performance, tests)
**Why it matters:** The spec's In scope lists `.env.example` among the docs to change ("the agency key now carries every business's booking emails"), but the delta does not touch it. Its comment above `RESEND_API_KEY` still reads that booking emails use "the business's own Resend account instead, with a key stored in the database, never here", and does not say that outside production no booking email is sent even with the key set. Whoever sets up Railway or a new laptop from it is told the opposite of what the code now does. `AGENTS.md` was updated.
**Suggested fix:** Rewrite that comment to match `AGENTS.md`'s new 25a paragraph: the agency key sends login codes and every business's booking emails; a domain is added in Resend (and its records in Vercel) to send from it; on the laptop booking emails are only logged.
**Resolution:** Still open at 6e76d60 (independent review, 2026-10-27): `.env.example:83-88` is unchanged by the delta and still says booking emails go through the business's own Resend account.

### F-534 [P3] open - The fallback's log line names the booking, not the business, and says "sent" before the second send is tried

**File:** backend/lib/email/send-email.ts:36-38
**Found:** 2026-10-27 by /audit independent current (scope: 7abbf56..3ae2eca; lenses: quality, security, performance, tests)
**Why it matters:** The spec says the fallback is "logged as one line naming the business, never the addresses". The line carries the email kind and the idempotency key (`booking-confirmation/<bookingId>`, or `text-reply/<messageSid>`), so no address leaks, but it never names the business, which is what tells the agency whose domain needs fixing in Resend. It is also written before the fallback send, so a 403 that is not about the domain (Resend's `invalid_api_key` is also a 403) logs "sent from the agency's instead" and then fails a second time.
**Suggested fix:** Pass the organization id into the send input for the log only, and word the line as "refused from its own domain, trying the agency's" (or log after the second send returns).
**Resolution:** Still open at 6e76d60 (independent review, 2026-10-27): send-email.ts:36-38 unchanged; the line names the kind and idempotency key, no business id, and is written before the second send.

### F-535 [P3] open - The signing-record DNS lookup has no time limit and runs inside save-resource's database transaction

**File:** backend/lib/settings/save-resource.ts:35,66-76; backend/lib/email/has-resend-signing-record.ts:16
**Found:** 2026-10-27 by /audit independent current (scope: 7abbf56..3ae2eca; lenses: quality, security, performance, tests)
**Why it matters:** `resolveTxt` uses the resolver's default timeouts and retries, so an unanswering name server can hold the call for several seconds. The lookup now sits on the dashboard's card GET, the people settings read and every booking email, and in `saveResource` it runs inside `db.transaction`, keeping a transaction (and a pooled connection) open across a network call whenever a work email changes. The one-hour cache makes it rare; the delay is unverified at runtime.
**Suggested fix:** Resolve the sender before opening the transaction in `saveResource`, and give the lookup a short limit (a `Resolver` with `timeout` and `tries`, or a race against a few seconds) that counts as "not set up".
**Resolution:** Still open at 6e76d60 (independent review, 2026-10-27): save-resource.ts:66-76 still calls `resolveBusinessSender` inside `db.transaction`, and has-resend-signing-record.ts:16 still uses the default `resolveTxt` with no limit. findPeopleSettings (find-people-settings.ts:99-107) also awaits it after its parallel reads.

### F-536 [P3] open - The work-email rule's new website-domain path and the text reply's fallback have no test, and one test fakes a DNS failure the real lookup cannot produce

**File:** backend/lib/settings/save-resource.ts:66-76; backend/lib/text/pass-on-reply.ts:93-114; backend/lib/email/send-booking-emails.test.ts:526-531
**Found:** 2026-10-27 by /audit independent current (scope: 7abbf56..3ae2eca; lenses: quality, security, performance, tests)
**Why it matters:** `saveResource` and `findPeopleSettings` now take the business's domain from the website when no sender is saved, but no settings test makes a business with a website and a signing record and saves a work email at it (or is refused without one). `passOnReply` gained `fallbackFrom` and the agency key with no test of either. The "fails before Resend" test now makes the mocked `hasResendSigningRecord` throw, but the real function catches every error and returns false, so the test proves a path that cannot happen in production rather than a real failure before Resend.
**Suggested fix:** Add one settings route test for the website-domain work email (accepted with the record, `no_sending_address` without), one text-reply test where a 403 resends from `booking-crm.com`, and make the before-Resend test fail somewhere real (for example a render that throws).
**Resolution:** Partly addressed, still open at 6e76d60 (independent review, 2026-10-27): settings-routes.test.ts:975-1040 now sets the website (with the signing record faked) and saves a work email at its domain, refuses one at another, and follows a website move. Still missing: a text-reply test where a 403 resends from `booking-crm.com` (public-text-routes.test.ts only checks the own-domain from line), and the before-Resend test (send-booking-emails.test.ts:28,531-536) still makes the mocked DNS lookup throw, which the real function never does.

### F-537 [P3] open - The spec, AGENTS.md and three comments still describe the sender rule from before the F-531 repair

**File:** blueprint/context/current-feature.md (In scope, "Which address" and "Work emails"); AGENTS.md:521-527; backend/lib/settings/find-people-settings.ts:98; backend/lib/settings/save-resource.ts:66; backend/lib/email/send-email.ts:1-3
**Found:** 2026-10-27 by /audit independent current (scope: 7abbf56..6e76d60; lenses: quality, security, performance, tests)
**Why it matters:** The F-531 repair changed the rule: a saved sender is used only when it is at the website's domain and that domain shows Resend's signing record, and the work-email domain is always the website's. The spec still lists rule 1 as "the business's own sender address when one is saved ... kept as a choice" ahead of the website rule, and says the work-email domain "comes from rule 1 or 2". AGENTS.md says "the business's saved sender if any, else bookings@<its website's domain>". The two settings comments say "from its saved sender, else its website", and send-email.ts's header still says businesses send with "the business's own" key (decision 6). Frank reads AGENTS.md and the code; both now describe a sender a business can no longer choose. The project rule is that a spec a review shows wrong is amended.
**Suggested fix:** Amend the spec's "Which address" and "Work emails" lines and the AGENTS.md 25a paragraph to the repaired rule (sender only at the website's domain, once it is in Resend), and update the three comments.
**Resolution:**

### F-538 [P3] open - Key-era words remain: eight Spanish strings nothing produces, and the work-email refusal tells the owner to set something that no longer helps

**File:** packages/shared/helpers/spanish-messages.ts:319-334; backend/routes/settings-routes.ts:402-406
**Found:** 2026-10-27 by /audit independent current (scope: 7abbf56..6e76d60; lenses: quality, security, performance, tests)
**Why it matters:** The delta deleted check-email-sending-key.ts, the key schema and the provision refine, but kept their eight Spanish translations ("That is not a Resend key...", "Resend refused this key.", "Enter the address emails come from, so the key can be tested.", the test-email and saved-key lines); `git grep` finds no other use. Separately, `no_sending_address` still answers "Set the business's sending address first." Since 25a the owner cannot unlock work emails by setting a sender: the domain comes only from the website (admin-set) once it is in Resend, and the card refuses a sender while there is no website. The message sends the owner to a card that cannot fix it.
**Suggested fix:** Delete the eight unused strings, and reword the refusal (both languages) to say work emails open once the business's own domain is set up, which the agency does.
**Resolution:**

### F-539 [P3] open - Client setup saves a sender at any domain, which the emails then silently ignore

**File:** packages/shared/zod-validation/organization-validation-schemas/business-email-details-validation-schema.ts:12; backend/lib/admin/provision-client.ts:93-101; frontend/components/admin/client-setup-form.tsx:57-63
**Found:** 2026-10-27 by /audit independent current (scope: 7abbf56..6e76d60; lenses: quality, security, performance, tests)
**Why it matters:** The owner's card refuses a sender not at the website's domain (F-531), but the platform admin's "Client setup" form and POST /admin/clients still accept any well-formed sender with any website (or none). The resolver then ignores it, so a typo or a mismatched website (hola@ialaorden.com with a website on another domain) is saved without a word and every email goes from `bookings@<website domain>` or booking-crm.com, while the card's "Emails come from" field shows the saved address. Not a security issue (the resolver never uses it); it is two rules for one field, and the form offers a choice the emails will not honour.
**Suggested fix:** Apply the same rule in the provision schema (a refine that the sender ends in `@<website domain>`, else a field message), sharing `websiteDomain`'s logic, or drop the sender field from the admin form now that it is picked.
**Resolution:**

### F-540 [P3] open - The cross-tenant guard rests on the website staying admin-only, and booking-crm.com is not excluded as a business's own domain

**File:** backend/lib/email/resolve-business-sender.ts:26-29; backend/lib/email/website-domain.ts:5-13; backend/lib/email/save-email-sending.ts:35-44
**Found:** 2026-10-27 by /audit independent current (scope: 7abbf56..6e76d60; lenses: quality, security, performance, tests)
**Why it matters:** After the F-531 repair the only proof that a domain belongs to a business is that it equals the business's website, and nothing in code, comment or test pins that the website is platform-admin only (today it is: only provision-client and the client-setup script write it). F-531's suggested fix also asked to refuse `booking-crm.com`; the repair does not. If a business's website is ever on `booking-crm.com` (a hosted page at item 24 used as the website, or an admin typo), that domain shows the signing record, so the owner may save `support@booking-crm.com` or any other platform address and send as it. At item 25, if owners can edit their website, the F-531 hole reopens through the website: setting another client's site makes that client's domain the sender. Latent today; no current path for an owner.
**Suggested fix:** In the resolver and on save, never treat `booking-crm.com` or its subdomains as a business's own domain, with a test; and state at the website field (and in item 25's plan) that it is the sending-domain proof, so self-serve must verify it before it can send.
**Resolution:**

### F-541 [P3] open - The customer's Reply rule is written in three places, and the helper still says who hears is "decided in this one place"

**File:** backend/lib/email/find-booking-email-recipients.ts:1-4,29; backend/lib/email/send-move-emails.ts:87-88; backend/lib/email/send-cancellation-emails.ts:68-69
**Found:** 2026-10-27 by /audit independent current (scope: b54d3a7..2fb28ee; lenses: quality, security, performance, tests)
**Why it matters:** The fix's one rule (work email, else notification address, never the sender) lives as `workEmail ?? input.notifyEmail` in the recipients helper and again as `context.personWorkEmail ?? setup.notifyEmail` inline in the move and cancellation senders. The helper's header still says who hears about a booking is "decided in this one place". The spec chose this shape, so it is not a defect today; but the next change to the rule (for example the idea of replies relayed through the app, or a business-chosen reply address) has to find three copies, and missing one brings back exactly the "Reply reaches nobody" bug this fix closes, in one email only.
**Suggested fix:** One small exported function (for example `customerReplyToOf(personWorkEmail, notifyEmail)` beside the recipients helper) used by all three senders, and the helper's header worded to match.
**Resolution:**

### F-542 [P3] open - A move's email takes its Reply from the booking's current person, while the rest of that email is built from the move's own saved entry

**File:** backend/lib/email/send-move-emails.ts:42-43,70,88
**Found:** 2026-10-27 by /audit independent current (scope: b54d3a7..2fb28ee; lenses: quality, security, performance, tests)
**Why it matters:** `sendMoveEmails` deliberately reads move N's times and person from its timeline entry "even after a later move ... so a retry sends the very same email and Resend accepts the key again". The new `replyTo` instead reads `context.personWorkEmail`, the work email of whoever holds the booking when the job runs. If a second move to another person lands before move 1's job sends (or between a Resend-accepted send and a job retry), the customer's "moved to Marco" email replies to Ana, and a retry carries a different `reply_to` under the same idempotency key, which Resend refuses for 24 hours. Same for an owner editing the person's work email or the notification address between attempts. Rare (two moves in a job's window, or a partial failure plus an edit); the confirmation already had the work-email variant of the retry case before this fix.
**Suggested fix:** For the move, read the work email of the move's `toPersonId` (the code already looks that person up for the name), so the Reply matches the email it sits on; accept the notification-address drift, or note it in the comment.
**Resolution:**

### F-543 [P3] open - The cancellation test covers only the notification-address Reply, and no test shows the owner's login email as the fallback Reply

**File:** backend/lib/email/send-cancellation-emails.test.ts:222; backend/lib/email/send-move-emails.test.ts:360-373
**Found:** 2026-10-27 by /audit independent current (scope: b54d3a7..2fb28ee; lenses: quality, security, performance, tests)
**Why it matters:** The spec's Done when asks the confirmation, move and cancellation tests to assert the customer's Reply, "work email when there is one, else the notification address". Confirmation (send-booking-emails.test.ts:216,282) and move (227,372) assert both branches; cancellation asserts only the notification-address branch, so its inline `context.personWorkEmail ?? setup.notifyEmail` could lose the work-email half without a failing test. The spec's rule also names the owner's login email as the notification address when none is saved; no Reply assertion covers that path (it rests on the context's `business.notifyEmail ?? business.ownerEmail`, tested only for who receives notices).
**Suggested fix:** Add a cancellation test with the booked person's work email set, mirroring the new move test; optionally one confirmation assertion on a business with no saved notification address. Resolves with F-541 if the rule moves into one tested function.
**Resolution:**

### F-545 [P3] open - `.env.example` still says WIDGET_ORIGINS is for live client sites

**File:** .env.example:31,77-80
**Found:** 2026-10-27 by /audit independent current (scope: aa8627d..258544c; lenses: quality, security, performance, tests)
**Why it matters:** The spec's Docs item says `AGENTS.md` and the `.env.example` comment both say `WIDGET_ORIGINS` is only for the laptop's dev sites. `AGENTS.md` changed; `.env.example` is tracked in git and unchanged in the delta and the working tree. Its live list still says "WIDGET_ORIGINS: empty until a client site goes live" and its entry still calls them "The client sites allowed to call the public booking routes", which steers the next setup back to the Railway edit this feature removes. The spec's Files list calls it "Frank's uncommitted copy", but the file is not ignored.
**Suggested fix:** Reword both comments: dev sites on the laptop only; live client sites come from each business's Website (25b).
**Resolution:** Still open 2026-10-27 by /audit independent current (fresh subagent, aa8627d..f793bc1): `.env.example` is tracked (`git ls-files`), unchanged in the delta and the working tree; line 31 still reads "WIDGET_ORIGINS: empty until a client site goes live" and line 77 still calls them "The client sites allowed to call the public booking routes". The spec's Docs item is half done.

### F-546 [P3] open - The one-minute cache and the failed-lookup path have no test, and the `now` seam is unused

**File:** backend/lib/booking/website-domain-for-slug.ts:18-29; backend/middleware/public-middleware/public-cors-middleware.ts:33-40; backend/routes/public-booking-links-routes.test.ts:523-594
**Found:** 2026-10-27 by /audit independent current (scope: aa8627d..258544c; lenses: quality, security, performance, tests)
**Why it matters:** The new tests cover the origin rule well (own site with and without `www`, the POST preflight, another business, `http`, a look-alike suffix, a subdomain, an unknown slug, the booking page, the fixed list). The two other rules the spec states have nothing guarding them: a changed Website takes effect after the minute (and not before a re-read), and a lookup that throws allows nothing beyond the fixed list. A refactor that returned the Origin on error, or cached forever, would pass every test. `websiteDomainForSlug` takes a `now` argument that nothing passes, so the seam built for the expiry test is dead code today.
**Suggested fix:** One small test of `websiteDomainForSlug`: change the row's Website, see the old domain until `now` passes the minute, then the new one; and one middleware test with the lookup failing that expects no `Access-Control-Allow-Origin`. Or drop the `now` parameter.
**Resolution:** fixed 2026-10-27: website-domain-for-slug.test.ts proves the one-minute keep through the now seam (kept at 59 s, read again at 61 s) and that an unknown business or a wrong-shaped address has none. The failed-lookup path stays covered only by reading (a database failure is not simulated).
Reopened 2026-10-27 by /audit independent current (fresh subagent, aa8627d..f793bc1), narrowed: the cache part and the `now` seam are resolved (website-domain-for-slug.test.ts:34-47 passes, kept at 59 s and re-read at 61 s). The failed-lookup rule is still unguarded: nothing makes `websiteDomainForSlug` throw, so a change to public-cors-middleware.ts:39-42 that returned the Origin on error would pass every test, which is the defect this finding names. Remaining fix: one middleware test with the lookup failing that expects no `Access-Control-Allow-Origin`, or an explicit decision to leave it read-only.

### F-547 [P2] open - A preflight with an https Origin and a new slug still costs one database query with no limit in front of it

**File:** backend/middleware/public-middleware/public-cors-middleware.ts:29-42; backend/lib/booking/website-domain-for-slug.ts:20-32; backend/app.ts:54
**Found:** 2026-10-27 by /audit independent current (scope: aa8627d..f793bc1; lenses: quality, security, performance, tests)
**Why it matters:** `publicCorsMiddleware` runs before `publicRateLimitMiddleware`, and Hono's cors (4.13.14) answers `OPTIONS` itself without calling `next()`, so preflights are never limited; GETs and POSTs also pay the lookup before the limiter counts them. Any request carrying `Origin: https://<anything>` to `/public/<novel-slug>/x` misses the cache (the slug space is effectively endless) and runs one indexed query, so the per-visitor limiter no longer stops a flood from reaching the database. Once 1000 such slugs are kept the whole map is cleared, which also drops every real business's entry and sends their busy sites back to the database. Concurrent first calls for one slug each query too (no in-flight sharing), and during a database outage every such request retries the query and logs a warning. Each query is cheap (unique index on `organization.slug`, `LIMIT 1`), so this is load amplification, not a break; the memory part of the original risk is closed in F-544.
**Suggested fix:** Keep one map of every business's slug to its Website domain, loaded in one query and refreshed at most once a minute (the business count is small), and answer the CORS rule from it alone: an unknown slug then costs no query, the cap and the clear go away, and a changed Website still works within a minute. Keep "a failed refresh allows nothing beyond the fixed list" (or keeps the last good map, if that is decided).
**Resolution:**

### F-550 [P3] open - pack:site reads every entry in the site's vendor/ in full and crashes on a subfolder there

**File:** packages/booking-component/pack-into-site.mjs:55-60
**Found:** 2026-10-27 by /audit independent current (fresh subagent; scope: a0f2f86..cb587fc; lenses: quality, security, performance, tests)
**Why it matters:** The command hands `decidePackIntoSite` the bytes of every name `readdirSync(vendorFolder)` returns, although only `frankdmosquera-booking-component-*.tgz` files are ever compared or removed. `vendor/` is a common folder name for other vendored code; a subfolder there makes `readFileSync` throw. Run against a throwaway folder whose package.json lists the window and whose `vendor/` holds only an empty `sub/` folder, it built and packed, then stopped with `EISDIR: illegal operation on a directory` and a stack trace instead of a "Not installed" line. Nothing is written to the site, so no harm beyond a confusing stop after a full build; large unrelated files there are also read for nothing.
**Suggested fix:** Filter the names with the packed-file pattern before reading their bytes (or skip entries that are not files), so vendor/ may hold anything else.
**Resolution:**

### F-551 [P3] open - The spec still lists where IA a la Orden's move is committed as an open question, and does not say the move landed in another session's 12c commit

**File:** blueprint/context/current-feature.md:131-137, 49-52
**Found:** 2026-10-27 by /audit independent current (fresh subagent; scope: a0f2f86..cb587fc; lenses: quality, security, performance, tests)
**Why it matters:** The spec is `verified` and its step says IA a la Orden moved "where the open question says", but Open questions still offers (A) and (B) with no answer. In agency-site-app the move went onto its open branch (option A), split across a1b73d0, the other session's `feat: 12c a call can say what it is about` (the `.npmrc` removal, package.json, lockfile and vendor file), and 15c714d (the AGENTS.md line), where the spec planned one commit. The build log's step 25c.1 records the split, but the archived spec will show a question as open that the feature closed, and a later rollback of 12c in that repo would also undo the window move with nothing in this repo pointing at it.
**Suggested fix:** Mark the question answered in the spec: option A, on `feature/12c-our-own-cards-on-real-times`, content in a1b73d0 plus 15c714d, both unpushed, so the move goes online when that branch merges.
**Resolution:**

### F-553 [P3] open - A new dashboard against the old API refuses every service save until the API is live

**File:** deploy order (Vercel and Railway build the same push)
**Found:** 2026-10-27 by independent review (fresh subagent; scope: 725c801..041d67c)
**Why it matters:** The new form sends `priceCents` and `priceFrom`; the old API's strict schema refuses them, and `PUT /settings/services/currency` is a 404 there, for the minutes Vercel is live before Railway.
**Suggested fix:** Deploy the backend first, or accept the few minutes.
**Resolution:**

### F-557 [P3] open - A hand-made Settings call that clears a "From" price without sending priceFrom gets a 500

**File:** packages/shared/zod-validation/booking-links-validation-schemas/service-validation-schema.ts:58-63; backend/lib/settings/save-service.ts:38; packages/shared/db/booking-tables/booking-link-table.ts:66
**Found:** 2026-10-27 by independent re-review (fresh subagent; scope: 041d67c..905a626)
**Why it matters:** With both price fields optional, a body with `priceCents: null` and no `priceFrom`, on a service saved as "From $150", passes the refine, and the update breaks `booking_link_price_from_check`: a 500 instead of a 400. The dashboard's form always sends both and an older form neither, so only a hand-made call reaches it.
**Suggested fix:** A refine that takes both price fields or neither.
**Resolution:**

### F-567 [P3] open - A shrunk photo written as JPEG is never checked against 1 MB before it is sent

**File:** frontend/lib/shrink-picture.ts
**Found:** 2026-10-28 by independent re-review of step 25e.1 (fresh subagent; scope: 72d2649..4245aec)
**Why it matters:** A 1200 px JPEG at quality 0.85 is nearly always far under 1 MB, but nothing checks it; an unusually detailed one would be refused by the API with its clear "over 1 MB" message, not lost.
**Suggested fix:** Encode once more at a lower quality when the JPEG is over 900 KB.
**Resolution:**

### F-578 [P2] open - In dark mode the dashboard's highlight is shaded for a white page

**File:** frontend/lib/business-accent-style.ts
**Found:** 2026-10-28 by independent re-review of step 25e.2 (fresh subagent; scope: 31dbc20..4906585)
**Why it matters:** Under `data-theme="dark"` the page is about #18191f, and a colour darkened for white reads worse there (amber 3.69, Rose clay 3.73). Nothing in the app sets `data-theme="dark"` today: the CSS exists, the switch does not, so no one can reach it yet.
**Suggested fix:** When a dark switch is built, set a second, dark-shaded set of the accent tokens under `[data-theme="dark"]` (or compute the shade from the theme in use).
**Resolution:**

### F-579 [P3] open - On a mid-grey background the window's colour can fall just short on the free days' disc

**File:** packages/booking-component/booking-window/theme-style.ts:37
**Found:** 2026-10-28 by independent re-review of step 25e.2 (fresh subagent; scope: 4906585..d9ab953)
**Why it matters:** The outer readableOn picks its direction from the background alone; with a mid-grey background (luminance about 0.15 to 0.25) and text barely readable on it, the shade can read on the background and miss on the disc (#767676, black text, red main: 4.62 and about 4.2). 16 of about 112,000 random pairs; in some no colour reads on both.
**Suggested fix:** Pick the direction that reads on both surfaces, and refuse such a background and text pair in the schema.
**Resolution:**

### F-580 [P3] fixed - Applying a setup file's colours overwrote an email colour set earlier, unlisted

**File:** packages/shared/client-setup/apply-business-shape.ts; run-client-setup.ts
**Found:** 2026-10-28 by independent review of step 25e.3 (fresh subagent; scope: 9cb8106..a2a528b)
**Why it matters:** A business set up with a brandColor for its emails, and colours not yet saved on Look, had that colour replaced (or cleared) by the file's main colour, with no difference listed: against the file's own rule that a row already there is listed, never overwritten.
**Suggested fix:** Keep the email colour and list the file's other one.
**Resolution:** fixed 2026-10-28: the colours are filled only when the business has no email colour or the same one; a different one is listed as "colours, main (its email colour)". Test: "keeps an email colour set earlier and lists the file's other one". Face and Body's live account has none, so nothing of hers is affected.

### F-581 [P3] open - Re-applying a setup file puts back a logo, photo or colours the owner removed

**File:** packages/shared/client-setup/apply-business-shape.ts
**Found:** 2026-10-28 by independent review of step 25e.3 (fresh subagent; scope: 9cb8106..a2a528b)
**Why it matters:** The file fills what is missing and cannot tell "never set" from "removed by the owner on Look", as with the currency and prices already. Only matters if a file is applied again after the owner edits her look.
**Suggested fix:** A line in the new-business handover: apply a client's file once; after that her look is hers, on Settings.
**Resolution:**

### F-582 [P3] open - No saved test for a different photo being listed, or a dry run with a look

**File:** packages/shared/client-setup/run-client-setup.test.ts
**Found:** 2026-10-28 by independent review of step 25e.3 (fresh subagent; scope: 9cb8106..a2a528b)
**Why it matters:** The regex checks only the logo and colours; the email-colour case now has its test (F-580), the photo difference does not.
**Suggested fix:** Extend the "different look" test with a service photo already saved.
**Resolution:**

### F-583 [P3] open - A setup file's looks and look ink are applied with no test, and the ink comes from the file's looks rather than the business's saved ones

**File:** packages/shared/client-setup/apply-business-shape.ts:262
**Found:** 2026-10-29 by /audit independent (scope: current 846d93e..246c5da; lens: quality, tests)
**Why it matters:** Step 25f.2 added two rules to `applyBusinessShape`: looks are written only while the business has none, and `mainInkColor` is set from the look whose three colours are worn while none is kept. `run-client-setup.test.ts` covers neither (no test mentions `looks` or `mainInkColor`), against the test gate that a step adding logic adds its tests. And `wornLook` is searched in `shape.look.looks` (the file), not in `organization.looks`: when the business already has looks (so `looksMade` is false) and the file's looks differ, the ink kept can belong to a look the business does not have, which the Look page's save would never keep.
**Suggested fix:** Search `looksMade ? looks : business.looks` for the worn look, and add one `run-client-setup` test: looks added once and left alone on a second apply with other looks, and the worn look's ink set only while none is kept.
**Resolution:**

### F-584 [P3] open - The spec still says no stored data, no migration and no change to the Look page, window, emails or API

**File:** blueprint/context/current-feature.md:5
**Found:** 2026-10-29 by /audit independent (scope: current 846d93e..246c5da; lens: quality)
**Why it matters:** Step 25f.2 added `organization.looks` and `organization.mainInkColor` (migration 0039), changed the Look page, the settings save route, the public theme, the window and every email button. The Size line ("no stored data, no new route"), Out of scope (line 61, "Any change to the Look page, the window, the emails or the API") and Data / contracts (line 112, "No new route, field or migration") still describe 25f.1 only. `/complete` archives this spec as the feature's record, so the archive would contradict the merged code.
**Suggested fix:** Amend those three places to name 25f.2's migration, route change and window/email ink, as the 25f.1 amendment did.
**Resolution:**

### F-585 [P2] open - The spec's `businessAccentStyle` tests were never written, yet Fix.1 is ticked

**File:** frontend/lib/business-accent-style.ts:23
**Found:** 2026-10-29 by /audit independent (scope: current 66fb631..b6c515b; lens: tests, quality)
**Why it matters:** Fix.1 (current-feature.md:48) promises tests for `businessAccentStyle` with and without an ink, and for a light main colour shaded darker keeping its worked-out ink. The diff adds none: the frontend has no test script or runner, so the new rule (`chosenInk` used only while `readableOn` returned the colour unshaded) is proved only by reading it. The logic is correct today (`readableOn` returns its input unchanged when it already reads, and the database keeps both colours lowercase, so `main === chosen` holds), but the ticked box tells the archive a test exists. Neither the gap nor its reason is stated in the spec.
**Suggested fix:** Either move the pure rule into `packages/shared` beside `readableOn` and test it there (no new package), or amend the spec's Fix.1 to say the frontend has no runner yet and the rule is proved by the Done-when check alone.
**Resolution:**

### F-586 [P3] open - Reviving a hidden window keeps the first open's service and opener, not the ones just clicked

**File:** packages/booking-component/booking-provider/booking-provider.tsx:40
**Found:** 2026-10-29 by /audit independent (scope: current 66fb631..b6c515b; lens: quality)
**Why it matters:** An open that finds the window held but not showing only bumps `asked`; `bookingId` and `opener` stay those of the first open. On Face and Body's `/book` the swallowed open is the page's own on-load one (opener: whatever had focus at load, usually `body`), so after a click revives it the provider's own focus return on close goes to `body`, not the clicked button (the browser's own dialog focus restore may cover it). A click on a different named service (a `data-booking` anchor) while a hidden window is held shows the earlier service instead. Only the recovery path is affected; a window that is truly showing is modal, so no click can reach the page.
**Suggested fix:** When an ask finds the window not showing, take the new ask's `bookingId` and `opener` (for example by keying the window on a new open so it remounts), and keep bump-only for a window that is showing.
**Resolution:**

### F-587 [P2] unverified - The recovery skips a dialog that is open but not modal, which matches the symptom the spec describes

**File:** packages/booking-component/booking-window/booking-window.tsx:154
**Found:** 2026-10-29 by /audit independent (scope: current 66fb631..b6c515b; lens: quality, tests)
**Why it matters:** The spec says the window's contents were "in the page but off-screen". A closed `<dialog>` is `display: none` and lays out nowhere; an open dialog that is not modal (not in the top layer) lays out in flow, and with `.sa-dialog`'s full width and height it would sit below the page's content, off-screen. That is the state `!dialog.open` cannot see: `open` is true, so no ask calls `showModal()` and every click is still swallowed. The root cause of the first `showModal()` not reaching the screen was not identified, and the jsdom test stubs only the "never opened" case, so it cannot tell the two apart. If the real state is open-not-modal, the fix does not recover it.
**Suggested fix:** Reproduce on `/book` and inspect `dialog.open` and `dialog.matches(":modal")` while stuck. If it is open but not modal, recover with `if (!dialog.matches(":modal")) { if (dialog.open) dialog.close(); dialog.showModal(); }` (guarding the close so it does not unmount the window through `onClose`), and add that case to the test.
**Resolution:**

### F-588 [P3] open - The spec still says no migration, no new logic and no "both" rule, and gives Primo "email" and a separate question

**File:** blueprint/context/current-feature.md:143
**Found:** 2026-10-29 by /audit independent (scope: current ed46fe3..eb2f0c6; lens: quality)
**Why it matters:** Steps 13.2 and 13.3 added migrations 0040 and 0041, two organization columns, a booking check and their tests, but Data / contracts (line 143) still says "No new route, table or migration", Testing (line 151) "No new logic, so no new unit test", Out of scope (line 68) lists the "both email and phone" rule, and In scope gives Primo `contactRule: "email"` provisionally (line 40) and "one required booking question" (line 28), where his file has `both`, `detailsBox` and no question. Line 146 says his site reads the API address and slug as server layout props; `primo-painters/data/siteConfig.ts:44` reads them from a client constant with a `NEXT_PUBLIC_BOOKING_API_URL` override. `/complete` archives this spec as the feature's record.
**Suggested fix:** Amend those lines to what was built (13.2 and 13.3's migrations and tests, the `both` rule in scope, Primo's `both` and project box, the site's constant), as the step amendments already did for the build steps.
**Resolution:**

### F-589 [P2] open - Open question 5 is still open and Primo's minimum notice is provisional, while 13.4 requires every question answered first

**File:** packages/shared/client-setups/primo-painters.ts:38
**Found:** 2026-10-29 by /audit independent (scope: current ed46fe3..eb2f0c6; lens: quality)
**Why it matters:** Step 13.4 (current-feature.md:120) says "Every open question was answered first" before his file is applied `--live`. Open question 5 (line 183, his holiday list and minimum notice) carries no answer, and the file sets `minimumNoticeMinutes: 12 * 60` as "Provisional (open question 5)", with the closed holidays "to match on open question 5". Applied live as is, a paying client's customers can be offered times Calendly refused (or refused times it offered) the day Calendly is turned off. The two sources also disagree on the range the public read pinned: the file says 4.5 to 23 hours, the spec's In scope 5 to 23.5.
**Suggested fix:** Answer question 5 from his Calendly account before 13.4 (or record Frank's yes to go live on 12 hours), set the value in the file, and make the comment and spec agree.
**Resolution:**

### F-590 [P3] open - The setup file's project box and the owner's exemption from a required box have no test

**File:** packages/shared/client-setup/apply-business-shape.ts:220
**Found:** 2026-10-29 by /audit independent (scope: current ed46fe3..eb2f0c6; lens: tests)
**Why it matters:** Step 13.3 added two rules with no test: `applyBusinessShape` writes `detailsBox` only while the business has no service, and `findDifferences` (run-client-setup.ts:148) lists a saved box that differs from the file's. `run-client-setup.test.ts` covers the same two rules for `contactRule` but never mentions `detailsBox`. Separately, `bookTime` exempts the owner's own booking from a required box (book-time.ts:222, inside `source !== "manual"`), which the spec names ("except the owner's own"), but no test books manually against a business with `detailsRequired` true. The code reads correctly today; nothing would catch a regression.
**Suggested fix:** Extend the existing `contactRule` cases in `run-client-setup.test.ts` with a `detailsBox` (set on a business with no service, listed as a difference on one with a service), and add one manual booking to the dashboard bookings route tests with `detailsRequired` true and no details.
**Resolution:**

### F-593 [P3] open - Smaller 13d.1 review points, carried

**File:** packages/site-chat (several)
**Found:** 2026-10-30 by independent review of 13d.1
**Why it matters:** (1) `chatAnswers.ts:17` "We paint home interiors in Calgary:" is our wording, shown as a stored answer, and lists Garage Painting as interior. (2) `hourly-limit.test.ts:23-30` passes with the sweep deleted. (3) `create-chat-route.test.ts` never covers the retry after an error or the 6 s wait, a failure after words are out, or spoken `speak` events. (4) `chatSite.ts` puts hours in the brief from JSON-LD only while leaving the street address out by "no page shows it": one rule for both. (5) `hourly-limit.ts:27` keys on the first `x-forwarded-for`, safe on Vercel only. (6) `create-chat-route.ts:73-77` routes Jev through the Vercel AI Gateway, billed to the client's Vercel account, when `TYPESAFE_API_KEY` is missing.
**Suggested fix:** As each names; (5) say Vercel only or take a `clientAddress`; (6) require `TYPESAFE_API_KEY` and skip Jev without it.
**Resolution:**

### F-596 [P3] open - 13d.2 review points carried

**File:** packages/site-chat/booking/chat-booking.ts:416, :468
**Found:** 2026-10-30 by independent review of 13d.2
**Why it matters:** (5) after a lost answer and a changed time, "already booked" can name the new time while the first one is what booked; (7) the project-box refusal is not matched in Spanish (hands over to the window); (10) no tests for a 400 worded by the real schema, a not_asked service dropping an earlier address.
**Suggested fix:** keep the sent time after a lost answer; match the backend's default words per language; add the tests.
**Resolution:**

### F-598 [P3] open - 13d.3 review points carried

**File:** face-and-body data/chatSite.ts, data/chatFacts.ts
**Found:** 2026-10-30 by independent review of 13d.3
**Why it matters:** (5) noon reads "12 pm"; (6) the texting fact repeats her FAQ answer, harmless. (7), a length stated for treatments priced at consultation, was fixed in her site the same day.
**Suggested fix:** "noon" in the hours helper if Frank wants it.
**Resolution:**

### F-600 [P3] open - 13d final review points carried

**File:** packages/site-chat/chat/chat-conversation.tsx, chat/answer-tiles.tsx, booking/chat-booking.ts, site-chat.css
**Found:** 2026-10-31 by the final independent review of 13d
**Why it matters:** (3) a Book under an older answer while a booking is open starts a new one and drops the open one without a word; (4) a narrowed service list cannot widen ("actually, deep tissue"); (5) "the first one" at a step that shows cards picks a service not on screen; (6) the opened list has no role or aria-controls, sits in the polite live region (all 22 facials can be read out), and focus stays on the card; (7) her cards no longer link to her group pages; (8) on iPhone the keyboard can still cover the typing box (dvh ignores it); (10) his banner offer "Offer Ends 11/17" has no year, so the chat states it as long as the banner does; (11) no UI tests for the card paths. Also seen in the rerun: laser hair removal sometimes gets "someone can confirm the price" instead of "priced at the free consultation"; "What body treatments do you have?" once listed Massage among them.
**Suggested fix:** each as named; the accessibility points first.
**Resolution:**

### F-601 [P2] open - The answers route caps neither the whole call nor the visitor-written assistant turns

**File:** packages/site-chat/server/create-chat-route.ts:162-184
**Found:** 2026-10-31 by /audit independent (scope: current; lens: security, performance), target a4854f6
**Why it matters:** `/api/chat` takes 20 messages where only the last must be the visitor's, each assistant turn up to 4,000 characters, so one call can carry about 76,500 characters of history the caller wrote, forged "assistant" lines included, into `gpt-5.4-mini` (and four of them into Jev). `fromOurSite` passes any request with no Origin, so a script reaches it directly; only the per-instance 60 an hour and the provider's monthly limit stand behind it. The booking route was capped at 6,000 characters for this same reason (F-594 (3)); the AI's cost on a public page is one of the spec's three named risks.
**Suggested fix:** a total-character cap on the request and a shorter assistant-turn cap, with `recentTurns` dropping the oldest turns to fit, as `withinAskLimits` does for the booking route.
**Resolution:**

### F-602 [P3] open - 13d independent review: smaller points

**File:** .claude/launch.json:19, packages/site-chat/pack-into-site.mjs:55-63, blueprint/context/current-feature.md:24
**Found:** 2026-10-31 by /audit independent (scope: current; lens: quality), target a4854f6
**Why it matters:** (1) the committed `face-and-body-site` launch entry now runs `../face-and-body/.claude/worktrees/booking-crm`, a worktree that goes away once her branch merges; (2) `pack-into-site.mjs` copies the booking window's script, so F-550 (every vendor/ entry read in full, a subfolder crashes it) now lives in two places; (3) the spec still says the visitor's question goes as `details` when the form has no project box, but the chat always shows a box and, since the F-594 repair, never sends the opening question.
**Suggested fix:** (1) point it back at `../face-and-body` after her merge; (2) share the pack decision or fix both; (3) say in the spec that only the project answer is sent.
**Resolution:**
