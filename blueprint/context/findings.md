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

### F-364 [P3] closed - Code comments added by this feature cite step numbers, which the standards keep out of code

**File:** backend/lib/bookable-hours/apply-outside-hours-rules.ts:3; backend/lib/booking/book-time.ts:329; backend/lib/email/find-booking-email-context.ts:35; backend/lib/email/find-booking-email-recipients.ts:3; backend/lib/email/send-booking-emails.ts:3; backend/lib/settings/resource-settings-of.ts:10; frontend/components/settings/change-resource-form.tsx:3; packages/shared/client-setup/run-client-setup.test.ts:257, 288
**Found:** 2026-10-10 by the independent review of feature 12d (scope: current, e1a5d8f..9417aa7; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md (Comments) says "No history in code comments (step numbers, finding numbers ...): that lives in the build log." F-363 removed the finding numbers, but this feature also adds nine comments tagged with a step number, `(12d.1)`, `(12d.2)`, `(12d.4)` or `(12d.5)`, for example "the booked person's, read when the email goes (12d.4)". The base has none (searched at e1a5d8f). A step is build history: once merged, `12d.4` means something only to someone who opens the build log, and each sentence already says what the code does without it. The older `(feature N)` and `(decision N)` tags are an established pattern in the base and are not part of this. Naming only, no behaviour.
**Suggested fix:** Drop the `(12d.N)` tags from the nine comments, keeping each sentence (in find-booking-email-recipients.ts:3 keep "which replaces feature 6's decision 11 for a person who has one"; in send-booking-emails.ts:3 also rewrap the line, which runs past 100 characters).
**Resolution:** fixed in step 12e.1: the nine comments keep their sentences without the (12d.N) tags; send-booking-emails.ts rewrapped. Closed 2026-10-10 by independent review of step 12e.1: all nine places read at 080673f, each sentence kept and untagged; `git grep -E "12[a-z]\.[0-9]"` over backend, frontend and packages finds no step tag left; send-booking-emails.ts:3-4 rewrapped, no behaviour touched.

### F-365 [P3] closed - A closed date opened by the business's one-off hours on Hours cannot be closed again from Days off

**File:** frontend/components/settings/close-day-form.tsx:41; backend/lib/settings/save-days-off.ts:48
**Found:** 2026-10-10 by independent review of step 12e.1 (scope: c40fa2d..080673f; lenses: quality, security, performance, tests)
**Why it matters:** The Hours page still saves the business's one-off dates freely, so a date can be in `closedDates` and also have a business one-off date. The page then shows it "Open for everyone" with no Open again button, and the close form's own check lets it through (`!day.openedForEveryone`). The form sends `[...daysOff.closedDates, date]`, which repeats the date, so the save is refused with "The same closed date is listed twice." under Date. Even with the repeat removed, the server's `added` only counts dates not already in `closedDates`, so the one-off would stay and the day would stay open. The owner has no way to close that day from Days off, and the message does not say why.
**Suggested fix:** Send the list without repeats (a `Set`) from the form, and on the server count a submitted date as newly closed when it was not closed for the business before (not in `closedFor(before, null)`), so its business one-off is dropped as for any other close.
**Resolution:** fixed in the 12e.1 review fixes: closing goes through POST /settings/days-off/close, which adds the date once and always takes back the business's one-off hours on it (applyClosingRules); the PUT writes only the four columns again. Route test, and a hand check on Summit (Oct 30 with its own hours showed Open for everyone, then Closed). Closed 2026-10-10 by independent review of step 12e.2: read at 1812c4a, close-day-form.tsx now posts only `{ date }` to POST /settings/days-off/close, and `applyClosingRules` (apply-opening-rules.ts:92) adds the date once (a Set) and drops the business's one-off on it while people's stay; the PUT keeps `before.dateHours`, which is right for the holiday picker it now serves. The unit case and the route test (settings-routes.test.ts, Monday shown open for everyone, then closed with Tuesday's hours kept) prove it; backend suite 955/955.

### F-366 [P3] closed - Opening a plain closed date for everyone needs the business's own hours that weekday, and the refusal says nobody works it

**File:** backend/lib/bookable-hours/apply-opening-rules.ts:71; backend/routes/settings-routes.ts:349
**Found:** 2026-10-10 by independent review of step 12e.1 (scope: c40fa2d..080673f; lenses: quality, security, performance, tests)
**Why it matters:** For everyone, `applyOpeningRules` checks the business's week before it knows whether anything needs windows. A date the business closed only leaves `closedDates`, which needs no hours; only a holiday that stays picked needs the business one-off. So a Sunday closed by mistake, at a business whose week has no Sunday but where a person on their own week works Sundays, can never be opened for everyone, and the 409 tells the owner "Nobody works that weekday here", which is false for that person. The workaround (open it for each such person) works, so this is a wording and reach issue, not a booking fault.
**Suggested fix:** For everyone, refuse with `no_usual_hours` only when the date is still closed after leaving `closedDates` (the holiday case that needs a business one-off). Or, if decision 5 is meant literally for everyone, keep the rule and change the message to "The business does not work that weekday: set that day's hours on Hours, or open it for one person."
**Resolution:** fixed in the 12e.1 review fixes: decision 5 stands (for everyone, the business's week decides), and the message now says "The business does not work that weekday: set that day's hours on Hours." Closed 2026-10-10 by independent review of step 12e.2: settings-routes.ts:374 says "The business does not work that weekday: set that day's hours on Hours.", true under decision 5; the person's message is unchanged. The spec's Errors line still quotes the old text: F-374.

### F-367 [P3] closed - The Open again form takes no focus when it opens, so the keyboard falls to the page

**File:** frontend/components/settings/days-off-screen.tsx:124; frontend/components/settings/open-day-form.tsx:37
**Found:** 2026-10-10 by independent review of step 12e.1 (scope: c40fa2d..080673f; lenses: quality, security, performance, tests)
**Why it matters:** Pressing "Open again" replaces that day's row content with the form, so the button that had the focus is unmounted and the focus goes to the document body; the next Tab starts from the top of the page. The close form already moves the focus into itself on open (close-day-form.tsx, `dateRef.current?.focus()`), and 12a's pattern returns the keyboard to where the owner was. Keyboard and screen-reader users lose their place on every opening.
**Suggested fix:** On mount, focus the form's radio group (it already has `tabIndex={-1}`) or its heading, as CloseDayForm focuses its date field.
**Resolution:** fixed in the 12e.1 review fixes: the open form focuses its radio group when it opens (checked on Summit: the active element is the radiogroup). Closed 2026-10-10 by independent review of step 12e.2: open-day-form.tsx:39 focuses the `[role=radiogroup]` on mount, and choice-field.tsx:23-24 renders that group with `tabIndex={-1}`, so it takes the focus; no new effect dependencies or loops.

### F-368 [P3] closed - No test proves the year window the step amended in, so a day closed beyond the booking horizon can drop off again unnoticed

**File:** backend/lib/bookable-hours/apply-opening-rules.test.ts:21; backend/lib/bookable-hours/apply-newly-closed-rules.test.ts:15
**Found:** 2026-10-10 by independent review of step 12e.1 (scope: c40fa2d..080673f; lenses: quality, security, performance, tests)
**Why it matters:** The contract was amended in 12e.1 because the horizon hid a day closed beyond it: `listClosedDays`, `applyOpeningRules` and `applyNewlyClosedRules` all widen the window to `DAYS_OFF_AHEAD` (365). Every fixture date in the unit and route tests lies inside the 60-day horizon, so replacing `DAYS_OFF_AHEAD` with `business.horizonDays` in any of the three still passes every test. That rule would hurt if broken: a closed day past the horizon vanishes from the page, cannot be opened (`not_closed`), and its bookings are not listed when it is closed.
**Suggested fix:** One unit case with a date past `horizonDays` (for example 2027-01-04 with horizon 60): `listClosedDays` lists it, `applyOpeningRules` opens it, and `applyNewlyClosedRules` lists a booking on it.
**Resolution:** fixed in the 12e.1 review fixes: a unit test closes Christmas Eve past a 60-day horizon: listed, opened, its booking listed; it fails with DAYS_OFF_AHEAD set to 60 and passes at 365. Closed 2026-10-10 by independent review of step 12e.2: the new case in apply-opening-rules.test.ts uses 2026-12-24, past the fixture's 60-day horizon (ends December 9) and inside 365; `listClosedDays`, `applyOpeningRules` and `applyNewlyClosedRules` each read `DAYS_OFF_AHEAD`, and replacing it with the horizon in any one of the three fails its assertion (not listed, `not_closed`, or the booking not listed).

### F-369 [P3] closed - Close a day accepts a date beyond the year the list shows, so the closed day is not shown and a second try is refused as a repeat

**File:** frontend/components/settings/close-day-form.tsx:90
**Found:** 2026-10-10 by independent review of step 12e.1 (scope: c40fa2d..080673f; lenses: quality, security, performance, tests)
**Why it matters:** The date field has `min={today}` but no upper bound, and its check only looks at `closedDays`, which stops a year ahead. Closing a date more than 365 days out says "Closed ..." but the day never appears in the list; closing it again is refused with "The same closed date is listed twice." It does no harm to bookings (the horizon is at most 365 days), but the owner cannot see or undo what they just did.
**Suggested fix:** Add `max` (today plus 365, the page's year) to the field and the same bound to its `validate`, with "Pick a date within the coming year."
**Resolution:** fixed in the 12e.1 review fixes: the date field has max today plus 365, and the check says "Pick a date within a year." Closed 2026-10-10 by independent review of step 12e.2: close-day-form.tsx sets `max={lastDay}` (today plus 365 on the business's clock) and the validate refuses a later date; `closedDaysBetween` includes its last date, so the furthest date the field allows is listed.

### F-370 [P2] closed - The owner's cancel sends the customer "Thanks for letting us know", for a cancel they did not make

**File:** backend/emails/booking-cancelled.tsx:62; backend/lib/booking/cancel-booking.ts:114
**Found:** 2026-10-10 by independent review of step 12e.2 (scope: 080673f..1812c4a; lenses: quality, security, performance, tests)
**Why it matters:** The owner's cancel queues the customer's own `booking_cancellation` email unchanged, and its first line is "Thanks for letting us know, Maria." When the business cancels because it closed the day, Maria told nobody anything: she gets an email thanking her for a cancellation she did not make, with no word that the business cancelled it. That reads as a mistake (or as someone else cancelling for her) and invites a confused call. The page even says so to the owner (closed-day-bookings.tsx:104, "each customer is told as if they had cancelled"). The spec says "the customer's email" unchanged, but decision 6 only covers the business notification; the customer-facing wording for an owner's cancel was never decided.
**Suggested fix:** Carry who cancelled into the email (for example read the cancel's timeline entry's `actorUserId`, which sendCancellationEmails already queries for its stamp, or a flag in the job payload) and render "{business} has cancelled your booking" without the thanks for an owner's cancel; or raise it with Frank as a spec amendment if the current wording is meant.
**Resolution:** fixed in the 12e.2 review fixes, wording agreed by Frank 2026-10-11: sendCancellationEmails reads the cancel's timeline login with its stamp, and `renderBookingCancelled(facts, byBusiness)` opens "{business} had to cancel your booking." when there is one; the customer's own cancel keeps "Thanks for letting us know". Tests: booking-emails.test.ts "thanks the customer who cancelled, and says so when the business cancelled"; send-cancellation-emails.test.ts "the customer's cancel thanks Jane; the owner's says the business cancelled". Spec amended. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): booking-cancelled.tsx:73 opens "{business} had to cancel your booking." only when send-cancellation-emails.ts:62 finds a login on the cancel's timeline entry, which only the owner's form records (cancel-booking.ts:108); the customer's own cancel keeps the thanks. Both named tests pass.

### F-371 [P2] closed - The confirmation promises the customer an email, but a phone-only customer is told nothing

**File:** frontend/components/settings/closed-day-bookings.tsx:109, 143; backend/lib/settings/listed-booking.ts:6
**Found:** 2026-10-10 by independent review of step 12e.2 (scope: 080673f..1812c4a; lenses: quality, security, performance, tests)
**Why it matters:** Each question says "Maria gets the cancellation email." A booking can be phone-only (send-cancellation-emails.ts:56 sends the customer's email only when there is one; its test "a phone-only booking's cancel sends only the business's"), and the owner's cancel queues only that email, so a phone-only customer hears nothing at all, while the owner was just told they would and has no reason to call. The customer then turns up on a closed day. `ListedBookingType` carries no contact detail, so the page cannot tell.
**Suggested fix:** Add whether the customer has an email to the listed row (a boolean, or the phone for the no-email case) and word the question per booking ("Maria has no email: call her at ..."), and in Cancel all name how many will not be told.
**Resolution:** fixed in the 12e.2 review fixes: listed rows carry `customerHasEmail`; each question says "{name} left no email, so is not told: call them from their lead." and Cancel all names how many are not told. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): listed-booking.ts:23 sets `customerHasEmail` from the contact's email without sending the address; closed-day-bookings.tsx:76-80 words each question by it and Cancel all names how many are not told (123-126).

### F-372 [P3] closed - A refused cancel closes the question and drops the keyboard to the page

**File:** frontend/components/settings/closed-day-bookings.tsx:42-45, 65
**Found:** 2026-10-10 by independent review of step 12e.2 (scope: 080673f..1812c4a; lenses: quality, security, performance, tests)
**Why it matters:** `cancel` calls `setAsking(null)` before checking the answer, which unmounts the question and its focused button; the heading is focused only on success (line 65), so after a refusal (the API down, a 404, a 500 midway through a list) the focus falls to the document body while the error is announced. Same class as F-367.
**Suggested fix:** Focus the heading in both paths (move `document.getElementById(HEADING_ID)?.focus()` above the early return).
**Resolution:** fixed in the 12e.2 review fixes: the list heading takes the focus on both paths. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): closed-day-bookings.tsx:54 focuses the list heading after every press, before the answer is read, so a refusal no longer drops the keyboard to the page.

### F-373 [P3] closed - Cancel all on more than 100 listed bookings is refused with no way to cancel all

**File:** frontend/components/settings/closed-day-bookings.tsx:111; packages/shared/zod-validation/booking-links-validation-schemas/cancel-bookings-validation-schema.ts:16
**Found:** 2026-10-10 by independent review of step 12e.2 (scope: 080673f..1812c4a; lenses: quality, security, performance, tests)
**Why it matters:** The server caps a request at 100 ids, but Cancel all sends every listed id and the list is not capped (`newlyClosed` lists every confirmed booking left on the closed days). Over 100, the press answers "Cancel at most 100 bookings at once." and nothing is cancelled, leaving one-by-one cancels. Rare for one day; likelier if 12e.3's holiday save feeds the same list across many dates.
**Suggested fix:** Send Cancel all in chunks of 100 and merge the answers, or hide Cancel all above 100 with a line saying so.
**Resolution:** fixed in the 12e.2 review fixes: Cancel all sends the ids in parts of 100 and merges the answers. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): closed-day-bookings.tsx:43-51 sends Cancel all in parts of 100, merges the three lists and stops at the first refusal, reporting what was cancelled before it.

### F-374 [P3] closed - The spec's Errors line still quotes the old no_usual_hours message

**File:** blueprint/context/current-feature.md:190
**Found:** 2026-10-10 by independent review of step 12e.2 (scope: 080673f..1812c4a; lenses: quality, security, performance, tests)
**Why it matters:** F-366's repair changed the business's refusal to "The business does not work that weekday: set that day's hours on Hours." (settings-routes.ts:374), but the spec's Errors contract still says "Nobody works that weekday here: set that day's hours on Hours." The spec is the contract later steps and `/complete` read; the two now disagree.
**Suggested fix:** Update the Errors line to the current message.
**Resolution:** fixed in the 12e.2 review fixes: the spec's Errors line quotes the current message. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): the spec's Errors line quotes "The business does not work that weekday: set that day's hours on Hours.", the message settings-routes.ts:408 answers.

### F-375 [P1] closed - A US holiday that skips the coming year (a substitute day, Election Day) is treated as renamed: shown as gone, refused on save, and logged

**File:** backend/lib/settings/refuse-holiday-picks.ts:22; backend/lib/bookable-hours/unknown-holiday-picks.ts:14; frontend/components/settings/holiday-picker.tsx:112; backend/lib/bookable-hours/holiday-choices.ts:20
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** "Known" is decided by whether a name falls in a date window, not by whether the package has it. In the United States the package names observed days as their own holidays, typed public: "Independence Day (substitute day)" (2026-07-03, 2027-07-05, then not again until 2032), "Juneteenth (substitute day)" (2027-06-18), "Christmas Day (substitute day)" and "New Year's Day (substitute day)" (2027-12-24, 2027-12-31), and "Election Day" only in election years. Reproduced with the step's built code: on 2026-10-11, `holidayChoices("US", "TX", ...)` lists both 2027 substitutes as main, so "Close all main holidays" ticks them; on 2027-07-06 the picker's list (today to a year ahead) no longer has them, so the page says "No longer in the holiday list. Picked before, these close nothing now. Untick them to save.", every holiday save is refused with "... is not in the holiday list: untick it." until the owner unticks them, and `unknownHolidayPicks` (today to the end of next year, a third window) logs them as unknown on every booking-window read. All three statements are false: the package still knows them and they return. Once unticked, the 2032 observed Independence Day is no longer closed. This is not the renamed-pick case Frank decided on 2026-10-11; it marks a valid pick as renamed for one of the three offered countries. Canada and Colombia showed no such names in 2026 to 2030.
**Suggested fix:** Use one definition of "the package knows this name" for the picker's gone list, the save's check and the log, independent of the one-year display window: for example the names the package lists for that country and province over a span long enough to cover the weekday cycle (today to seven or eight years ahead), computed once and cached. Optionally fold a "(substitute day)" entry into its holiday's dates so ticking "Independence Day" also closes the observed day; that is a product call for Frank. Add a test with a US substitute pick checked a year later.
**Resolution:** fixed in the 12e.3 review fixes, agreed by Frank 2026-10-11: one check for the page, the save and the booking window's log, `unknownHolidayPicks`, which asks whether the holiday list has the name in any year from this one to ten years ahead (`holidayPackage.namesFrom`); a pick that only skips the coming year is kept and shown under "Picked, not in the coming year"; the Days off read answers `unknownHolidays` and the page marks only those. Test: unknown-holiday-picks.test.ts "a holiday that skips the coming year is kept; only a renamed one is gone" (fails with a one-year lookup); the route test checks the read names a renamed pick. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): the page (find-days-off.ts:75, read by holiday-picker.tsx:143), the save (refuse-holiday-picks.ts:24) and the booking window's log (resolve-bookable-hours.ts) all use `unknownHolidayPicks`, which looks a name up over this year to ten years ahead (holiday-package.ts:98). Checked against the built code: on 2027-07-06 `unknownHolidayPicks("US", "TX", ["Independence Day (substitute day)", "Bogus"])` answers only "Bogus". The repair adds no new defect; the named test passes.

### F-376 [P2] closed - The holiday save sends the page's closed dates, so a day closed elsewhere since the page loaded is silently opened again

**File:** frontend/components/settings/holiday-picker.tsx:124; backend/lib/settings/save-days-off.ts:17
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** The picker is now the PUT's only caller (the spec moved "+ Close a day" to `POST /days-off/close` in F-365), and it sends `closedDates: daysOff.closedDates` from the page's state, which the server writes as is. Two people with `organization: ["update"]` (the owner and an admin), or one owner in two tabs: one closes Monday, the other, on a page loaded before that, saves the holidays; Monday leaves `closedDates` with no message to either, and customers can book a day the business closed. `POST /days-off/close` already avoids the mirror case by keeping the saved picks (close-day.ts:17).
**Suggested fix:** Have the holiday save write only the three holiday columns and keep the saved `closedDates` (a holidays-only body, or the server keeping `before.closedDates` for this save, as close-day keeps the picks); amend the PUT's contract in the spec to match.
**Resolution:** fixed in the 12e.3 review fixes, agreed by Frank 2026-10-11: the PUT takes only `{ holidayCountry, holidayRegion, closedHolidays }` (`holidayPicksValidationSchema`, strict, so a body with closed dates is refused) and `saveHolidayPicks` keeps the saved closed dates and hours; the picker sends the holidays alone. Test renamed "a holiday save writes only the three holiday columns and keeps the closed days and the hours" (fails when the save empties the closed dates). Spec's PUT contract amended. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): the PUT validates `holidayPicksValidationSchema` (strict, settings-routes.ts:315), save-holiday-picks.ts:16 writes the saved closed dates and hours back unchanged, and the picker sends the three holiday fields only. The renamed route test passes.

### F-377 [P2] closed - Every booking-window read recomputes up to two years of holidays per person and logs a stale pick once per person

**File:** backend/lib/bookable-hours/resolve-bookable-hours.ts:37-46; backend/lib/bookable-hours/holiday-package.ts:60; backend/lib/scheduling/find-free-times.ts:132
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** `resolveBookableHours` now runs `unknownHolidayPicks` on every call, which asks the package for every holiday of the province and the country from today to the end of next year (two lists, two years), synchronously. Measured locally against the built code: about 7 ms per call for Alberta's nine picks (and for six US-CA picks), on top of about 2.5 ms for the 60-day `closedHolidays` the rules already run. `findFreeTimes` resolves once for the business and once per person (line 132), so Riverbend's six people cost about 50 ms more blocking CPU per free-times read, and booking and moving resolve again. `getHolidays(year)` is not cached, though a year's holidays never change while the process runs. The warning also fires per resolve, so one booking-window read with a stale pick logs one line per person, not "once per read" as its comment says. Not profiled in production.
**Suggested fix:** Cache `getHolidays` per country, province and year in `holiday-package.ts` (bounded by the package's own places), and check unknown picks once per request or only in the Days off read, logging once per business per read.
**Resolution:** fixed in the 12e.3 review fixes, with F-375: each list's year of holidays and each ten-year name set is worked out once per server run and kept (holiday-package.ts); measured locally, the first read about 55 ms, every later one about 0.1 ms. The log line's comment now says it prints once per person asked about. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): holiday-package.ts keeps each year's list and each ten-year name set per place for the server run, keys bounded by the package's places (a client-supplied place is checked against the offered list before any lookup). Measured against the built code: first `unknownHolidayPicks` call about 33 ms, later calls about 0.001 ms. The once-per-person log line is now what its comment says.

### F-378 [P2] closed - A saved country or province the list does not offer leaves the picker with no way to change it

**File:** frontend/components/settings/holiday-picker.tsx:67-76, 200-212; backend/lib/settings/find-holiday-choices.ts:33-37
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** The countries list is only set from a successful read, and the only read on load is for the saved country and province. If those are refused (400 on `holidayCountry` or `holidayRegion`), `countries` stays empty: the Country select has only "No holidays", which it shows while its value is still the saved code, so choosing it fires no change; the province select and the list never render; Save is refused on a field whose control is not on the page, so the focus lands nowhere. Reachable today: a client setup file is checked only by the schema (any two-letter country, any 1-3 character province, availability-rule-validation-schema.ts:39-48), and a package update that drops a province is the same F-32 class decision 8 covers for holiday names, where the agreed answer is "shown on the page to untick", not a stuck form.
**Suggested fix:** Answer `countries` even when the country or province is refused (or read them separately), and show an unknown saved code as its own option ("CA-ZZ, no longer in the list") so the owner can pick another or "No holidays".
**Resolution:** fixed in the 12e.3 review fixes, agreed by Frank 2026-10-11: the picker reads the three countries on their own when it opens; a saved country the list does not offer shows as "MX, no longer offered" with "Pick a country from the list." under it, and a saved province as "ZZ, no longer in the list" with the country's own list read to pick another from; the province picker shows whenever a province is saved. The saved "no longer in the holiday list" marks hold only while the saved country and province are still picked. Checked by hand on Summit with MX and with CA-ZZ, each changed back to Canada and Alberta from the page; the frontend has no test runner. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): holiday-picker.tsx:68-78 reads the countries on their own, a saved country not offered shows as its own option (252-254) and a saved province likewise (275-277) with the country's list read in its place (86-88), so "No holidays" or another country can be picked and saved. Checked by reading; the frontend has no test runner.

### F-379 [P3] fixed - A national holiday the province demotes or moves still counts as main, and can be listed twice or with two dates

**File:** backend/lib/bookable-hours/holiday-choices.ts:24
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** `main ||=` takes the country's type over the province's. With the step's code: US-CO "Columbus Day" is an observance in Colorado but main (the national type); US-GA "Washington's Birthday" carries 2026-12-24 (Georgia's date) and 2027-02-15 (the national one), so ticking it closes both; US-AL lists "Martin Luther King Jr. Day" and "Robert E. Lee/Martin Luther King Birthday" as two main holidays on 2027-01-18. "Close all main holidays" therefore closes days the state does not treat as public. Canada is barely affected (only the observance National Day for Truth and Reconciliation, and Newfoundland's Canada Day). Merging both lists is the spec's design; which list decides "main" was not stated.
**Suggested fix:** When a province is picked, take `main` from the province's own entry when it has one; raise the national-only and two-date cases with Frank as a spec note rather than change the merge silently.
**Resolution:** fixed in the 12e.3 review fixes, decided by Frank 2026-10-11: with a province, the package's province list (which already carries the national holidays it keeps) decides each holiday it names, its type and date; the country's list adds only names the province lacks (holiday-package.ts `holidaysOfPlace`). Colorado's Columbus Day is listed, not main; Georgia's Washington's Birthday is December 24 only. Test: holiday-choices.test.ts "a state's own list decides a holiday it has; the country's fills in the rest" (fails with the old merge). Spec amended. Reopened 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): the original defect is still there. The package's province list already carries every national holiday the province keeps and leaves out or renames the ones it does not, so "the country's list adds only names the province lacks" (holiday-package.ts:62-63) adds back exactly the national holidays the state dropped or renamed, typed public. Checked against the built code for 2026-10-11 to 2027-10-11: US-AL still lists "Martin Luther King Jr. Day" and "Robert E. Lee/Martin Luther King Birthday" as two main holidays on 2027-01-18, the very example above; US-CA lists Columbus Day as main though California's list leaves it out, so "Close all main holidays" closes October 12 there (also DE, FL, HI, NC, NV); about thirty states list "Washington's Birthday" as a second main holiday beside their own name for that day; CA-NL lists Canada Day and Memorial Day as two main holidays on July 1. Alberta (the current tenants' province) and Quebec are unaffected. The Colorado and Georgia cases are fixed. Suggested fix: with a province, use the province's list alone, which is what the resolution's own premise describes; that changes the rule written in the spec and the holiday-choices.test.ts line that expects Georgia's re-added "Christmas Eve", so it is Frank's call. Fixed again at the final review, decided by Frank 2026-10-11: only statutory holidays are used anywhere (the package's public ones, holiday-package.ts), and with a province its own list stands alone, with no national fill-in. Colorado and California no longer list Columbus Day, Alabama lists one holiday on January 18, Newfoundland one on July 1; Alberta lists exactly its nine. Tests: holiday-choices.test.ts "Alberta's year: its nine statutory holidays..." and "a picked state's own list decides..." (each fails with its rule broken); apply-bookable-hours-rules.test.ts "a day that is not statutory where the business is closes nothing, even picked". The Riverbend seed no longer picks Truth and Reconciliation Day. Spec amended.

### F-380 [P3] closed - No test for the unknown-pick log, or for a holiday save listing the bookings it closes

**File:** backend/lib/bookable-hours/unknown-holiday-picks.ts:6; backend/routes/settings-routes.test.ts:1128
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** `unknownHolidayPicks` has its own logic (a window to the end of next year, every name unknown without a country, nothing for an unknown province) and decision 8's one log line rests on it, but no test calls it or `resolveBookableHours` with a stale pick. The step's story ends "Thanksgiving's booking is listed", yet no test saves a holiday pick over a booking and checks `newlyClosed`; the 12e.1 tests list bookings for closed dates only. A regression in either would pass the suite.
**Suggested fix:** A unit test for `unknownHolidayPicks` (a known, a stale and a not-this-year pick, per F-375), and a route test that picks Thanksgiving over a booking on that day and expects it in `newlyClosed`.
**Resolution:** fixed in the 12e.3 review fixes, as a gap in the agreed tests: unknown-holiday-picks.test.ts covers the check behind the log line, the save and the page (with F-375), and settings-routes.test.ts "a holiday save lists the bookings left on the holidays it closes" books Robin on the next Remembrance Day and sees the save list it (fails when the save drops the picks). Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): unknown-holiday-picks.test.ts tests the one check behind the log, the save and the page (a renamed pick, a substitute day, no country, an unknown province), and settings-routes.test.ts "a holiday save lists the bookings left on the holidays it closes" saves Remembrance Day over Robin's booking and expects her in `newlyClosed`. Both pass.

### F-381 [P3] closed - A failed holiday list read is shown but not announced, and is never retried

**File:** frontend/components/settings/holiday-picker.tsx:238, 66-85
**Found:** 2026-10-11 by independent review of step 12e.3 (scope: 5e81b07..ca5748d; lenses: quality, security, performance, tests)
**Why it matters:** `loadError` is a plain paragraph, so a screen reader user who picks a country while the API is down hears nothing and finds no list; the Settings pattern announces failures (SaveNotice's alert). The read reruns only when the country or province changes, so the owner must switch away and back to try again.
**Suggested fix:** Render the read failure with `role="alert"` (or through SaveNotice), and offer a "Try again" that reruns the read.
**Resolution:** fixed in the 12e.3 review fixes, as the spec's announced-failure rule: a failed read is shown in a `role="alert"` region with a "Try again" button that reads the lists once more. The frontend has no test runner; checked by reading and by the page loading normally. Closed 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests): holiday-picker.tsx:289-304 shows a failed read in a `role="alert"` region with "Try again", which bumps `attempt` so both reads (68-78 and 80-110) run again. Checked by reading; the frontend has no test runner.

### F-382 [P3] fixed - The days off schema the PUT no longer takes is kept, only for its type

**File:** packages/shared/zod-validation/availability-validation-schemas/availability-rule-validation-schema.ts:100-105, 130-131
**Found:** 2026-10-11 by the independent review of feature 12e (scope: current, c40fa2d..bc8eb79; lenses: quality, security, performance, tests)
**Why it matters:** Since the holiday save takes only the three holiday fields, `daysOffValidationSchema` validates nothing anywhere: no route, form or test parses with it, and `DaysOffInputType` is not imported at all. Its comment still calls it "The Days off page's closed days and holidays", which reads as the save's body and contradicts `holidayPicksValidationSchema` beside it. Only `DaysOffType` is used, as the shape of the four saved columns in find-days-off.ts and write-days-off.ts. A reader looking for what the PUT accepts finds two schemas and has to trace which one is live. Naming and dead code only, no behaviour.
**Suggested fix:** Drop `daysOffValidationSchema` and `DaysOffInputType`, and declare the four-column shape where it is produced (for example `DaysOffSettingsType` built from `HolidayPicksType & { closedDates: string[] }` in find-days-off.ts).
**Resolution:** fixed at the final review: `daysOffValidationSchema` and `DaysOffInputType` are removed; `DaysOffType` is now a plain `Pick` of the business rule's type, used for the read and the write.
