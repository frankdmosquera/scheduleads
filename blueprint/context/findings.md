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

### F-96 [P2] fixed - With the agency's Resend settings in the root .env, the route tests send real login emails and then fail

**File:** backend/routes/admin-routes.test.ts:38 and backend/routes/calendar-routes.test.ts:54 (path: backend/lib/auth/send-login-code.ts:21-32)
**Found:** 2026-10-02 by independent review of step 6.1 (scope: 7dc0721..de30223; lenses: quality, security, performance, tests)
**Why it matters:** Both route test files load the root `.env` and sign in
by reading the code `sendLoginCode` prints. Since 6.1, once `RESEND_API_KEY`
and `LOGIN_EMAIL_FROM` are set there (the same file the app reads, and the
way to try real login emails locally), `sendLoginCode` sends through Resend
instead of printing: every signed-in test user gets a real email from the
agency's account to an `@example.com` address (bounces count against the
agency's sending domain), no code is printed, and the whole file fails.
Reproduced in this review without leaving the machine, by setting both
values plus `RESEND_BASE_URL=http://127.0.0.1:9`: Better Auth logged
"Sending an email failed", the helper threw "No login code was printed for
admin-frank-...@example.com", and all 25 admin route tests were skipped. The
spec's Testing section says no test ever sends a real email.
**Suggested fix:** In both `signIn` helpers (or a shared one), clear the two
settings for the request with `vi.stubEnv("RESEND_API_KEY", "")` and
`vi.stubEnv("LOGIN_EMAIL_FROM", "")` (read per send, so this works), or fake
`fetch` for api.resend.com there.
**Resolution:** Fixed in 6.1's review fixes: admin-routes.test.ts and calendar-routes.test.ts drop RESEND_API_KEY and LOGIN_EMAIL_FROM right after loading .env, so their sign-in helper always reads the code from the console. Shown with RESEND_API_KEY, LOGIN_EMAIL_FROM and RESEND_BASE_URL (a dead local port) set: all 65 route tests pass and nothing is sent.

### F-97 [P2] fixed - A known address now waits for Resend while an unknown one answers at once, so the sign-in form tells who is a client

**File:** backend/lib/auth/auth-server.ts:155-157 (comment at :148-150; send: backend/lib/auth/send-login-code.ts:32)
**Found:** 2026-10-02 by independent review of step 6.1 (scope: 7dc0721..de30223; lenses: quality, security, performance, tests)
**Why it matters:** auth-server.ts says an unknown address is told a code is
on its way "so the form can't be used to test who is a customer". Better
Auth 1.7.5 returns at once for an unknown address, but for a known one it
awaits `sendVerificationOTP` (no `backgroundTasks` handler is set, so
`runInBackgroundOrAwait` awaits it), and since 6.1 that is a round trip to
api.resend.com, hundreds of milliseconds and up to the 10-second limit.
Before 6.1 the known path only printed, so the answer took the same time
either way. One timed request per address now shows whether that person is
one of the agency's clients; the 3-per-minute rate limit slows a sweep but
not a targeted check.
**Suggested fix:** Answer before the email goes: in `sendVerificationOTP`,
start `sendLoginCode` without awaiting it and catch its failure into one safe
log line, or set Better Auth's `advanced.backgroundTasks.handler`. Either way
the owner's experience is unchanged, since a failed send is already swallowed
and answered as success.
**Resolution:** Fixed in 6.1's review fixes: auth-server.ts starts sendLoginCode without awaiting it, logging a failure as a safe reason, so a known address answers as fast as an unknown one. Test: login-code-timing.test.ts holds Resend and gets the 200 first; with the await put back it times out.

### F-98 [P3] fixed - Nothing fails if the login code is written to a log line on the sending path

**File:** backend/lib/auth/send-login-code.test.ts:28 (code: backend/lib/auth/send-login-code.ts:29-41)
**Found:** 2026-10-02 by independent review of step 6.1 (scope: 7dc0721..de30223; lenses: quality, security, performance, tests)
**Why it matters:** The step's plan says the code is never put in a log line
outside development without settings, and the spec's Notes repeat it. In
this review a `console.log` of the code was added just before `sendEmail`
and all 17 email and login-code tests still passed. A debugging line left in
would put live sign-in codes into Railway's logs with nothing to catch it.
**Suggested fix:** In the "goes through the door" test, spy on `console.log`
and `console.error` and assert no call contains the code.
**Resolution:** Fixed in 6.1's review fixes: the sending-path test spies console.log, info, warn and error and fails if the code appears in any line. Proved: a debug console.log of the code makes it fail.

### F-99 [P3] fixed - The sendEmail contract says apiKey is always a string, and the overview still says login codes cannot be sent in production

**File:** blueprint/context/current-feature.md:307; blueprint/context/project-overview.md:220
**Found:** 2026-10-02 by independent review of step 6.1 (scope: 7dc0721..de30223; lenses: quality, security, performance, tests)
**Why it matters:** The code takes `apiKey: string | null` (null meaning
development without a key, as the 6.1 bullet itself describes), but the Data
/ contracts block that 6.6 will build against still types it `string`. The
overview's risk line "Login codes cannot be sent in production until email
exists (item 6)" is no longer true after this step. Both send the next
reader to the wrong shape.
**Suggested fix:** Type the contract's `apiKey` as `string | null` with the
same note as the code; drop or rewrite the overview line when the overview
is next refreshed.
**Resolution:** Fixed in 6.1's review fixes: the spec's sendEmail contract types apiKey as string | null; the overview says login codes go by email from the agency's address and names LOGIN_EMAIL_FROM.
