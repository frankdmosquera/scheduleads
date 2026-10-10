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

### F-337 [P3] closed - OutsideHoursBookingType still sits in a file of its own, though outsideHoursOf now produces it

**File:** backend/lib/settings/outside-hours-booking-type.ts:1-11; backend/lib/settings/outside-hours-of.ts:15-24
**Found:** 2026-10-10 by the final review of feature 12a (scope: main...76850fe; lenses: quality, security, performance, tests)
**Why it matters:** The type-only file made sense in 12a.1, when `outsideHours` was always empty and nothing produced it. Since 12a.2 `outsideHoursOf` builds every row of it, and coding-standards.md says "A type sits in the file of the function that produces it". The file is used (outside-hours-of, both saves), so nothing breaks; it is the leftover the standard exists to stop, a file Frank opens to find only a shape whose maker lives elsewhere.
**Suggested fix:** Move `OutsideHoursBookingType` into outside-hours-of.ts, point the two saves' imports there, and remove outside-hours-booking-type.ts.
**Resolution:** Fixed 2026-10-10 in step 12d.2: the type became ListedBookingType in backend/lib/settings/listed-booking.ts, beside listedBookingOf, the function that produces it, used by outsideHoursOf (12a) and the People save (12d.2); outside-hours-booking-type.ts is gone. Closed 2026-10-10 by independent review of step 12d.2 (2a517f5..f1f8427): the old file and every import of it are gone; ListedBookingType sits beside listedBookingOf, used by outsideHoursOf, both hours saves, the services route and saveResource; backend tests, frontend build and lint pass.

### F-340 [P3] closed - A service renamed on Settings no longer matches its setup-file entry, so a setup run under the new name adds a second one

**File:** packages/shared/client-setup/apply-business-shape.ts:145-150; packages/shared/client-setup/run-client-setup.ts:112-121; backend/lib/settings/save-service.ts:20
**Found:** 2026-10-10 by independent review of step 12d.1 (scope: main...e18c11a; lenses: quality, security, performance, tests)
**Why it matters:** The setup command finds a business's service by `toSlug(service.name)`, which held only while every slug came from the current name. 12d.1 keeps the slug fixed and lets the name change (decision 5), and gives a second add of a name `-2`. So after "Estimate" is renamed "Free estimate" on Settings, a setup file listing "Free estimate" inserts a second live "Free estimate", while one still listing "Estimate" keeps matching the renamed row; and a Settings-made `estimate-2` is taken for a setup service named "Estimate 2". The spec's note says the command "adds only what is missing, by name", which is not what it does once names change. Only re-runs on an existing business are affected, and those are local `*_dev` only until item 10b.
**Suggested fix:** Match setup services by name, trimmed and ignoring case (as the spec says), in both apply-business-shape.ts and run-client-setup.ts, keeping `toSlug` only for the slug of a new row (with the same `-2` rule as addService); or state in the command's header that a re-run after Settings changes is unsupported.
**Resolution:** Fixed 2026-10-10: the setup command finds a service by its name, ignoring case and spaces at the ends (client-setup/service-named.ts, used by the apply and by the differences report), never by slug; a service it adds gets a free slug through the same freeSlug rule as Settings (helpers/to-slug.ts), so a slug a renamed service still holds gets -2. New test in run-client-setup.test.ts, "finds a service renamed on Settings by its new name, never adding it twice", fails on the old matching. Closed 2026-10-10 by the check of 12d.1's fixes (6416063..0909c91): serviceNamed scopes to the business and compares lower(btrim(name)) with the trimmed, lowercased file name (the local database lowers accented letters the same way as JS); the apply and both places in the differences report use it, and a new service's slug goes through the same freeSlug as addService. The new test fails on 6416063's apply-business-shape.ts and run-client-setup.ts ("expected [ '1 services', ... ] to deeply equal []"), passes on 0909c91, uses a random throwaway business and is removed with it. The one new gap, two services of the same name, is F-343.

### F-341 [P3] closed - Closing the service form drops keyboard focus to the top of the page

**File:** frontend/components/settings/services-screen.tsx:34-38, 58, 75
**Found:** 2026-10-10 by independent review of step 12d.1 (scope: main...e18c11a; lenses: quality, security, performance, tests)
**Why it matters:** Save, Add and Cancel all `setOpen(null)`, which unmounts the form that holds the focus, and nothing moves it anywhere. A keyboard or screen reader user hears "Saved" from the status region but is left at the document's start and has to tab back through the dashboard to reach the list. 12a's cards never unmounted, so this is new with the open-one-form pattern.
**Suggested fix:** After closing, focus the row's Change button (by a ref map keyed by service id) for an edit, and "+ Add a service" for a new one or a Cancel.
**Resolution:** Fixed 2026-10-10: closing the service form (save or cancel) returns the keyboard to the button that opened it: the row's Change button, or + Add a service after cancelling a new one. Checked in the browser for all three. Closed 2026-10-10 by the check of 12d.1's fixes (6416063..0909c91): close() stores the button id in a ref and the effect on `open` focuses it after the commit that removes the form; on a new service the same commit adds its row, so its Change button exists when the effect runs. Switching straight to another form never sets the ref, and that form focuses its own name field. Build and lint clean.

### F-342 [P3] closed - The start-times minutes box sits inside the "Every" radio's label

**File:** frontend/components/settings/service-form.tsx:304-330
**Found:** 2026-10-10 by independent review of step 12d.1 (scope: main...e18c11a; lenses: quality, security, performance, tests)
**Why it matters:** HTML allows a label no labelable descendant other than its control; this label holds the radio and the number input, so the radio's name is computed with an embedded spinbutton, and the disabled box (shown while "every service length" is picked) is the natural thing to click but is disabled, so it may not pick the radio. Unverified: not tried in a browser or screen reader.
**Suggested fix:** Close the label after "Every"; put the input beside it with its aria-label, and either leave it enabled and pick the radio on focus, or keep it disabled and say so in a hint.
**Resolution:** Fixed 2026-10-10: the minutes box sits beside the Every choice, outside its label, and is always enabled; typing a number picks Every. Picking Every no longer fills in 30: the owner types the number. Checked in the browser. Closed 2026-10-10 by the check of 12d.1's fixes (6416063..0909c91): the label now holds only the Every radio; the box beside it keeps its aria-label and is never disabled; any typed value makes the field non-null, so Every is checked; picking Every sets NaN, which the schema rejects ("Use whole minutes.") until a number is typed, as an emptied box already did.

### F-343 [P3] closed - With two services of the same name, the setup report lists the other one's ticks as "ticked by hand"

**File:** packages/shared/client-setup/run-client-setup.ts:186-201; packages/shared/client-setup/service-named.ts:8-13
**Found:** 2026-10-10 by the check of 12d.1's fixes (scope: 6416063..0909c91)
**Why it matters:** Settings allows a second service with an existing name (addService gives it `-2`), and a rename can make two names equal. The apply and the field comparison take the oldest such service (`orderBy(createdAt).limit(1)`), but the "ticked by hand" query has no limit, so it gathers the ticks of every same-named service. Run on a throwaway business: setup made "Estimate" ticked Ana, a second "Estimate" (estimate-2) was ticked Bob, and a dry run reported `"Estimate", ticked by hand: Bob`, though Bob is not on the service the setup manages. Under the old slug matching estimate-2 was never matched. It only misleads the report (nothing is written), local `*_dev` only until item 10b. Also, `createdAt` alone has no tiebreak, so two same-named rows made in one transaction (the seed) have no fixed order.
**Suggested fix:** Find the service once per file entry (order by createdAt, then id) and use that row's id in the ticks query, instead of matching by name again.
**Resolution:** Fixed 2026-10-10: the ticks report first resolves the one service the file means (by name, oldest first, then by id), then reads that service's ticks by its id, so another of the same name never lends it its ticks; every by-name lookup orders by createdAt then id (oldestServiceFirst in service-named.ts). No new test: only a report line is at stake; the setup tests still pass. Closed 2026-10-10 by the independent review of feature 12d (e1a5d8f..7d2dfe2): run-client-setup.ts:206-222 resolves the file's service once (serviceNamed, oldestServiceFirst: createdAt then id) and reads only that id's ticks; the field differences (126-131) and the apply (apply-business-shape.ts:153-158) use the same order, so all three mean the same row; shared 174 of 174.

### F-344 [P2] closed - A person turned off is no longer texted about the bookings they still hold, so a move or cancellation of one never reaches them

**File:** backend/lib/text/send-worker-text.ts:148; backend/lib/settings/save-resource.ts:44-63
**Found:** 2026-10-10 by independent review of step 12d.2 (scope: 2a517f5..f1f8427; lenses: quality, security, performance, tests)
**Why it matters:** sendWorkerText returns "the person is inactive" before every kind, the "off your day" (`removed`) text included. Before 12d.2 nobody could turn a person off from the app; now the step's own story turns Tomas off and keeps his Friday booking. If that customer then cancels, or moves (the move goes to someone still on, since Tomas is no longer offered), Tomas's "off your day" text is skipped and he still believes he has Friday. The spec and the form's copy say off never touches a booking and the ones already made stay; the worker's loop on those bookings silently stops. worker-text-job.test.ts:367 tests the old rule ("an inactive person gets nothing"), written when inactive could only be set by hand.
**Suggested fix:** Let `removed` (and arguably `moved`) texts through for an inactive person who still holds or held the booking, keeping `added` off; or tell the owner on the turned-off answer that the person will no longer get texts about the listed bookings. Frank's call which.
**Resolution:** Fixed 2026-10-10 on Frank's yes ("yeah"): a person turned off still gets worker texts about the bookings they hold, by their own text settings; off only stops new bookings. This reverses feature 8c's decision 1 (an inactive person gets no texts), made when only a hand edit could turn someone off. send-worker-text.ts no longer skips an inactive person; find-worker-text-settings.ts no longer reads active. The 8c test became "a person turned off still hears about a booking they hold". Closed 2026-10-10 by the check of 12d.2's fixes (db01a23..edf075d): sendWorkerText was the only reader of the dropped `active` field (findWorkerTextSettings has no other caller; its join to resource still keeps the read inside the business). Every kind stays sensible for someone off: whyNotDue still sends `added` and `moved` only while the booking is theirs, and a move off them cannot pick an off person (move-booking.ts:106 checks the offered list), so they get the `removed` text; their own three switches still apply. The changed job test expects one text and fails on the old line, which sent none.

### F-345 [P2] closed - The setup command finds people by exact name, so a rename on Settings breaks it: the first person renamed stops the command, others are added twice

**File:** packages/shared/client-setup/run-client-setup.ts:47-55, 143-147; packages/shared/client-setup/apply-business-shape.ts:29-44
**Found:** 2026-10-10 by independent review of step 12d.2 (scope: 2a517f5..f1f8427; lenses: quality, security, performance, tests)
**Why it matters:** runClientSetup finds "the first person" by `resource.name = organization.name`; resource-table.ts:18 says the owner renames that person in feature 12, and 12d.2 is that rename. After it, every run of the command for that business answers `"<business>" has no first person named after it.` and stops. ensureResource matches the file's people with `eq(resource.name, name)`, case and spaces exact, while Settings now enforces decision 6 (case and outer spaces ignored): a person renamed "Diego (painter)" to "Diego" is inserted again under the old name by a file that still lists it, and a file listing "diego" next to a Settings "Diego" adds a second one the People page would have refused. Same class as F-340 for services. Local `*_dev` only until item 10b.
**Suggested fix:** Find the first person by the business's owner login (`resource.userId` of the owner member) rather than by name, and match the file's people with the same lower(btrim(name)) rule as nameTaken (one shared helper, as service-named.ts does for services), in ensureResource and the differences report.
**Resolution:** Fixed 2026-10-10: the setup command finds the first person by their tie to a login (the person made with the business), not by the business's name, and ticks may name them by either; every person and place is matched by name ignoring case and spaces at the ends (client-setup/resource-named.ts, name-key-of.ts, shared with service-named.ts), in the apply, the differences report and the ticks report. The test fixture now gives the first person a login, as every real business has. New test "finds people renamed on Settings, the first one by its login, never adding them twice" fails on the old code. A dry run of client-setups/agentsweb.ts: nothing to add. Closed 2026-10-10 by the check of 12d.2's fixes (db01a23..edf075d): only the first person ever gets a userId (the afterCreateOrganization hook in auth-server.ts, migration 0004's backfill, the seed; add-resource.ts and ensureResource never set one), and it is the business's oldest resource, so `isNotNull(userId)` oldest first finds it. A business left unlinked by 0004 (no owner or two, or first person already renamed) or whose owner login was deleted (`on delete set null`) now gets "no first person tied to a login" where the name lookup used to work; none is known, and the command is local `*_dev` only until item 10b, so left as a note. People are matched with lower(btrim()) in ensureResource and the differences report, ticks by nameKeyOf; the new test passes, and the fixture's users are deleted in afterAll. One gap left in the ticks report after the first person is renamed: F-349. Dry run of agentsweb.ts: nothing to add.

### F-346 [P3] closed - "That name is taken" shows as a form alert, not under the Name field

**File:** frontend/lib/api-client/settings/read-save-refusal.ts:15; backend/routes/settings-routes.ts:200, 226
**Found:** 2026-10-10 by independent review of step 12d.2 (scope: 2a517f5..f1f8427; lenses: quality, security, performance, tests)
**Why it matters:** name_taken is a 409 with no `field`, and readSaveRefusal makes a field error only from a 400, so both People forms show it in the SaveNotice: the Name input is not marked aria-invalid, has no error under it, and does not take the focus, unlike every other field error in the 12a pattern the spec names ("each error under its field ... a refused save focuses the first bad field").
**Suggested fix:** Return `field: "name"` with the 409 and let readSaveRefusal read a field from any refusal that carries one, or map `name_taken` to the name field in save-resource.ts on the frontend.
**Resolution:** Fixed 2026-10-10: the 409 name_taken answer carries field "name", and the frontend reads a field on any refusal, so the message shows under Name with focus there. Checked in the browser: adding "room 2" when Room 2 exists. Closed 2026-10-10 by the check of 12d.2's fixes (db01a23..edf075d): readSaveRefusal's callers are only the settings saves (business hours, person hours, people, services), and in settings-routes.ts only refuseFirstIssue (400) and NAME_TAKEN (409, People add and change only) carry a `field`; no_business_hours, not_found and last_person carry none, nor does any middleware. leads-routes.ts's `field` answers are 400s and do not go through readSaveRefusal. Both People forms register "name", so the field always exists. The route test now expects `field: "name"`.

### F-347 [P3] closed - A place turned off listing the bookings that use it has no test

**File:** backend/lib/settings/find-upcoming-bookings.ts:67; backend/lib/settings/save-resource.ts:70; backend/routes/settings-routes.test.ts:558-562
**Found:** 2026-10-10 by independent review of step 12d.2 (scope: 2a517f5..f1f8427; lenses: quality, security, performance, tests)
**Why it matters:** The Built note adds this rule ("a place turned off lists the bookings that use it") with its own query branch on booking.placeId; the only place test turns off a place with no bookings and checks the 200. A slip (person id passed, wrong column) would list nothing, and the owner would believe nobody needs a call.
**Suggested fix:** In the turned-off test, give one booking a placeId, turn that place off, and expect that booking (and not a booking without the place) in `upcomingBookings`.
**Resolution:** Fixed 2026-10-10: new route test "a place turned off lists the bookings that use it": a booking in Bay 1 is listed, one without a place is not; it fails without the place branch in find-upcoming-bookings.ts. Closed 2026-10-10 by the check of 12d.2's fixes (db01a23..edf075d): with the placeId condition replaced by `undefined`, the test failed (two bookings listed, one expected) and passed again once restored; makeBooking's placeId defaults to null, so its other callers are unchanged.

### F-348 [P3] unverified - A booking made while a person is being turned off can land on them and never be listed

**File:** backend/lib/booking/book-time.ts:213-215; backend/lib/settings/lock-business-resources.ts:1-4; backend/lib/settings/save-resource.ts:59-71
**Found:** 2026-10-10 by independent review of step 12d.2 (scope: 2a517f5..f1f8427; lenses: quality, security, performance, tests)
**Why it matters:** book-time reads who is offered (active) before its transaction and never locks the person or the business row (by design, "no key update" lets bookings through). If the turn-off commits between that read and the booking's insert, the new booking lands on a person now off and was not in the answer's list. Same shape as F-331 for hours. Unverified: needs the two to overlap; no reproduction run.
**Suggested fix:** Inside the booking's transaction, read the chosen person's row `for key share` (or `for share`) and refuse as unavailable when it is no longer active; or record the gap as accepted with F-331.
**Resolution:**

### F-349 [P3] closed - After the first person is renamed, the setup report lists them as "ticked by hand" on every service the file ticks them on by the business's name

**File:** packages/shared/client-setup/run-client-setup.ts:64, 68, 218-221
**Found:** 2026-10-10 by the check of 12d.2's fixes (scope: db01a23..edf075d)
**Why it matters:** The F-345 repair lets a tick name the first person by the business's name or their own (`names: [business.name, firstPerson.name]`), but only in the apply; findDifferences gets no first person, so its ticks report compares the saved person's name with the file's tick names alone. Reproduced with a throwaway test (removed after): a file ticking "Phone call" with the business's name, applied, the first person renamed "Owner", then a dry run answered `differences: ["\"Phone call\", ticked by hand: Owner"]`, though the file put that tick there and the apply made nothing. Before the repair the command stopped on the rename, so this report never ran. Only a report line misleads; nothing is written; local `*_dev` only until item 10b.
**Suggested fix:** Pass the first person's id (or the same names list) to findDifferences and treat a tick on that id as in the file when any of the file's ticks matches one of its names; or compare ticks by resource id, mapping the file's names to ids as the apply does.
**Resolution:** Fixed 2026-10-10: the differences report knows the first person and the business's name; a tick of the first person counts as in the file when the file ticks them by their own name or by the business's. The setup tests pass; no new test, only a report line is at stake. Closed 2026-10-10 by the independent review of feature 12d (e1a5d8f..7d2dfe2): findDifferences gets the first person's id and the business's name (run-client-setup.ts:64-67); a tick on that id counts as in the file when the file names them by either name (224-226), and the "in the file, not ticked here" side adds the business's name when they are ticked (230-233), matching the apply's name map (apply-business-shape.ts:93-95).

### F-350 [P3] closed - The seed, run again after the first person is renamed on Settings, adds a second one and stops on the login index

**File:** packages/shared/scripts/seed-dev.ts:440-447; packages/shared/db/booking-tables/resource-table.ts:35
**Found:** 2026-10-10 by the check of 12d.2's fixes (scope: db01a23..edf075d)
**Why it matters:** The seed still finds its first person by the business's name (ensureResource), the lookup F-345 replaced in the setup command. Rename "Summit Painting (dev)" on People (12d.2) and reseed: ensureResource finds nobody of that name and inserts a new person, then the link update sets the owner's userId on it (`isNull(userId)` holds for the new row), which the unique index on (organizationId, userId) refuses, since the renamed person already holds that login; the whole seed transaction rolls back. Read from the code, not run (the seed is outside this check's commands). The seed is re-runnable by design ("no machine needs a rebuild"); a dropped database is unaffected.
**Suggested fix:** Find the seed's first person by the owner's login first (`resource.userId = userId` in that business), falling back to ensureResource by name only when none is linked yet; pass that person's current name with the business's name to applyBusinessShape, as run-client-setup.ts now does.
**Resolution:** Fixed 2026-10-10: the seed finds a business's first person by their owner's login once linked, and only falls back to the business's name to make one; a rename on Settings no longer makes it add a second. Ran npm run db:seed on scheduleads_dev: both businesses "already there". Closed 2026-10-10 by the independent review of feature 12d (e1a5d8f..7d2dfe2): seed-dev.ts:441-448 looks the person up by (business, owner userId), unique by resource_organization_user_unique, and only falls back to ensureResource by name when none is linked, so a renamed first person is found and the link update (452-455) is a no-op; ticks by the business's name still map to that id (names: [business.name]). Read, not run: the seed is outside this review's commands.

### F-351 [P3] closed - Cancel after a service saved but its ticks failed leaves the list showing the service as it was

**File:** frontend/components/settings/service-form.tsx:184-186
**Found:** 2026-10-10 by /audit (scope: 12d.3, 7eb80af..7f38977; lenses: all)
**Why it matters:** The form saves the service, then its ticks by a second call. When the second call fails, the form stays open with the service already changed on the server; Cancel on an existing service called onCancel, so the list kept the old name, length or Live state until a reload. (A new service was already handled.)
**Suggested fix:** On Cancel, hand the list the service as last saved whenever a save landed in this form.
**Resolution:** Fixed 2026-10-10: Cancel passes the last saved service to the list whenever one landed, new or existing. Closed 2026-10-10 by the check of 12d.3's fixes (f38b317..397e536): savedService only moves off the opened service when the service saved and its ticks then failed (every other save closes the form), so Cancel hands the list exactly that case; a failed first save still cancels plainly.

### F-352 [P2] closed - The step's hand check left Summit's Colour consultation on "the customer picks", and three public route tests now fail

**File:** backend/routes/public-booking-links-routes.test.ts:226, 605, 619
**Found:** 2026-10-10 by the independent review of 12d.3 (scope: 7eb80af..7c8e9e3)
**Why it matters:** These tests read painting-dev's seeded Colour consultation and expect "the business sends whoever is free". The step's hand check switched it to "the customer picks" in scheduleads_dev and left it there, so `npm run test --workspace=backend` now ends 3 failed, 924 passed ("expected 'customer_picks' to be 'business_assigns'", people listed where none are expected, 200 where 400 is expected). Every later step reruns this suite, so the gate is red for reasons that have nothing to do with the code. `npm run db:seed` does not put it back: applyBusinessShape only adds a missing service and never changes an existing one.
**Suggested fix:** Switch Colour consultation back on Settings (or drop, migrate and seed scheduleads_dev), rerun the backend suite, and do future hand checks on a service the suite does not read, or put the change back as part of the check.
**Resolution:** Fixed 2026-10-10: Colour consultation switched back to "we send whoever is free" on Settings; backend 927 of 927 again. Dev data only, no code. Closed 2026-10-10 by the check of 12d.3's fixes (f38b317..397e536): `npm run test --workspace=backend` 927 passed, 0 failed.

### F-353 [P3] closed - Cancel after the ticks failed to save announces "Saved. Customers can book it now."

**File:** frontend/components/settings/service-form.tsx:185-188, frontend/components/settings/services-screen.tsx:47-58
**Found:** 2026-10-10 by the independent review of 12d.3 (scope: 7eb80af..7c8e9e3)
**Why it matters:** When the service saves and its ticks then fail, the form says "X is saved, but who does it is not". If the owner presses Cancel, the form (since the F-351 repair, and for a new service since 7f38977) calls onSaved, and the list's saved() shows the same notice as a full save: "Saved. Customers can book X now." The owner who wanted only Marco reads that everything went through, while the service is live with the ticks as they were (for a new one, nobody ticked, so anyone is offered). Read from the code, not clicked.
**Suggested fix:** Let Cancel hand the list the saved service without the success notice (a second callback, or a flag on onSaved), or have the list say that who does it was not changed.
**Resolution:** Fixed 2026-10-10 on Frank's yes: Cancel after a failed tick save tells the list so, and the list says "Saved, but who does <service> was not." instead of the full-save notice. Checked in the browser with the ticks call blocked on Cabinet consultation. Closed 2026-10-10 by the check of 12d.3's fixes (f38b317..397e536): Cancel is the only caller passing `false`, every full save still passes nothing (true), and the list returns before the success notice; frontend build and lint clean.

### F-354 [P3] closed - The setup command and the seed put back ticks the owner removed on Settings

**File:** packages/shared/client-setup/apply-business-shape.ts:194-199
**Found:** 2026-10-10 by the independent review of 12d.3 (scope: 7eb80af..7c8e9e3)
**Why it matters:** For a service that already exists, the setup still inserts every tick the file names (`onConflictDoNothing`, "one removed by hand comes back"). That rule dates from when "by hand" meant editing the table; since 12d.3 it is the owner's own choice on Settings. On Riverbend Clinic (dev), untick Mei from the laser service, then run `npm run db:seed` (or the setup with `--apply`): Mei is ticked and offered again; a service whose ticks were cleared to "anyone" goes back to only the file's people. The setup already leaves an existing service's other fields alone, so ticks are the odd one out. Read from the code, not run; the setup is local `*_dev` only until item 10b.
**Suggested fix:** Add a service's ticks only when this run makes the service, and list the file's missing ticks on an existing service as a difference instead; Frank's call, since the current rule was written on purpose.
**Resolution:** Fixed 2026-10-10 on Frank's yes: the setup and the seed tick only a service they make now; an existing service's ticks are left as the owner set them, and the report names a file tick missing there as "unticked by hand". The setup test unticks Room A and checks it stays off and is reported; it fails on the old code. Closed 2026-10-10 by the check of 12d.3's fixes (f38b317..397e536): a service made now still gets the file's ticks through the same name map (the first person by the business's name in both callers, and by their own name in the setup), an existing one is skipped before any insert, and the report names added and removed ticks, the first person included; shared 174 of 174. The skip also took the "who is not listed" guard with it for existing services, see F-355.

### F-355 [P3] closed - On a service that already exists, a tick naming nobody is no longer stopped, and is reported as "unticked by hand"

**File:** packages/shared/client-setup/apply-business-shape.ts:189-192; packages/shared/client-setup/run-client-setup.ts:229-234
**Found:** 2026-10-10 by the check of 12d.3's fixes (scope: f38b317..397e536)
**Why it matters:** The F-354 skip (`if (existingLink || !ticked.length) continue`) sits before the map that throws `"X" ticks "Y", who is not listed.`, so that guard now runs only for a service made in this run. A setup file whose existing "Laser" ticks a misspelled "Mai" used to stop the run with that message; now the dry run and the apply both pass, and the report says `"Laser", unticked by hand: Mai`, which reads as the owner's own choice on Settings. The same line appears for a person the file adds in this very run and ticks on an existing service (made, never ticked, reported as removed by hand). Nothing wrong is written; only the check and the wording are lost. Read from the code, not run; local `*_dev` only until item 10b.
**Suggested fix:** Resolve every service's tick names (the throw) before the `existingLink` skip, so a name nobody holds stops the run as before; and word the report line for a file tick missing on an existing service without claiming "by hand" (for example "in the file, not ticked"), or name a person made in this run apart.
**Resolution:** Fixed 2026-10-10 (it only made F-354 hold): every tick name is checked before an existing service is skipped, and the report line reads "in the file, not ticked here". A test runs a misspelt tick on an existing service and expects the stop; it fails on 397e536. Closed 2026-10-10 by the check of 12d.3's fixes (397e536..aeeb451): the name map and its throw now run for every service before the existingLink skip, inside the transaction, so a dry run and an apply both stop and roll back; a service made now still gets the file's ticks (the first person by the business's name in both callers); the report line no longer says "by hand"; shared 174 of 174, backend 927 of 927.

### F-356 [P3] closed - Changing the business's sending address to another domain leaves work emails at the old one

**File:** backend/lib/email/save-email-sending.ts; backend/lib/settings/save-resource.ts
**Found:** 2026-10-10 by /audit (scope: 12d.4, 0701f77..a8f83a6; lenses: all)
**Why it matters:** A work email is checked against the sending domain only when it is saved (decision 8). If the business later moves its sending address to another domain (feature 6's save), the people's work emails stay at the old one and keep getting the person's notification and the customer's replies. Nothing breaks and nobody outside the business is reached, but the rule "at the business's own domain" stops holding until each is re-saved.
**Suggested fix:** When the sending domain changes, list the people whose work email is at another domain (or clear them), on the email settings save; or accept it, since a domain move is rare and done with the agency.
**Resolution:** Confirmed at P3 by the independent review of 12d.4 (0701f77..b170bbf). `save-email-sending.ts:78` writes `senderEmail` and never reads `resource.workEmail` (it is read nowhere but the settings and email code), and `send-booking-emails.ts` sends to and replies to the stored address without re-checking its domain. One more effect, found in the form: `change-resource-form.tsx:43-46` always sends a person's stored work email, so after a domain move any save of that person (a rename, or turning them off) re-runs the check at `save-resource.ts:53-68` and is refused 400 "Use an address at <new domain>" until the owner changes or clears the field. The message sits on the field and is focused, so the owner is not stuck, and that refusal is also where the stale address first shows. Still open. Fixed 2026-10-10 on Frank's yes: the domain is checked only when the work email itself changes, so after a move of the sending domain a rename or turning off still saves and the old address keeps working until replaced; a new one must be at the new domain. No work email is cleared automatically. A route test covers it and fails on 0a78fea. Closed 2026-10-10 by the check of 12d.4's fixes (b170bbf..05f2dc0): save-resource.ts is the only code that writes a work email, always through the trimmed, lowercased schema and the domain check, so an unchanged address can only be one that passed the check before a domain move (the agreed case); case or spaces in a resend compare equal and keep it, a person with none and any new address are still checked, a place is refused before the comparison, and the sending address can never be cleared back to none; backend 934 of 934.

### F-357 [P3] closed - The Services page's people list now carries every person's work email

**File:** backend/lib/settings/find-services-settings.ts:45; backend/lib/settings/resource-settings-of.ts:19
**Found:** 2026-10-10 by the independent review of 12d.4 (scope: 0701f77..b170bbf)
**Why it matters:** `findServicesSettings` reads the people for the ticks with `resourceSettingsColumns`, which 12d.4 widened with `workEmail`, so `GET /settings/services` now answers `people` as `{ id, name, kind, active, workEmail }`. The contract in current-feature.md (Data / contracts) says `{ id, name, kind, active }` for the ticks. Only members of the business can read it, and they already see the same addresses on `GET /settings/people`, so nothing leaves the business; it is a contract drift and an address sent where nothing uses it.
**Suggested fix:** Give the ticks their own columns (id, name, kind, active), or amend the contract to say the Services answer carries `workEmail` too.
**Resolution:** Fixed 2026-10-10 without asking (it only makes the contract hold): the Services read selects its own four columns, so the ticks carry no work email; a route test checks it and fails on b170bbf. Closed 2026-10-10 by the check of 12d.4's fixes (b170bbf..05f2dc0): the generic resourceSettingsOf returns only the columns it is given; People's read, add and save still pass resourceSettingsColumns and are typed ResourceSettingsType with workEmail, Services passes its own four, and no other backend read returns a work email; frontend build and lint pass.

### F-358 [P3] accepted - A confirmation or person's email retried after the work email changed reuses its Resend key with a different email

**File:** backend/lib/email/send-booking-emails.ts:54; backend/lib/email/send-booking-emails.ts:104; backend/lib/email/find-booking-email-context.ts:54
**Found:** 2026-10-10 by the independent review of 12d.4 (scope: 0701f77..b170bbf)
**Why it matters:** The confirmation's `reply_to` and the person's notification's `to` come from `resource.workEmail` read afresh on every attempt, while each keeps one idempotency key (`booking-confirmation/<id>`, `booking-person-notification/<id>`). The code already guards this invariant elsewhere ("Resend refuses a key it already used with a different email", the confirmation's `stampedAt`). If an attempt reaches Resend but the app sees a failure (the 10 second timeout in `send-email.ts`), and the owner changes or sets that person's work email before the retry, the retry is refused by Resend, so the job fails on every retry and no timeline entry is written, although the email went. Narrow: it needs a timed out send and an edit inside the retry window; no customer is harmed. Read from the code, not run.
**Suggested fix:** Accept it as rare, or freeze the address for the booking: keep the address a booking's emails were first built with (for example on the booking at booking time) so every retry sends the very same email.
**Resolution:** Accepted 2026-10-10 by Frank: it needs Resend to send yet not answer within 10 seconds (about 1 send in 10,000) and the owner to change that person's work email in the ~3 seconds before the first retry (about 1 in 3 million), so about 1 booking in 30 billion; the email still reaches the person, only the log line and the timeline note are lost.

### F-359 [P2] fixed - Saving again after the ticks failed loses the list of bookings the new length no longer fits

**File:** frontend/components/settings/service-form.tsx:150, 162; backend/lib/settings/save-service.ts:42-44
**Found:** 2026-10-10 by the independent review of 12d.5 (scope: 4fe1fe5..f7dc97b)
**Why it matters:** The form saves the service first and its ticks second. When the length changes and the ticks then fail (the API not answering, a 5xx, a lapsed session: the path F-351 and F-353 already handle), the form stays open and the first answer's list sits in `outsideHours.current`. Pressing Save again calls `saveService` again with the same values; the backend now finds the length unchanged (60 to 90 was already saved) and answers `outsideHours: []`, and line 162 overwrites the held list with it. The page then says "Saved." with no list, so the owner is never told Maria's Tuesday 4:00 now runs past 5:00, which is the whole point of the step. Read from the code, not run.
**Suggested fix:** Keep the list across saves of one open form: on a later save, merge the new answer's `outsideHours` into the held one by `bookingId` instead of replacing it (or, when the service values are unchanged since the last successful save, retry only the ticks).
**Resolution:** Fixed 2026-10-10 without asking (it only makes the plan hold): the form keeps every save's list, merged by booking, while it is open; checked in the browser with the ticks call blocked on the first save, Marta still listed after the second. Left fixed by the independent review of feature 12d (e1a5d8f..7d2dfe2): the original case now holds (a second save with the same length keeps the first list), but the merge never drops an entry, so a second save that puts the length back lists bookings that fit again: F-361. Closes once the merge applies only when the length is unchanged.

### F-360 [P3] closed - A person's hours saved at the same moment as a new service length are not waited for, though the comment says hours saves are

**File:** backend/lib/settings/save-service.ts:46, 56, 60; backend/lib/settings/save-person-hours.ts:62, 74
**Found:** 2026-10-10 by the independent review of 12d.5 (scope: 4fe1fe5..f7dc97b)
**Why it matters:** The service save reads the business's hours row `for share` so that "a save of hours running meanwhile finishes first". That holds for the business's own save, which takes the row `for update`. A person's save also takes the business row only `for share`, and two share locks never wait for each other, so `findPeopleHours` (unlocked) reads that person's old row while their save is still open. Example: Ana's Tuesday goes from ending 6:00 to ending 5:15 in one tab while the estimate goes from 60 to 90 in another; Maria's 4:00 fits both of Ana's weeks as booked, so the person save lists nothing, and the service save checks 4:00 to 5:30 against the old 6:00 and lists nothing either. No deadlock: neither hours save touches `booking_link`. Narrow (two owner saves of one business at once, the F-331 family); the comment overstates what the lock gives.
**Suggested fix:** Read the business row `for("no key update")` instead of `for("share")` in the service save: it waits for a person's save holding it shared, and nothing takes a key share on that row, so bookings are not held up. Or keep the lock, correct the comment to "a save of the business's hours", and accept the gap with F-331.
**Resolution:** Fixed 2026-10-10 without asking (it only makes the comment and the plan hold): the service save locks the business's hours row for no key update, so it waits for a person's save too, and bookings are not held up. Closed 2026-10-10 by the independent review of feature 12d (e1a5d8f..7d2dfe2): save-service.ts:57 takes the business row `for no key update`, which conflicts with the person save's `for share` (save-person-hours.ts:62) and the business save's `for update`, so either hours save finishes first; no cycle (the service save holds only its booking_link row, which neither hours save touches), and no booking path locks that row; backend 942 of 942.

### F-361 [P3] fixed - Saving again after the length went back keeps listing bookings that fit again

**File:** frontend/components/settings/service-form.tsx:164-168
**Found:** 2026-10-10 by the independent review of feature 12d (scope: current, e1a5d8f..7d2dfe2; lenses: quality, security, performance, tests)
**Why it matters:** The F-359 repair merges every save's `outsideHours` into the held list while the form is open and never drops an entry. The backend recomputes the list against the length just saved whenever the length changes (save-service.ts:42-71), so a later answer is the whole truth for that length. Example: the estimate goes from 60 to 90, Maria's Tuesday 4:00 is listed, the ticks call fails and the form stays open; the owner puts the length back to 60 and saves; the backend answers `[]` (4:00 to 5:00 fits), the merge keeps Maria, and the page says "One booking no longer fits at the new length" and lists her under "bookings that no longer fit", though at 60 she fits. Read from the code, not run. Narrow: needs a failed ticks save first; nothing is written, the owner may only call a customer for nothing.
**Suggested fix:** Merge only when the length is the one last saved: if `values.durationMinutes` differs from `savedService.current.durationMinutes`, replace the held list with the new answer (the backend's list is complete for the new length); keep it only when the length did not change, which is the F-359 case.
**Resolution:** Fixed 2026-10-10 without asking (it only makes F-359's repair hold): a save at a new length replaces the held list, and only a save again at the same length keeps it; checked in the browser, 60 to 90 with the ticks blocked then back to 60 lists nothing.

### F-362 [P3] fixed - Two new exports sit in files named for something else

**File:** packages/shared/zod-validation/resource-validation-schemas/resource-validation-schema.ts:12, 29; packages/shared/helpers/to-slug.ts:17
**Found:** 2026-10-10 by the independent review of feature 12d (scope: current, e1a5d8f..7d2dfe2; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md says Zod schemas are one object per form with the file named after it (`signInEmailValidationSchema` in `sign-in-email-validation-schema.ts`), and shared code is one file per export. `addResourceValidationSchema` and `saveResourceValidationSchema` are two forms in `resource-validation-schema.ts`, a name that matches neither, so the import does not lead to the file. `freeSlug`, a separate helper the backend and the setup command both use, was added inside `to-slug.ts`. Older files do group a form's field parts (weekly-hours, availability-rule), which `service-validation-schema.ts` follows; these two are different forms and a different helper. Naming only, no behaviour.
**Suggested fix:** Split into `add-resource-validation-schema.ts` and `save-resource-validation-schema.ts` (the shared name schema in one, imported by the other, or its own file), and move `freeSlug` to `helpers/free-slug.ts`, exported through the helpers index as now.
**Resolution:** Fixed 2026-10-10 without asking (naming the standards already set): the two forms are add-resource-validation-schema.ts and save-resource-validation-schema.ts, their shared name schema resource-name-validation-schema.ts; freeSlug is helpers/free-slug.ts, exported as @scheduleads-app/shared/free-slug.
