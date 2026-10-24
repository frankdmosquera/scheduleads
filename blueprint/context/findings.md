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

### F-469 [P2] closed - After "Sign in again" from a dashboard screen, the sign-in page's language switch tries to save to the login that has ended

**File:** frontend/lib/dashboard-words/dashboard-words-provider.tsx:69, 77; frontend/components/language-switch/language-switch.tsx:27; frontend/components/centred-card/refusal-notice.tsx:17; frontend/components/dashboard/dashboard-gate.tsx:60
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..fe03a61; lenses: quality, security, performance, tests)
**Why it matters:** The provider lives in the root layout and counts a login as signed in while `loginLanguage !== undefined`. Only `SignOutLink` calls `forgetLoginLanguage`. When a sign-in ends on its own, a screen shows `RefusalNotice`, whose "Sign in again" is a client-side `Link` to `/sign-in`, so the provider keeps the old login's language and `signedIn: true`. On the sign-in page the switch then calls `PUT /me/language`, gets 401, and says "Your language could not be saved" instead of keeping the pick in the browser, as the spec's "Signed out, it is kept in the browser" requires. The page also shows the ended login's language rather than the sign-in pick or the browser's, and sends that as the code email's `Accept-Language`. The gate's `signed-out` result (after "Try again" or a business pick) has the same gap. A reload clears it. Code-path evidence; not seen in a browser.
**Suggested fix:** Forget the login's language whenever the screen knows the login is gone: call `forgetLoginLanguage()` when the sign-in page mounts (it is only reached signed out) and in the gate's `signed-out` case, or have `DashboardSignedOutScreen` do it before it redirects.
**Resolution:** Fixed 2026-10-24 (12j.1 review fixes): the sign-in page forgets the last login's language when it opens (`frontend/app/sign-in/page.tsx`), and the gate forgets it on a signed-out answer (`dashboard-gate.tsx`). Reproduced first on http://localhost:3400 (session ended in the dev database, Sign in again, English gave PUT /me/language 401 and "No se pudo guardar su idioma"); after the fix the same path switches the page to English, saves `en` in the browser and sends no PUT. Closed 2026-10-24 by /audit independent current (576bdaf..0acd574): re-read `frontend/app/sign-in/page.tsx:18-20` and `frontend/components/dashboard/dashboard-gate.tsx:44`; `forgetLoginLanguage` is a stable `useCallback` in `dashboard-words-provider.tsx:69`, so neither effect loops, and the gate's next `ok` answer sets the login's pick again after a sign-in. The original path is gone and the repair adds no new one.

### F-470 [P3] closed - No saved test carries the sign-in page's Accept-Language through Better Auth to the code email's language

**File:** backend/lib/auth/auth-server.ts:164-166; backend/app-me.test.ts:177-194; backend/lib/auth/send-login-code.test.ts:63-77
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..fe03a61; lenses: quality, security, performance, tests)
**Why it matters:** The tests prove `loginLanguageOf` (pick, else header, else English) and `sendLoginCode` with a stubbed `languageOf`, but the one line that joins them, `ctx?.headers?.get("accept-language")`, is untested. Better Auth 1.7.5 passes the endpoint context as an optional second argument (`ctx?: GenericEndpointContext`); if an upgrade stopped passing it, or the header name drifted, a Spanish login that never picked would get its code in English and every suite would still pass. The step's Done when asks for a check of exactly this hand-off.
**Suggested fix:** One test through `app.request("/api/auth/email-otp/send-verification-otp")` with `Accept-Language: es` for a seeded login with no pick, Resend faked as in `login-code-timing.test.ts`, asserting the faked call's subject is Spanish.
**Resolution:** Fixed 2026-10-24 (12j.1 review fixes): `backend/lib/auth/login-code-timing.test.ts` gains "a login code's language": a throwaway login with no pick asks the real route for a code with `Accept-Language: es-CO,es;q=0.9` and the faked Resend gets "Su código de acceso: NNNNNN"; with no header, "Your sign-in code: NNNNNN". Proved able to fail: with `ctx?.headers?.get("accept-language")` replaced by null it got the English subject and failed. Closed 2026-10-24 by /audit independent current (576bdaf..0acd574): the test (`backend/lib/auth/login-code-timing.test.ts:62-108`) goes through the real Better Auth route, inserts and deletes its own throwaway login, and passed in this pass's `npm run test --workspace=backend` (92 files, 1075 tests). The hand-off is now covered; the repair adds no new risk.

### F-471 [P2] closed - On a Spanish Booking form, the ready-made question sets stay English: "Empezar con el conjunto de painting" fills in English questions

**File:** frontend/lib/dashboard-words/booking-form-words.ts:102; frontend/components/settings/booking-questions-card.tsx:74-75, 131; backend/lib/settings/booking-question-sets.ts:13-27
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..0acd574; lenses: quality, security, performance, tests)
**Why it matters:** The step's contract is no English on a signed-in screen except the business's own words and the API's messages (12j.3). The set names come from the product's own list in `booking-question-sets.ts` ("Painting", "Clinic"), not from the business and not from an API refusal, so a Spanish owner with no questions sees two buttons reading "Empezar con el conjunto de painting" and "Empezar con el conjunto de clinic". Pressing one fills the list with "Interior or exterior?", "How many rooms?" (or the clinic pair), which a Spanish business then saves and shows to its Spanish customers in the booking window. 12j.3 lists refusals, form errors and holiday names; these sets are in neither step.
**Suggested fix:** Name each set in the words by its `trade` key (`presetName: Record<"painting" | "clinic", string>`, "pintura", "clínica") instead of the API's `name`, and give the sets their Spanish questions: either the route answers them in the login's language, or the frontend keeps one question list per language keyed by `trade`. Or record in the spec that the sets stay English until a later step.
**Resolution:** Fixed 2026-10-24 (12j.2 review fixes, Frank's yes): each set in `backend/lib/settings/booking-question-sets.ts` carries its name and questions in English and Spanish; `booking-questions-card.tsx` names the button and fills the questions in the login's language. Seen on http://localhost:3400/settings/booking-form in Spanish: "Empezar con el conjunto de pintura" / "clínica", filling "¿Tiene alergias o alguna afección de la piel?" and "¿Es su primera visita?" (not saved). Settings route tests 45 pass. Closed 2026-10-24 by /audit independent current (576bdaf..6e24d7e): `booking-question-sets.ts` carries both languages and `booking-questions-card.tsx:75, 131` names and fills the sets from them, so a Spanish owner no longer sees "painting" or English questions. Which language the sets should follow is a separate point, F-481.

### F-472 [P3] closed - "Tiempo libre" names a person's time off on the Calendar, while "libre" on the same screen means free to book

**File:** frontend/lib/dashboard-words/schedule-words.ts:124, 138, 150, 165-166, 174, 181; frontend/lib/dashboard-words/services-words.ts:121
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..0acd574; lenses: quality, security, performance, tests)
**Why it matters:** To a Latin American reader "tiempo libre" is leisure, and "libre" reads as available. On the Calendar a block labelled "Tiempo libre" means the person cannot be booked, while the Book by hand lede on the same screen says "Cualquier hora en que esta persona esté libre", meaning bookable. Services uses "Tiempo libre antes" for a third thing, the buffer kept clear. An owner can read a person's blocked afternoon as open time.
**Suggested fix:** Use one unambiguous word for time off, such as "Ausencia" (title, item label, "Guardar ausencia", "La ausencia quedó registrada") or "Tiempo no disponible", and keep "libre" for available.
**Resolution:** Fixed 2026-10-24 (Frank picked "No disponible"): a person's time off is "No disponible" on the Calendar (block, legend, button, its saved lines and the lede); "libre" is left meaning only free to book. A reason for the time off (vacation, appointment) is a later addition. Closed 2026-10-24 by /audit independent current (576bdaf..6e24d7e): `schedule-words.ts:147, 173, 200-201, 209` name a person's time off "No disponible" / "horario no disponible", and the Calendar keeps "libre" for bookable only. The Services buffer still reads "Tiempo libre antes" (`services-words.ts:121-123`) on its own screen, with the hint "Se deja libre, nunca se reserva" saying what it means.

### F-473 [P3] closed - The off state of a person, place or service has several Spanish names across Settings

**File:** frontend/lib/dashboard-words/people-words.ts:115-116; frontend/lib/dashboard-words/settings-frame-words.ts:64; frontend/lib/dashboard-words/services-words.ts:114-115, 135, 139, 146-147
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..0acd574; lenses: quality, security, performance, tests)
**Why it matters:** English uses one pair, On and Off. In Spanish, People shows a person as "No disponible", the same person in a service's ticks reads " (desactivado)" and "Todos los marcados están desactivados", and a service is "Oculto" in its badge but "Apagado lo oculta" in its checkbox. An owner matching a person turned off on People with the one marked in a service sees two different words. " (desactivado)" is also masculine after a place such as "la sala", which `people-words.ts` avoids on purpose ("Gender-free on purpose").
**Suggested fix:** Pick one word per state and use it everywhere: for people and places "Disponible" / "No disponible" (ticks: " (no disponible)", "Todos los marcados no están disponibles"); for services "Activo" / "Oculto" ("Si lo desmarca, se oculta").
**Resolution:** Fixed 2026-10-24: a person or place switched off is "Fuera de servicio" / "En servicio" (People, the Settings suffix, the service form's notes), gender-free and apart from the Calendar's "No disponible"; a service stays "Activo" / "Oculto" and the form's "Apagado" became "Oculto". Closed 2026-10-24 by /audit independent current (576bdaf..6e24d7e): people and places read "En servicio" / "Fuera de servicio" in `people-words.ts:115-116`, `settings-frame-words.ts:64` and `services-words.ts:135, 140`; services read "Activo" / "Oculto" (`services-words.ts:114-115, 147`); no "desactivado" or "Apagado" is left for these states.

### F-474 [P3] accepted - The default lead stages are stored in English, so a Spanish dashboard shows "New", "Contacted", "Booked", "Done"

**File:** packages/shared/crm/default-pipeline-stages.ts:4; backend/lib/crm/seed-pipeline-stages.ts:25; frontend/components/leads/leads-list-screen.tsx:157; frontend/components/leads/lead-page-screen.tsx:139, 218
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..0acd574; lenses: quality, security, performance, tests)
**Why it matters:** Every business gets its stages from `DEFAULT_PIPELINE_STAGES`, written in English, and the leads list, a lead's page and its other requests show `stage.name` as stored. The business never typed them, so they are not "words a business typed itself" under Out of scope, and neither 12j.2 nor 12j.3 names them. A Spanish owner's leads list reads "New" and "Booked" beside Spanish words.
**Suggested fix:** Decide it in the spec: either the stage names are business data (shown as stored, said so under Out of scope), or a Spanish business gets Spanish stages when it is set up (the business's `language` choosing the names in `seed-pipeline-stages.ts`), or the dashboard names the four default stages through the words while their stored names are untouched.
**Resolution:** Accepted 2026-10-24 by Frank ("sure" to moving it): moved to feature 14, where each business names, adds and reorders its own stages and boards, so translating the four defaults now would be undone there.

### F-475 [P3] closed - The sign-in page's email placeholder stays English in Spanish

**File:** frontend/components/sign-in/sign-in-email-step.tsx:71
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..0acd574; lenses: quality, security, performance, tests)
**Why it matters:** The sign-in pages are in scope for Spanish (12j.1), and the Setup card's same kind of placeholder was moved into the words ("usted@sunegocio.com", `setup-cards-words.ts`). The sign-in email box still reads "you@yourbusiness.com" when the page is in Spanish.
**Suggested fix:** Add an `emailPlaceholder` word to `DashboardWordsType` (Spanish, for example "nombre@sunegocio.com") and read it here.
**Resolution:** Fixed 2026-10-24: the sign-in email placeholder is a word, "usted@sunegocio.com" in Spanish, English unchanged. Closed 2026-10-24 by /audit independent current (576bdaf..6e24d7e): `sign-in-email-step.tsx:71` reads `words.emailPlaceholder`, declared in `dashboard-words-type.ts:30` with both languages.

### F-476 [P1] closed - In the Month view, "Today" shows only the current week

**File:** frontend/components/schedule/schedule-screen.tsx:45-49, 293, 206
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** `fetchCalendar` asks for one week whenever `asked.date` is missing (`!asked.date ? [undefined]`), whatever the view. The Today button calls `onAsk({ resourceId })` with no date, so in the Month view it fetches one week; `ScheduleCalendar` then hands those seven days to `ScheduleMonthGrid` as `allDays`, and the month's heading sits over a single row. The calendar picker (line 206) passes the same missing date after Today, so changing person keeps the one-week month, and Book by hand in that view offers only that week's dates (`datesToBook`). Today is the most used button on a calendar.
**Suggested fix:** Make a missing date in the Month view mean today in the business's zone: Today sends `todayInZone(timezone)` as the date (the zone is already on screen), or `fetchCalendar` fetches the current week first and then `weeksOfMonth` of its today, so the Month view always asks for its four to six weeks.
**Resolution:** Fixed 2026-10-24: Today asks for today's date and the person picker for the date on screen, so a Month view always asks for the whole month. Seen on http://localhost:3400/calendar: Month, Next (November, 42 days), Today (October, 35 days), another person (October, 35 days). Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): every `onAsk` in `schedule-screen.tsx` now carries a date (picker line 208 `date: shown`, Today line 295 `date: today` from `todayInZone`, Previous/Next, the view buttons, a month day), so `fetchCalendar` takes the dateless one-week path only for the first read, which is always the Week view. No frontend test runner exists; verified by reading the code.

### F-477 [P2] closed - On Days off in Spanish, a closed holiday goes back to its English name after any save

**File:** backend/routes/settings-routes.ts:522, 579, 598; frontend/components/settings/days-off-screen.tsx:98, 135, 187
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** Only GET `/settings/days-off` names closed holidays through `holidayPackage.nameOn` (lines 485-497). PUT `/settings/days-off`, POST `/close` and POST `/open` return `findDaysOff` as stored, with English names, and the screen merges `...answer.daysOff` over its state. So a Spanish owner who ticks a holiday, closes a day or opens one sees "Navidad" turn into "Christmas Day" until the page is reloaded. The list also keeps its old language after the language switch, since nothing reads it again. The route test checks the GET only.
**Suggested fix:** Name the closed days in one place for all four answers (a helper in the routes, or `findDaysOff` taking the language), have the three save calls send `language` as the GET does, and add one test that a Spanish save answers "Navidad".
**Resolution:** Fixed 2026-10-24 (Frank's yes): PUT /settings/days-off, POST close and POST open take `language` and name their closed holidays with the same `namedIn` as the GET; the client sends the login's language. Days off reads itself again on a language switch (`readsAgainInEachLanguage`) and the list takes the new answer. Test: the save's answer reads Navidad. Seen on the laptop: Navidad, Christmas Day, Navidad across two switches. Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): GET, PUT, POST close and POST open all answer through one `namedIn` (`settings-routes.ts:76-99`), each validates `language` the same way (en when absent, 400 otherwise, before the body), and `save-days-off.ts` sends `dashboardLanguage()` on all three. The re-read runs from a passive effect after the provider's layout effect has set the new language, and `ClosedDaysList` adopts a new answer during render (`days-off-screen.tsx:56-61`), which only fires when SettingsSection holds a new result object. The holiday picker beside it is a separate gap, F-483. Close and open in Spanish have no route test of their own; they share `namedIn` with the tested PUT.

### F-478 [P2] closed - Some dashboard refusals have no Spanish, and the completeness test cannot see them

**File:** backend/routes/settings-routes.ts:604-609; backend/routes/schedule-routes.ts:347-352; backend/lib/email/check-email-sending-key.ts:30-60; backend/lib/email/save-email-sending.ts:61; packages/shared/helpers/spanish-messages.test.ts:28-30, 46-53
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** The spec says the saved test collects every message in the backend's refusals so none ships untranslated. Its `refusalRule` matches only `refuse(code, "literal")` and `messageRule` only `message: "literal"`. Missed, and reachable from Spanish screens: "The business does not work that weekday: set that day's hours on Hours." and "They do not work that weekday: set their hours on Hours." (Days off, opening a day; a ternary inside `refuse`), "A booking in that time has already begun, so time off cannot cover it." and "There are bookings in that time. Choose for each one: move it or cancel it." (Calendar, time off; a ternary), and the email sending card's Resend reasons ("Resend refused this key.", the quota, sender and retry lines, some joined with `+`, and "The saved key can no longer be read. Paste it again."), written as `reason:`. None is in `spanish-messages.ts`, so each shows in English on a Spanish dashboard: never blank, as the contract allows, but the test's promise does not hold.
**Suggested fix:** Add these messages to the table, and widen the test: also read backend `reason:` literals and every sentence literal inside a `refuse(` call (or every sentence literal under `backend/routes` and `backend/lib/email`, logs left out), writing the `+` joined reasons as one literal each.
**Resolution:** Fixed 2026-10-24 (Frank: fix them all, then come back): Spanish for the open-a-day and time-off choices, the six email key reasons, the saved-key line, the six "Check the ... and try again." fallbacks and "That is not a valid question.". The completeness test now also reads a choice inside refuse(), a reason written in pieces (sentences only, never a reason code), a backend fallback after ??, and lib/email. Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): the shared tests pass (214) with `choiceRule`, `piecesRule` and the backend `fallbackRule` reading the ternaries in `settings-routes.ts:640-645` and `schedule-routes.ts:348-353` and the joined reasons in `check-email-sending-key.ts`. A separate probe of every sentence literal under `backend` (logs, thrown errors and comments left out) found none reachable from a dashboard refusal without Spanish; the rest are worker logs, public booking routes or the question sets themselves.

### F-479 [P3] closed - A few Spanish templates read wrong once their value is put in

**File:** packages/shared/helpers/spanish-messages.ts:158-159, 207, 220; backend/routes/schedule-routes.ts:329; backend/lib/text/format-text-time.ts:6-17
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** "Tick each of the {} once." becomes "Marque cada uno de los personas una sola vez." with "people" ("personas" is feminine). "Already off from {} to {}." becomes "Ya no está disponible de Mon Oct 26, 9:00am a Mon Oct 26, 5:00pm.": "Ya no está disponible" reads as "no longer available", and the times come from `formatTextTime`, fixed to `en-US`, so English day and month names sit inside the Spanish. "{} no está en la lista de festivos" puts the English holiday name in, since picks are saved in English.
**Suggested fix:** Two exact keys for people and places ("Marque cada persona una sola vez.", "Marque cada lugar una sola vez."); "Ya hay un horario no disponible de {} a {}."; for the times, let the route send the two moments so the dashboard writes them in its locale, or accept English times there and say so in the spec.
**Resolution:** Fixed 2026-10-24 (Frank: fix them all, then come back): "Cada uno se marca una sola vez."; "Ya hay un horario no disponible de {} a {}: quite primero...", with a text's time inside written in Spanish ("lun 26 oct, 9:00 a. m."), tested. A holiday name inside "{} no está en la lista" stays English: it is a pick the list no longer has, so there is no Spanish to give. Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): `spanishValueOf` (`spanish-messages.ts:356-362`) rewrites only a whole value shaped exactly like `formatTextTime`'s en-US output (`format-text-time.ts:17`, "Mon Oct 26, 9:00am") and leaves any other value as it is; the lazy `(.+?)` splits at the first " to ", which a text time never holds; the test proves the full sentence.

### F-480 [P3] closed - The Month view reads Google busy times four to six times and never shows them

**File:** frontend/components/schedule/schedule-screen.tsx:44-55, 303; frontend/components/schedule/schedule-month-grid.tsx:52; backend/lib/schedule/find-schedule-week.ts:149-185
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** Each Month view asks the week route four to six times in parallel, and each week reads the person's Google busy times (`getBusyTimes`), which the Month grid then filters out (`item.kind !== "google_busy"`). That is up to six Google calls per page turn for nothing shown, and when one fails the Month view still says "No se pudo leer Google para esta semana", about a week it does not name. The Day view also reads its whole week, Google included, on every one-day step. Not measured; the cost is Google's quota and the page's speed.
**Suggested fix:** Let the week route skip Google when asked (a query flag) for the Month view, or hide the Google notice there; later, one month route.
**Resolution:** Fixed 2026-10-24 (Frank: fix them all, then come back): the week route takes google=skip and then reads no busy times (google: "skipped"); the Month view sends it, so its 4 to 6 weeks never ask Google and its notice cannot show. Tested: no Google call, 400 for any other value. Seen on the laptop: every Month request carries google=skip. Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): `google: z.enum(["skip"]).optional()` in the strict week query schema, `readGoogle: query.google !== "skip"` in `schedule-routes.ts:129`, and `find-schedule-week.ts:151-152` skips the connection read and `getBusyTimes` together. The only consumer of `google` (`schedule-screen.tsx:305`, `=== "unreadable"`) is unaffected by the new "skipped" value; the backend test proves no Google call and a 400 for another value.

### F-481 [P3] fixed - The ready-made booking questions follow the login's language, not the language the business's customers book in

**File:** frontend/components/settings/booking-questions-card.tsx:75, 131; backend/lib/settings/find-booking-form.ts:17
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** The questions are shown to customers in the booking window, in the business's own language (12i, `language` on the same Booking form settings). The card fills them in `useDashboardWords().language`, so a Spanish-reading member of an English business fills Spanish questions for English customers, and the reverse. The spec keeps the login's language and the business's language apart on purpose.
**Suggested fix:** Fill the questions in `settings.language` (the business's) and keep only the button's set name in the login's language; or let Frank decide and record it in the spec.
**Resolution:** Fixed 2026-10-24 (Frank: fix them all, then come back): the ready-made questions fill in the business's language (the Booking form's setting, what its customers read); the buttons' names stay in the reader's language. Reopened 2026-10-24 by /audit independent current (576bdaf..1811dcc): the repair reads `settings.language` (`booking-questions-card.tsx:76`), the business's language as it was when the page was read. The business's language is changed on the same page by `BookingFormRulesCard`, which keeps the saved value only in its own state (`booking-form-rules-card.tsx:26, 43`), so an owner setting up a business who switches it from English to Spanish, saves, and then presses a ready-made set still gets the English questions until the page is reloaded. Suggested fix: keep the business's language in one place both cards read (lift it into `BookingFormScreen`, or have the rules card hand the saved language up), so the questions follow a save at once. Fixed again 2026-10-24: the Booking form page keeps the business's language as last saved (BookingFormCards); the rules card reports a saved language and the questions card fills the ready-made set in it. Seen on the laptop: reading English, business saved as Spanish, the clinic set filled "¿Tiene alergias o alguna afección de la piel?" with no reload.

### F-482 [P3] closed - The comment for the first-issue refusal now sits above the holiday language helper

**File:** backend/routes/settings-routes.ts:67-76
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** `holidayLanguageOf` was put between "The first problem, with where it is..." and `refuseFirstIssue`, so the comment now describes the wrong function, against the project's rule that a comment sits beside the line it explains.
**Suggested fix:** Move line 67 down, directly above `refuseFirstIssue`.
**Resolution:** Fixed 2026-10-24 (Frank: fix them all, then come back): the comment is back above refuseFirstIssue. Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): `settings-routes.ts:101` sits directly above `refuseFirstIssue`, and each of `holidayLanguageOf` and `namedIn` has its own comment above it.

### F-483 [P3] fixed - After a language switch, the Days off holiday picker keeps its countries and holiday names in the old language

**File:** frontend/components/settings/holiday-picker.tsx:72-82, 84-114; frontend/components/settings/days-off-screen.tsx:193
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..1811dcc; lenses: quality, security, performance, tests)
**Why it matters:** The spec says the switch changes the screen without a reload, and F-477's repair makes the closed days list read itself again in the new language. The picker beside it reads its countries and its holiday labels with `dashboardLanguage()` (`fetch-holiday-choices.ts:18`), but its two effects depend only on `[attempt]` and `[country, region, attempt]`, and `HolidayPicker` is not keyed, so after English to Español the list above says "Navidad" while the picker's tick list still says "Christmas Day" and the country names stay English, until the owner changes country or province or reloads.
**Suggested fix:** Add the dashboard `language` from `useDashboardWords()` to both effects' dependencies (the picks are English names, so they stay valid), or key the picker by language in `ClosedDaysList`.
**Resolution:** Fixed again 2026-10-24: the holiday picker is keyed by the login's language, so a switch reads its countries and holidays again. Seen: Navidad and Canadá became Christmas Day and Canada on the switch.
