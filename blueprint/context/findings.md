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

### F-116 [P3] open - Finding numbers in three code comments added by this feature

**File:** backend/lib/auth/auth-server.ts:157; backend/lib/auth/login-code-timing.test.ts:2; backend/lib/auth/send-login-code.test.ts:37
**Found:** 2026-10-03 by independent review of feature 6 (scope: 7dc0721..8858d37; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md (Comments) rules out history in code
comments, finding numbers named; F-112 and F-115 were the same slip and were
fixed. Three comments written for the F-97 and F-98 repairs still end in
"(F-97)" or "(F-98)". After `/complete` archives the ledger these become
`6/F-97`, so the bare numbers in the code point at nothing a later reader can
find. The comments' reasons are already said in words around them.
**Suggested fix:** Drop the three parenthesised numbers and keep the
sentences as they are.
**Resolution:**

### F-117 [P2] closed - No test notices the booking page reading another business's time zone, or a person's hours row

**File:** backend/lib/booking/find-booking-page.ts:65-66 (tests: backend/routes/public-booking-page-routes.test.ts:64, :172)
**Found:** 2026-10-03 by independent review of step 7a.1 (scope: 32114fc..4c05007; lenses: quality, security, performance, tests)
**Why it matters:** The hours row that gives the page its zone is the one
join not pinned by a foreign key to the booking's business, so its two
conditions are what keep it inside the business. Both were removed in turn
in this review and all 11 tests still passed: without the business
condition the query picks any business's hours row, and without
`isNull(resourceId)` a person's own row (zone always null) can be picked and
a real link answers 404. The tests cannot see either because both test
businesses share America/Edmonton, have no person-level hours, and the
isolation test compares only the business name. The code is right today;
the guard the spec asks for ("read through the booking's own business") is
untested.
**Suggested fix:** Give the second test business a different zone (for
example America/Toronto) and a person-level hours row for Marco, and assert
each link's `timezone` (and that the booking still opens) in "each link
opens its own business's booking only".
**Resolution:** Fixed 2026-10-03: the second test business runs on Toronto time and Marco gets a person-level hours row (no zone) after his booking; a new test expects each link to say its own business's zone. The lookup now refuses more than one joined row instead of taking the first, so a join that loses either condition fails deterministically: dropping the business condition or the person-row condition each fails three tests. Closed 2026-10-03 by independent review of step 7a.2 (scope: 2e91e73..6b0b747): re-examined find-booking-page.ts and its route tests. Dropping the hours row's business condition, or its person-row condition, each fails six route tests (the lookup refuses a second joined row); the partial unique index keeps one business-level hours row per business, so the refusal can never fire on good data. No new defect.

### F-118 [P3] closed - The page's status is typed as any string, not the contract's two values

**File:** backend/lib/booking/find-booking-page.ts:18
**Found:** 2026-10-03 by independent review of step 7a.1 (scope: 32114fc..4c05007; lenses: quality, security, performance, tests)
**Why it matters:** The spec's view says `status: "confirmed" | "cancelled"`
and the database check allows only those, but `BookingPageType.status` is
`string`, so the frontend's inferred `BookingPageType` is `string` too. Jane's
page (7a.5) branches on this value for its states, and with `string` a
misspelt branch or a third status added later compiles without complaint,
which is what the typed client exists to catch.
**Suggested fix:** Type it as `"confirmed" | "cancelled"` (one shared
union beside the booking table if other code needs it) and narrow the row
value once in `findBookingPage`.
**Resolution:** Fixed 2026-10-03: BookingStatusType is "confirmed" | "cancelled", narrowed once in findBookingPage; any other value is refused, never shown. The typed client carries the union. Closed 2026-10-03 by independent review of step 7a.2 (scope: 2e91e73..6b0b747): BookingStatusType is the two-value union, narrowed once in statusOf, and 7a.2's canCancel builds on the narrowed value. No new defect.

### F-119 [P3] closed - The token's exact construction is not pinned by a known-answer test

**File:** backend/lib/booking/booking-page-token.ts:13-14 (tests: backend/lib/booking/booking-page-token.test.ts:15)
**Found:** 2026-10-03 by independent review of step 7a.1 (scope: 32114fc..4c05007; lenses: quality, security, performance, tests)
**Why it matters:** Every test makes and reads a token with the same code,
so they pass for any construction. Dropping the `booking-page:` purpose
prefix in this review left all 11 tests green. Decision 10 makes these links
permanent (every later email carries the same one), so an innocent change to
the construction would silently end every link already sent, and the domain
separation the comment promises is unguarded.
**Suggested fix:** Add one test with a fixed key and a fixed booking id that
expects the exact token string, computed once from the spec's formula
(`base64url(HMAC-SHA256(key, "booking-page:" + id))`).
**Resolution:** Fixed 2026-10-03: a known-answer test pins the exact token for a fixed key and booking id; dropping the purpose prefix now fails it. Closed 2026-10-03 by independent review of step 7a.2 (scope: 2e91e73..6b0b747): re-examined booking-page-token.ts and its test; dropping the booking-page: prefix fails "a link is made exactly the same way, always". No new defect.

### F-120 [P3] closed - readBookingLinkKey is a line-for-line copy of readTokenKey

**File:** backend/lib/booking/read-booking-link-key.ts:7 (copy of packages/shared/crypto/token-cipher.ts:14)
**Found:** 2026-10-03 by independent review of step 7a.1 (scope: 32114fc..4c05007; lenses: quality, security, performance, tests)
**Why it matters:** The two functions differ only in the variable name in
the env lookup and messages: the same canonical base64 check, the same
length check, the same make-one hint. The canonical check is the subtle
part (Buffer skips bad characters silently), and a fix to one copy will not
reach the other; feature 16's quote link would make a third.
**Suggested fix:** One shared `readBase64Key(name, encodedKey)` in
`packages/shared/crypto` (or `helpers/`), with `readTokenKey` and
`readBookingLinkKey` as one-line callers; the existing tests keep covering
both names.
**Resolution:** Fixed 2026-10-03: readBase64Key(name, value) in packages/shared/crypto/token-cipher.ts holds the check once; readTokenKey and readBookingLinkKey are one-line callers with their own names in the errors. Closed 2026-10-03 by independent review of step 7a.2 (scope: 2e91e73..6b0b747): read-booking-link-key.ts and readTokenKey are one-line callers of readBase64Key in packages/shared/crypto/token-cipher.ts; both names stay tested (booking-page-token.test.ts, token-cipher.test.ts). No new defect.

### F-121 [P3] closed - Two planning docs still contradict decision 10 and the new route

**File:** blueprint/context/coding-standards.md:209; blueprint/context/project-overview.md:149
**Found:** 2026-10-03 by independent review of step 7a.1 (scope: 32114fc..4c05007; lenses: quality, security, performance, tests)
**Why it matters:** The standards' public-route rule says a public route is
read-only, takes its business from the slug, and never finds a row by its
id alone; `GET /public/bookings/:token` finds the booking by the signed id,
which is right by the spec, and 7a.2's cancel will write. A later reviewer
following the standard would flag correct code, or a builder would copy the
slug rule onto the token route. The overview's planned booking model still
lists `cancelToken`, the stored token decision 10 rejected; this commit
edited the overview but left that line.
**Suggested fix:** Add a second public-route kind to the standard: keyed by
a signed link, the business taken from the row the link names, every other
read inside that business, every bad link the same 404. Drop `cancelToken`
from the overview's booking line.
**Resolution:** Fixed 2026-10-03: coding-standards.md gains the signed-link kind of public route (its rules: the id only from a verified signature, every other query on that row's business, one 404, no customer details, never cached, the link never logged or stored); the build log's Rules tab regenerated. The overview drops cancelToken and names the signed link. Closed 2026-10-03 by independent review of step 7a.2 (scope: 2e91e73..6b0b747): coding-standards.md:215-222 names the signed-link public route and 7a.2's POST follows it (id only from the verified token, every other query on the row's business, one 404, no-store, no customer details); project-overview.md:150 names the signed link and cancelToken is gone. No new defect.

### F-122 [P3] closed - Neither guard against a double cancel, nor the cancelled-first order, is pinned by a test

**File:** backend/lib/booking/cancel-booking.ts:41, :44, :59 (tests: backend/lib/booking/cancel-booking.test.ts:176, :193)
**Found:** 2026-10-03 by independent review of step 7a.2 (scope: 2e91e73..6b0b747; lenses: quality, security, performance, tests)
**Why it matters:** The cancel has two guards against two presses at
once, the row lock (:41) and the update that only changes a confirmed
booking (:59). Removing either one alone left all 19 tests green; only
removing both failed the race test. "Two cancels at the same instant"
(:176) also passed with both guards removed, so its two calls never
overlap and it repeats the second-cancel test rather than proving the
Done when line it is named for. Removing the already-cancelled check
(:44) also stays green, yet it is what makes a second press after the
start answer 200 cancelled rather than 409 already_started. The code is
right today; the lock is the guard 7b's move will lean on (a move and a
cancel of the same booking at once), and nothing would notice it going.
**Suggested fix:** In the race test, let the holding transaction move
the booking into the past instead of cancelling it, and expect
`already_started` with nothing changed: that fails without the lock and
passes with it. Drop or rename the Promise.all test. Add one case: a
cancelled booking whose start has passed answers already cancelled.
**Resolution:** Fixed 2026-10-03: the Promise.all test, whose two calls never overlapped, is gone. A shared helper now holds the booking in another transaction while the cancel starts: holding and cancelling it gives "already cancelled" with no entry; holding and moving it into the past gives already_started, which fails without the row lock. A cancelled booking whose start has passed answers already cancelled, which fails without the cancelled-first check. The confirmed-only update stays a second guard that matters only without the lock: removing it alone passes, removing it with the lock fails the race test. Closed 2026-10-03 by independent review of step 7a.3 (scope: 12e7fd3..7df5944): re-run by mutation against the 7a.3 code, removing the row lock (cancel-booking.ts:45) fails "moved into the past meanwhile, it is refused"; removing the cancelled-first check (:48) fails "a cancelled booking whose start has passed still answers already cancelled"; removing the confirmed-only condition (:63) alone passes and with the lock fails both race tests, as the fix said. 7a.3's change to this file (the removal started after the transaction) leaves the guards as they were. No new defect.

### F-123 [P3] closed - The 404 answer, the one the agreed "remove by the made id" call relies on, is not tested

**File:** backend/lib/calendar/google-calendar-provider.ts:97 (tests: backend/lib/calendar/remove-booking-event.test.ts:179, :257)
**Found:** 2026-10-03 by independent review of step 7a.3 (scope: 12e7fd3..7df5944; lenses: quality, security, performance, tests)
**Why it matters:** The Done when says an event already gone counts as
removed, and the spec names both 404 and 410. Only 410 is tested (:184).
Deleting `response.status === 404` from :97 leaves all 30 tests in the
three files green. 404 is what Google answers for an id it never had,
which is exactly the case the agreed call creates: a connected person
whose event was never written (connected after the booking, or the write
failed) now gets a DELETE, and without the 404 rule every such cancel
would log a false "is still there" line and keep feature 8 retrying
forever. The "id not saved yet" test (:257) answers 204, so it does not
cover it either. Smaller, same place: nothing checks the DELETE carries
the person's own access token (dropping it from :93 also stays green).
**Suggested fix:** Answer 404 in the "id not saved yet" test (that is
what Google says when the write never happened) and expect no warning, or
add a 404 case beside the 410 one. Record the Authorization header in the
fake and expect the saved access token on the DELETE.
**Resolution:** Fixed 2026-10-03: the "id not saved yet" test now has Google answer 404 and expects no warning; the fake records the Authorization header and the first test expects Ana's own saved key. Dropping the 404 rule, or sending another key, each fail a test. Closed 2026-10-03 by independent review of step 7a.4 (bea19bc..dfa2d60): re-run, removing `response.status === 404` from google-calendar-provider.ts fails "an event whose id was not saved yet is removed by its own id, and Google's 404 is done"; the fake records the Authorization header and the test expects the saved key. No new defect.

### F-124 [P3] closed - The 7a.3 step and its Done when still say "no event makes no call", which the agreed call made untrue

**File:** blueprint/context/current-feature.md:155, :161
**Found:** 2026-10-03 by independent review of step 7a.3 (scope: 12e7fd3..7df5944; lenses: quality, security, performance, tests)
**Why it matters:** The step says "no event or no connection does
nothing" (:155) and the Done when "no connection or no event makes no
call" (:161). After the agreed call, a booking with no event but a
connected person does make a DELETE (remove-booking-event.ts:31, proved
by the test at remove-booking-event.test.ts:257). Only the Notes (:310)
were amended, so the step contradicts its own code, and the "no event"
half of the Done when has no test because it is no longer true. A later
reader (7b, feature 8) following the step text would remove the call.
**Suggested fix:** Amend the step and its Done when to the agreed rule:
no connection makes no call; with a connection the event is removed by
the id made from the booking, saved or not, and Google's 404 counts as
done.
**Resolution:** Fixed 2026-10-03: step 7a.3 and its Done when in current-feature.md now say the agreed rule: removed by the made id, saved or not; no connection makes no call; a connected person with no event gets a DELETE that Google answers 404, done, with no warning; the DELETE carries the person's own key. Closed 2026-10-03 by independent review of step 7a.4: current-feature.md 7a.3 and its Done when (:151-166) state the agreed rule and match remove-booking-event.ts and its tests.

### F-125 [P3] closed - cancelledIn is typed `never` where the removal starts, so that call is not type-checked

**File:** backend/lib/booking/cancel-booking.ts:27, :98
**Found:** 2026-10-03 by independent review of step 7a.3 (scope: 12e7fd3..7df5944; lenses: quality, security, performance, tests)
**Why it matters:** `let cancelledIn: string | null = null` is narrowed by
TypeScript to `null` at its declaration, and an assignment inside the
transaction callback (:90) does not undo that, so inside
`if (cancelledIn)` (:98) the variable is `never`. Reproduced in a scratch
file with the same shape under `--strict`: assigning it to a `number`
compiles. The runtime is right today (a failed commit throws before :98,
and only a cancel that changed something sets it), but `start(cancelledIn, ...)`
would accept any argument type, so a later change to `start`'s parameters
or to what is stored there would compile silently.
**Suggested fix:** Return the business from the transaction with the
result (for example `{ result, cancelledIn }`) and read it from there,
or declare it as `let cancelledIn = null as string | null` so the type is
not narrowed away.
**Resolution:** Fixed 2026-10-03: cancelledIn is declared with a cast (null as string | null), so TypeScript keeps its type after the transaction and checks the removal's start. The behaviour is unchanged. Closed 2026-10-03 by independent review of step 7a.4: cancel-booking.ts:31; a probe `const probe: number = cancelledIn` inside `if (cancelledIn)` (:103) fails tsc with "Type 'string' is not assignable to type 'number'", so both starts (:104, :105) are type-checked. No new defect.

### F-126 [P3] closed - The cancel's DTSTAMP lookup and the "only a cancelled booking" guard are not tested

**File:** backend/lib/email/send-cancellation-emails.ts:38-50, :28 (tests: backend/lib/email/send-cancellation-emails.test.ts:327)
**Found:** 2026-10-03 by independent review of step 7a.4 (scope: bea19bc..dfa2d60; lenses: quality, security, performance, tests)
**Why it matters:** The spec's contract (Data / contracts, "The withdrawn
invite") says the invite is stamped with the moment of the cancel, read
from its timeline entry. Two mutations leave all 172 tests in lib/email,
lib/booking, emails and lib/calendar green: stamping with
`context.createdAt` always, and querying `payload->>'booking_id'` (a
broken lookup that silently falls back to the booking's own moment). The
"same invite again" test (:327) only proves the stamp is stable, which the
fallback also is. So the payload JSON query, the one new query in this
step, is never shown to find its entry. Separately, removing
`if (context.status !== "cancelled") return []` (:28) also stays green:
nothing proves a confirmed booking gets no cancellation, which feature 8's
retries will rely on (feature 6 has the mirror test, "a cancelled booking
sends nothing").
**Suggested fix:** In the "sends both" test, read the booking_cancelled
entry's occurredAt and expect the invite to carry `DTSTAMP:` of that
moment (and differ from the booking's createdAt, which the test's real
clock already makes true). Add "a booking still confirmed sends no
cancellation": call sendCancellationEmails on an uncancelled booking and
expect no Resend call.
**Resolution:** Fixed 2026-10-03: the "sends both" test makes the booking a day older, then expects the invite's DTSTAMP to equal the booking_cancelled entry's occurredAt; a new test expects a booking still confirmed to get no cancellation and no Resend call. Always stamping with the booking's moment, a wrong JSON key in the lookup, and dropping the status check each fail a test. The lookup also filters on the contact, which uses the timeline index. Closed 2026-10-03 by the independent review of step 7a.5, which re-read 33fa2f4: stamping always with the booking's createdAt, querying `->>'booking_id'`, and removing the status check each fail exactly one test in send-cancellation-emails.test.ts (9 tests); the new contactId filter is a non-null inner-joined id, so it narrows without hiding the entry. Nothing new found.

### F-127 [P3] closed - logNothingSent is a second export in send-and-record-emails.ts

**File:** backend/lib/email/send-and-record-emails.ts:22
**Found:** 2026-10-03 by independent review of step 7a.4 (scope: bea19bc..dfa2d60; lenses: quality, security, performance, tests)
**Why it matters:** The backend rule in coding-standards.md (:113-114,
Frank, 2026-09-26) is kind, then area, then one file per export, the file
named after it. The refactor put two functions in one file:
`sendAndRecordEmails` and `logNothingSent`, and a reader importing
`logNothingSent` cannot find it by its name. Types beside a function are
the codebase's norm; a second function is not.
**Suggested fix:** Move `logNothingSent` to its own
`backend/lib/email/log-nothing-sent.ts`, or have
`findBookingEmailContext`'s two callers share one small helper file named
for it.
**Resolution:** Fixed 2026-10-03: logNothingSent moved to backend/lib/email/log-nothing-sent.ts; both senders import it from there. Closed 2026-10-03 by the independent review of step 7a.5: log-nothing-sent.ts exports only logNothingSent, send-and-record-emails.ts exports only sendAndRecordEmails beside its two types, and no import of the old location remains.

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

### F-129 [P2] fixed - The confirm step is not announced, and opening it drops keyboard focus

**File:** frontend/components/booking-page/booking-page.tsx:158-167
**Found:** 2026-10-03 by independent review of step 7a.5 (scope: 33fa2f4..78a97a7; lenses: quality, security, performance, tests)
**Why it matters:** Step 7a.5 says "Accessible: the confirm step and the
result are announced". The result is (the aria-live heading and the
`role="alert"` problem), the confirm step is not. Pressing "Cancel this
booking" swaps that button for the `role="group"` block, so the focused
element is removed and focus falls to the page body; the group is not a
live region and nothing moves focus into it. A screen reader user hears
nothing after pressing the button and does not learn that "Cancel this
booking?" with two new buttons appeared. The same happens on "Keep it",
whose button is removed in turn.
**Suggested fix:** When the step becomes "confirm", move focus to the
question or to "Keep it" (the safe choice), for example with a ref and the
same requestAnimationFrame the result uses; when "Keep it" is pressed,
return focus to "Cancel this booking". Optionally put the question inside
the existing polite live region.
**Resolution:** Fixed 2026-10-03: opening the confirm step moves focus to "Keep it" and the question is a status region, so it is read out; "Keep it" puts focus back on "Cancel this booking". Checked by the build and lint; the frontend has no test runner, so no saved test.

### F-130 [P3] fixed - White text on the business's colour has no contrast check

**File:** frontend/components/booking-page/booking-page.tsx:81, :176, :206
**Found:** 2026-10-03 by independent review of step 7a.5 (scope: 33fa2f4..78a97a7; lenses: quality, security, performance, tests)
**Why it matters:** The two main actions ("Yes, cancel it" and "Call
<business>") are white text on `brandColor`, and the only rule on that
colour is `#rrggbb` (shared validation schema and the database check). A
business with a light brand colour, a yellow such as `#facc15`, gets about
1.5:1 contrast, far under WCAG's 4.5:1, so the button that confirms the
cancel is close to unreadable; at `disabled:opacity-60` it is worse. The
emails have the same pattern (EmailButton), so this is a choice made once
for both rather than a page-only slip. The inline `style` it needs is also
the frontend's first, against the "No inline styles" standard, with no
comment saying why.
**Suggested fix:** A small shared helper that picks white or a dark ink
from the colour's relative luminance, used by the page and EmailButton;
or fall back to the neutral ink when white on the brand is under 4.5:1.
Say in a comment that a per-business colour is the one inline style.
**Resolution:** Fixed 2026-10-03: textColorOn (packages/shared/helpers/text-color-on.ts, tested) picks white or dark ink by contrast; the page's two buttons and the emails' EmailButton use it. The page's inline styles carry a comment: the business's colour is data, not a class.

### F-131 [P3] fixed - "Try again" gives no sign it did anything

**File:** frontend/components/booking-page/booking-page.tsx:26-36, :64
**Found:** 2026-10-03 by independent review of step 7a.5 (scope: 33fa2f4..78a97a7; lenses: quality, security, performance, tests)
**Why it matters:** On the unreachable screen, "Try again" bumps `reloads`
but leaves `result` as it was, so the screen does not change while the
request runs, and if it fails again the identical screen stays. Jane
cannot tell a retry happened from a button that does nothing, which is
the moment she is most likely to give up and not cancel.
**Suggested fix:** Clear the result on retry (`setResult(null)` with the
reload), so "One moment…" shows until the new answer arrives.
**Resolution:** Fixed 2026-10-03: "Try again" clears the result first, so "One moment..." shows while it retries. Also from the notes: the logo keeps its shape (object-contain).
