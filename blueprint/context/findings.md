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

### F-96 [P2] closed - With the agency's Resend settings in the root .env, the route tests send real login emails and then fail

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
**Resolution:** Fixed in 6.1's review fixes: admin-routes.test.ts and calendar-routes.test.ts drop RESEND_API_KEY and LOGIN_EMAIL_FROM right after loading .env, so their sign-in helper always reads the code from the console. Shown with RESEND_API_KEY, LOGIN_EMAIL_FROM and RESEND_BASE_URL (a dead local port) set: all 65 route tests pass and nothing is sent. Closed 2026-10-02 by independent review of step 6.2: admin-routes.test.ts (in this step's scope) and calendar-routes.test.ts still drop both settings before the app loads, and 6.2's new admin tests fake fetch for the key's test email, so nothing leaves the machine; all 393 backend tests pass.

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

### F-99 [P3] closed - The sendEmail contract says apiKey is always a string, and the overview still says login codes cannot be sent in production

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
**Resolution:** Fixed in 6.1's review fixes: the spec's sendEmail contract types apiKey as string | null; the overview says login codes go by email from the agency's address and names LOGIN_EMAIL_FROM. Closed 2026-10-02 by independent review of step 6.2: the contract in current-feature.md (in this step's scope) types apiKey as string | null and still matches send-email.ts, whose SendEmailError keeps the "Sending an email failed: <reason>" message; the overview line names LOGIN_EMAIL_FROM.

### F-100 [P3] fixed - Resend refusals that will never pass on a retry are told as "Try again shortly"

**File:** backend/lib/email/check-email-sending-key.ts:31 (the from line: :41)
**Found:** 2026-10-02 by independent review of step 6.2 (scope: 7e287c0..8e181e9; lenses: quality, security, performance, tests)
**Why it matters:** reasonFor names 401, a code ending in api_key and 403;
every other answer says "Resend could not send the test email just now. Try
again shortly." The installed SDK's own list of codes includes
invalid_from_address and invalid_parameter (422), daily_quota_exceeded and
monthly_quota_exceeded, none of which a retry fixes, so Frank (and in 6.3 the
owner) retries a setup that can never pass, with no hint why. One way to get
there is unverified: the from line puts the business name in unquoted
(`Smith, Jones & Co <bookings@...>`), and a comma or angle bracket in a
display name is not a valid address header unless quoted; the business name
schema allows both.
**Suggested fix:** Keep "try again shortly" for the timeout, the 429 rate
limit and 5xx only; answer invalid_from_address and the other 422s as a
problem with the sender address, and the quotas as the Resend account's
sending limit. Quote the display name (escaping `"` and `\`) in the from
line, which 6.6 will build the same way.
**Resolution:** Fixed in 6.2's review fixes: a sending limit and a sender address Resend will not take (422, invalid_from_address) now get their own plain reasons; only what a retry can fix says to try again. The business name is quoted in the from line (format-sender.ts), so a name with a comma or an ampersand stays one name. Tests: the two new refusals, and a name with a comma, an ampersand and quotes.

### F-101 [P3] closed - An unreadable saved key blocks saving the new key that would replace it

**File:** backend/lib/email/save-email-sending-key.ts:16 (decrypt: backend/lib/email/find-business-email-details.ts:51)
**Found:** 2026-10-02 by independent review of step 6.2 (scope: 7e287c0..8e181e9; lenses: quality, security, performance, tests)
**Why it matters:** saveEmailSendingKey starts by calling
findBusinessEmailDetails, which unlocks the stored key. When that key cannot
be unlocked (CALENDAR_TOKEN_KEY changed, or a row restored onto another
business, which email-sending-key.test.ts shows throws), the save throws
before the test email, so pasting a new key in the 6.3 card, the only way to
repair it, fails with a 500 every time. The calendar code treats keys it
cannot open as replaceable (hand-back-calendar-permission.ts returns
"not_confirmed" instead of throwing).
**Suggested fix:** Read only the name and the two addresses in
saveEmailSendingKey (a select of its own, or a reader option that skips the
key); the old key is overwritten, never needed.
**Resolution:** Fixed in 6.2's review fixes: saveEmailSendingKey reads only the name and the two addresses, never the stored key, so a key that can no longer be unlocked is still replaced. Test: a broken stored key is replaced by a new one. Closed 2026-10-02 by independent review of step 6.3: save-email-sending-key.ts is gone, and its successor backend/lib/email/save-email-sending.ts (in this step's scope) opens the saved key only when no new key is pasted (keyToTest returns a new key first), so a new key still replaces one that cannot be unlocked; with no new key, an unreadable one is answered "Paste it again" instead of a 500. Both cases are tests in email-sending-key.test.ts and pass.

### F-102 [P3] fixed - The test of a wrong key fakes 401, so the branch that catches Resend's real wrong-key answer is untested

**File:** backend/lib/email/check-email-sending-key.test.ts:49 (code: backend/lib/email/check-email-sending-key.ts:24)
**Found:** 2026-10-02 by independent review of step 6.2 (scope: 7e287c0..8e181e9; lenses: quality, security, performance, tests)
**Why it matters:** Resend answers an invalid key with invalid_api_key and
status 403, the same status as an unverified domain, so it is the
`error.code.endsWith("api_key")` half of the condition that keeps a wrong key
from being told to verify its domain. In this review that half was deleted
and all 42 tests in check-email-sending-key, email-sending-key and
admin-routes still passed (reverted after).
**Suggested fix:** Add a case with name invalid_api_key and status 403
expecting "Resend refused this key.", and keep the 401 case for a missing or
restricted key.
**Resolution:** Fixed in 6.2's review fixes: the error name is checked first, and the wrong-key test now fakes Resend's real answer (invalid_api_key with 403), beside a missing key (401). Proved: without the name check the 403 test fails.

### F-103 [P3] fixed - A phone of only spaces shows Zod's raw English under the field

**File:** packages/shared/zod-validation/organization-validation-schemas/business-email-details-validation-schema.ts:15
**Found:** 2026-10-02 by independent review of step 6.2 (scope: 7e287c0..8e181e9; lenses: quality, security, performance, tests)
**Why it matters:** The phone is trimmed, then `.min(1)` has no message, so
"   " is refused with "Too small: expected string to have >=1 characters"
(seen in this review through the built schema), and the 3b form shows that
under Phone, unlike every other field's plain message.
**Suggested fix:** Give `.min(1, ...)` a plain message, or treat a phone of
only spaces as empty, the way the other optional fields read.
**Resolution:** Fixed in 6.2's review fixes: a phone of only spaces answers "Enter a phone number, or leave it empty." Test added.

### F-104 [P3] fixed - A refusal about the sender address is shown under the key field, even when no key was pasted

**File:** frontend/lib/api-client.ts:236 (refusal: backend/routes/email-sending-routes.ts:53; focus: frontend/components/email-sending/email-sending-card.tsx:119)
**Found:** 2026-10-02 by independent review of step 6.3 (scope: 41d8fd8..5e79646; lenses: quality, security, performance, tests)
**Why it matters:** Every reason from the test email comes back as one code,
`key_refused`, and saveEmailSending puts every `key_refused` under the
"Resend key" field and focuses it. Two of those reasons are about the
address, not the key: "Resend would not send from this address..." (a 403
for an unverified domain) and "Resend would not accept this sender
address...". Decision 9's own case shows it: an owner with a key saved
changes "Emails come from" to a new domain and leaves the key empty; the
refusal (the one email-sending-key.test.ts asserts for exactly this case)
lands in red under the empty key field, so the owner is pointed at the key
and may paste a new one, when the fix is the sender's domain.
**Suggested fix:** Let the backend say which field a reason is about (a
second code such as `sender_refused`, or a `field` on the refusal), and put
sender refusals under "Emails come from" and account-wide ones (the sending
limit, "try again shortly") in the card's notice.
**Resolution:** Fixed in 6.3's review fixes: checkEmailSendingKey now says what a refusal is about (the key, the sender, or neither), and both forms get a code for each: key_refused under the key field, sender_refused under "Emails come from", email_test_failed as a notice (email-refusal-code.ts). Tests: each refusal's subject in the check's table; a sender refusal on the card answers sender_refused.

### F-105 [P3] fixed - Nothing fails if the Email sending routes lose their plan checks

**File:** backend/routes/email-sending-routes.test.ts:154 (checks: backend/routes/email-sending-routes.ts:23-24, :35-36)
**Found:** 2026-10-02 by independent review of step 6.3 (scope: 41d8fd8..5e79646; lenses: quality, security, performance, tests)
**Why it matters:** Both routes mount requireKnownSubscriptionMiddleware and
requireModuleMiddleware("booking"), like the calendar card's routes. In this
review both were removed from GET and PUT and all 18 tests in
email-sending-routes.test.ts and email-sending-key.test.ts still passed
(reverted after). calendar-routes.test.ts proves the same checks with a
business on a plan without booking (a 403); here a later edit could let a
business without the booking module set up sending, with nothing to catch it.
**Suggested fix:** Add the calendar tests' no-booking tenant (an
unrecognised plan stands in until a real tier lacks booking) and expect 403
from GET and PUT, with no test email asked for.
**Resolution:** Fixed in 6.3's review fixes: a business on a plan without booking is refused reading and saving the card, with nothing sent. Proved: with both plan checks removed the test fails. The booking check alone cannot be told apart from the known-plan check until a real tier lacks booking (feature 23), as on the calendar card.

### F-106 [P3] fixed - A step number in a code comment, and the spec still names the removed save-email-sending-key.ts

**File:** backend/middleware/dashboard-middleware/dashboard-cors-middleware.ts:12; blueprint/context/current-feature.md:297
**Found:** 2026-10-02 by independent review of step 6.3 (scope: 41d8fd8..5e79646; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md says no history in code comments,
step numbers named first; the new CORS comment ends "(6.3)". The spec's
Files / areas list, which /complete and later steps read, still names
`save-email-sending-key.ts`, removed in this step, and not
`save-email-sending.ts` or `find-email-sending-state.ts`, which replaced it.
**Suggested fix:** Drop "(6.3)" from the comment (the reason, saving the
Email sending card, can stay). In Files / areas, name the two new files in
place of the removed one.
**Resolution:** Fixed in 6.3's review fixes: the step number is out of the CORS comment, and the spec's Files / areas names the files that replaced save-email-sending-key.ts.

### F-107 [P2] fixed - The invite's UID changes when the business changes its sender address

**File:** backend/lib/email/booking-ics.ts:18-20, :28 (the plan: blueprint/context/current-feature.md, step 6.4)
**Found:** 2026-10-02 by independent review of step 6.4 (scope: adb473e..6febd01; lenses: quality, security, performance, tests)
**Why it matters:** The UID is the booking id plus the domain of
`senderEmail`, and that address is editable: the owner's card saves a new
one (backend/lib/email/save-email-sending.ts:78, decision 9), and decision 6's
handover changes it by design (Frank builds with a test sender of his own,
the owner then sets their own). A booking confirmed before the change and
moved or cancelled by feature 7 after it would carry a different UID, so the
customer's calendar would get a second event instead of moving the first.
The step's own promise ("the UID is the same for one booking every time")
is only tested against a different DTSTAMP (booking-ics.test.ts:93), never a
different sender.
**Suggested fix:** Build the UID from the booking id alone (already a
`randomUUID()` in book-time.ts:281, so globally unique; RFC 5545 does not
require an `@domain`), or from a part that never changes and never names the
product. Amend step 6.4's UID line in the spec to match, and add a test that
a different `senderEmail` gives the same UID.
**Resolution:** Fixed 2026-10-02: the UID is now the booking's own id alone
(a random UUID), never the sender's domain; the spec's step 6.4 line amended
to match. The UID test also expects the same UID from a different sender, and
the exact-text test reads `UID:bk_123`. Putting the domain back fails two tests.

### F-108 [P3] fixed - The fold tests never fill a continuation line or carry an emoji

**File:** backend/lib/email/booking-ics.test.ts:73-91 (code: backend/lib/email/booking-ics.ts:67-89)
**Found:** 2026-10-02 by independent review of step 6.4 (scope: adb473e..6febd01; lenses: quality, security, performance, tests)
**Why it matters:** Two mutations in this review left all 6 tests passing
(both reverted). Raising the continuation limit from 74 to 75, which writes
76-octet lines, passed because the longest folded line in any test, the
Spanish SUMMARY, is 143 octets: 75 on the first line and 69 on the second,
so no continuation ever reaches the limit. Iterating UTF-16 code units
instead of characters (`line.split("")`) also passed, though the comment at
booking-ics.ts:69-70 promises an emoji arrives whole; only the two-octet "ó"
is tested. The code itself is right today (probed: an emoji at the boundary
moves whole, continuation lines are exactly 75 octets).
**Suggested fix:** Make the Spanish (or another) value long enough for at
least one full continuation line and expect a line of exactly 75 octets
starting with a space; add a case with a four-octet emoji at the fold
boundary that expects it whole on the next line.
**Resolution:** Fixed 2026-10-02: two new tests, a continuation line filled to
exactly 75 octets with its leading space, and a four-octet emoji at the fold
point moving whole to the next line. Both mutations above (continuation limit
75, iterating UTF-16 code units) now fail a test.

### F-109 [P3] fixed - Control characters typed in the address reach the invite's LOCATION raw

**File:** backend/lib/email/booking-ics.ts:54-60 (input: packages/shared/zod-validation/booking-links-validation-schemas/create-booking-validation-schema.ts:22-26)
**Found:** 2026-10-02 by independent review of step 6.4 (scope: adb473e..6febd01; lenses: quality, security, performance, tests)
**Why it matters:** The booking form's address only trims and limits
length, so a customer's typed address can hold control characters. Probed on
the built function: an address of `12 Main<NUL>St<VT>Back<BEL>` comes out as
`LOCATION:12 Main<NUL>St<VT>Back<BEL>`. RFC 5545's TEXT allows no control
character but a tab, so the attached invite is invalid and a strict parser
may refuse all of it (a NUL can also cut the file short in C-based readers).
No line can be injected: CR and LF are escaped. `quoteParameter` already
strips controls from the two names; `escapeText` does not. A lone CR is
handled but untested (removing `\r` from the regex left every test passing).
**Suggested fix:** In `escapeText`, after the new-line escape, replace any
remaining C0 control except tab, and DEL, with a space, as `quoteParameter`
does; add a lone `\r` and a `\u0000` to the escape test.
**Resolution:** Fixed 2026-10-02: `escapeText` replaces any control character
left after the new-line escape, except a tab, with a space. The escape test
now carries a lone `\r` and a `\u0000`; dropping the lone CR from the
new-line escape fails it.

### F-110 [P3] fixed - The email tests run only in Edmonton, the laptop's own zone, so a template that ignores the business's zone passes

**File:** backend/emails/booking-emails.test.ts:9-28 (code: backend/emails/booking-confirmation.tsx:19, backend/emails/booking-notification.tsx:19)
**Found:** 2026-10-02 by independent review of step 6.5 (scope: 67aaa74..fbaf9d3; lenses: quality, security, performance, tests)
**Why it matters:** Every email test uses a business in `America/Edmonton`,
and this laptop's own zone is `America/Edmonton`. Two mutations in this
review left all 14 tests passing (both reverted): the confirmation calling
`formatBookingTime` with a hard-coded `"America/Edmonton"`, and the
notification calling it with the server's zone. The formatter's own test
catches a formatter that drops its zone, but nothing ties the templates to
`facts.business.timezone`, which is the step's Done when ("the time in the
business's zone"); on Railway (UTC) a server-zone slip shows every booking
six hours off. Two notification mutations also survived: the "Call <customer>"
button pointed at `#` (the test titled "with a tel: link and button" is met
by the Phone link alone), and the brand colour ignored.
**Suggested fix:** Render each email once for a business in another zone
(`America/Toronto`: expect "11:00 a.m. EDT" in the subject and the text). In
the notification test expect the `tel:` href twice (link and button) and the
brand colour.
**Resolution:** Fixed 2026-10-02: each email is also rendered for a Toronto business and must read 11:00 a.m. EDT in its subject, HTML and text; the notification test expects the tel: link twice (line and button) and the brand colour. All four mutations above now fail a test.

### F-111 [P3] fixed - The confirmation's plain-text twin never names the business when it has a logo and no phone

**File:** backend/emails/email-layout.tsx:46-67 (also backend/emails/booking-confirmation.tsx:36-45, 68-83; backend/emails/booking-notification.tsx:85-101)
**Found:** 2026-10-02 by independent review of step 6.5 (scope: 67aaa74..fbaf9d3; lenses: quality, security, performance, tests)
**Why it matters:** React Email's plain-text render skips images, so the
logo, whose alt text is the business's name in the HTML, leaves nothing in
the text. The name then appears only in the "Call <business>" button (only
with a phone) or the footer (only without a website). Probed: a business with
a logo, a website and no phone gets a text body that never says who the
booking is with. Smaller, same twin: single line breaks in the customer's
words, kept in the HTML by `pre-line`, are joined into one line in the
notification's text ("Two storeys, stucco. South side peeling."). The subject
and the From name still carry the business, hence P3.
**Suggested fix:** Name the business once in the body whatever it has (for
example "Here are the details of your booking with Primo Painters."), and add
a test with a logo and no phone that expects the name in the text. The
line-break loss can be accepted or the fixture given a single line break.
**Resolution:** Fixed 2026-10-02: the confirmation's opening line names the business ("Primo Painters has you booked."), tested for a business with a logo and no phone. The customer's single line breaks are now <br /> instead of pre-line, so they survive in the plain-text twin too, tested. Both changes reverted fail a test.

### F-112 [P3] fixed - Step numbers in two code comments

**File:** backend/emails/booking-email-facts-type.ts:1-2, backend/emails/booking-notification.tsx:3
**Found:** 2026-10-02 by independent review of step 6.5 (scope: 67aaa74..fbaf9d3; lenses: quality, security, performance, tests)
**Why it matters:** "Step 6.6 reads it from the database" and "Reply-to is
the customer (step 6.6)". The coding standards' Comments section rules out
step numbers in code comments (they belong in the build log); F-106 was the
same kind of slip.
**Suggested fix:** "Read from the database inside the booking's own
business" and "Reply-to is the customer, set where the email is sent".
**Resolution:** Fixed 2026-10-02: both comments reworded without step numbers.
