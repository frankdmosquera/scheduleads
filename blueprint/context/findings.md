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

### F-117 [P2] fixed - No test notices the booking page reading another business's time zone, or a person's hours row

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
**Resolution:** Fixed 2026-10-03: the second test business runs on Toronto time and Marco gets a person-level hours row (no zone) after his booking; a new test expects each link to say its own business's zone. The lookup now refuses more than one joined row instead of taking the first, so a join that loses either condition fails deterministically: dropping the business condition or the person-row condition each fails three tests.

### F-118 [P3] fixed - The page's status is typed as any string, not the contract's two values

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
**Resolution:** Fixed 2026-10-03: BookingStatusType is "confirmed" | "cancelled", narrowed once in findBookingPage; any other value is refused, never shown. The typed client carries the union.

### F-119 [P3] fixed - The token's exact construction is not pinned by a known-answer test

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
**Resolution:** Fixed 2026-10-03: a known-answer test pins the exact token for a fixed key and booking id; dropping the purpose prefix now fails it.

### F-120 [P3] fixed - readBookingLinkKey is a line-for-line copy of readTokenKey

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
**Resolution:** Fixed 2026-10-03: readBase64Key(name, value) in packages/shared/crypto/token-cipher.ts holds the check once; readTokenKey and readBookingLinkKey are one-line callers with their own names in the errors.

### F-121 [P3] fixed - Two planning docs still contradict decision 10 and the new route

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
**Resolution:** Fixed 2026-10-03: coding-standards.md gains the signed-link kind of public route (its rules: the id only from a verified signature, every other query on that row's business, one 404, no customer details, never cached, the link never logged or stored); the build log's Rules tab regenerated. The overview drops cancelToken and names the signed link.
