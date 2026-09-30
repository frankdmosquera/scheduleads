# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-12 [P2] open - Comments still describe open signup, self-serve business creation and server-side validation the code does not have

**File:** frontend/app/sign-in/page.tsx:17
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** The F-05 repair changed the security model and updated the
comments beside the two lines it touched, but not the ones that describe the
same model elsewhere. This project treats its comments as the record of why
(`coding-standards.md`, Comments), so a comment stating the model backwards is
a wrong instruction to the next item, and items 3b and 25 are the ones that
will read these files to change exactly this behaviour.

- `sign-in/page.tsx:17-20` says the emailOTP plugin "creates the account on
  first successful code, so this one screen is both sign-in and sign-up". The
  opposite is true since `disableSignUp: true` (`backend/src/lib/auth.ts:232`),
  and the same file says so correctly at lines 63-71.
- `sign-in/page.tsx:107-109`, `app/page.tsx:129-131` and
  `create-organization/page.tsx:13` describe a user with no business being sent
  to create their first one. Only the platform admin may create a business
  (`auth.ts:174-175`); an ordinary user is refused there (see F-13).
- `sign-in/page.tsx:43-44` ("the same schema the API validates against") and
  `packages/shared/src/validation/auth.ts:6-7` ("the API validates the same
  values a second time") claim server-side use of the shared schemas. Nothing
  under `backend/src` imports `@scheduleads-app/shared/validation`; Better Auth
  validates with its own rules (`z.email()` in `email-otp/routes.mjs:95`,
  `min(1)` for an organization name in `crud-org.mjs`).
- `backend/src/lib/auth.ts:184-190` says a `plan` sent on organization update
  "throws". Read off better-auth 1.7.5, it is silently dropped instead:
  `toZodSchema` omits `input: false` fields client-side (`db/to-zod.mjs:7`), the
  `data` object strips unknown keys, and better-call replaces the body with the
  parsed value (`better-call/dist/validator.mjs:17`). Still safe, but the comment
  tells a reader that an update returning 200 would have been refused. Not
  observed live, since it needs a signed-in owner.

**Suggested fix:** Rewrite those comment lines to match the code: sign-in only,
no self-serve business creation, the shared schemas used by the forms only
until a route owned by this API validates with them, and `plan` silently
discarded on both create and update.
**Resolution:**

### F-13 [P3] open - A signed-in user with no business is sent to a create form that can only refuse them, with no way to sign out

**File:** frontend/app/page.tsx:155
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** `PickOrganization` sends any user whose organization list is
empty to `/create-organization` (`page.tsx:155-157`). Since the F-05 repair only
a platform admin can create one, so every ordinary user who lands there gets
Better Auth's "You are not allowed to create a new organization" on submit, and
`create-organization/page.tsx` renders no sign-out control, unlike every other
signed-in state. Reachable today through the provisioning path the spec itself
names: until item 3b, "a new user row is a manual database act"
(`auth.ts:227-230`), so a user created before their membership, or one whose
only business is deleted, lands on a dead end. Read off the code, not observed
live; Frank's walkthrough saw the refusal message itself for
`owner@example.com`.

**Suggested fix:** When the list is empty and the user is not a platform admin,
render an `AuthCard` saying the account has no business yet and to contact the
agency, with `SignOutLink`. Add a sign-out control to the create page as well.
**Resolution:**

### F-14 [P3] open - The sign-in and create-business forms bypass the project's form standard without saying so

**File:** frontend/components/auth-card.tsx:240
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** `coding-standards.md` (Forms) says to use shadcn `Input` and
`Label` and to wire forms with react-hook-form. Both forms in this feature use
`useState` and a hand-written `Field`, and `frontend/components/ui/` holds only
`button.tsx`. That may well be the right call for two one-field forms, but the
workspace rule "Do it the right way, out loud" requires the deviation to be
named when it is taken, and neither the spec preamble nor the build log
records it. Item 2 onward builds real forms and will copy whichever pattern it
finds.

**Suggested fix:** Either move both forms onto shadcn `Input`/`Label` with
react-hook-form (both already dependencies), or record the choice and its
reason in the spec preamble and build log so the next form knows which pattern
is the standard.
**Resolution:**

### F-16 [P3] open - Better Auth endpoints already open two paths the spec reserves for later items

**File:** backend/src/lib/auth.ts:85
**Found:** 2026-09-23 by /audit (scope: current; lens: security)
**Why it matters:** Neither is a breach, since signup is closed and both need a
consenting existing user or an existing platform admin, but each contradicts a
written contract and is live over HTTP today.

- The `owner` role is granted `invitation: ["create", "cancel"]`
  (`auth.ts:88`), so `/organization/invite-member` and
  `/organization/accept-invitation` (`organization/routes/crud-invites.mjs:42`,
  `:246`) work now. An owner can invite any existing user, and if they accept
  they join a second business. The spec's Out of scope reserves "any path at
  all that puts a client user inside a business" for item 3b, and a second
  membership is what drives a user into the pick-a-business state.
- `admin()` exposes `/admin/set-role` and `/admin/create-user`
  (`admin/routes.mjs:43`, `:133`) to any platform admin. The spec's data
  contract says no request path may write `user.role` before item 23, and
  `auth.ts:131-132` and `schema.ts:52-55` say promotion is a manual database
  edit and nowhere else.

**Suggested fix:** Give `owner` and `admin` an empty `invitation` list until
item 3b decides the invitation flow, and correct the `user.role` contract and
comments to say a platform admin can set it through the admin plugin's
endpoint, or record either as accepted with the reason.
**Resolution:**

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

### F-34 [P3] open - Three config comments carry history the comment standard keeps out of code

**File:** backend/tsconfig.types.json:2
**Found:** 2026-09-28 by /audit independent (scope: current; lens: quality)
**Why it matters:** `coding-standards.md` (Comments, "The balance") says no
history in code comments, naming step numbers as the first example: that lives
in the build log. This feature added `backend/tsconfig.types.json:2` ("AppType,
step 2.5"), `backend/tsconfig.json:14` and `packages/shared/tsconfig.build.json:3`
("No src/ folder (Frank, 2026-09-26)"). The Sep 27 comment sweep covered the
code files, not the tsconfigs. Harmless at runtime; it is the pattern the next
config file copies.
**Suggested fix:** Drop "step 2.5" and the two "(Frank, 2026-09-26)" asides and
keep the why ("declarations only, because Vercel builds only the frontend"; "no
src/ folder, so the code sits beside the build output").
**Resolution:**

### F-35 [P3] closed - On a renamed seeded business the backfill links a worker to the owner, and the seed then crashes

**File:** packages/shared/migrations/0004_calendar_connection.sql:51
**Found:** 2026-09-28 by /audit independent (scope: step 3.1; lens: all)
**Why it matters:** When no person carries the business's current name, the
backfill falls back to the oldest person, and on seed-made data every person
shares one `createdAt`, so the pick is the lowest random id. Reproduced on a
throwaway database at 0003 holding a seed-shaped `painting-dev` whose business
had been renamed ("Summit Painting"): migration 0004 linked
`admin@example.com` to "Marco (estimator)", and the next `db:seed` then
aborted with `resource_organization_user_unique`, because its link at
`scripts/seed-dev.ts:330` targets the person named after the business while the
login is already on another person in that business. An owner can rename a
business today (the `owner` role has `organization: ["update"]`), though no
screen offers it. Production is not affected in practice: a real first person
was made by 0001 or the hook, before anyone else, so "oldest" is right there.
All other edge cases behaved: two owners and a business with only places stay
unlinked, the person beats an older place of the same name, the named person
beats an older one, and a renamed business with real ages links the oldest.
**Suggested fix:** Either link in the migration only when a person carries the
business's name (leave the rest unlinked, as for two owners, which is what the
comment's "rather than guess" promises), or have the seed skip the link with a
printed note when the login is already on another person in that business.
**Resolution:** Fixed 2026-09-28 on Frank's yes, the first option: migration
0004 links only a person named after the business, oldest breaking a tie
between two of that name; no such person leaves the business unlinked. 0004
had only run on the local dev database (with the right result), so it was
corrected before reaching Railway. Proved on a throwaway database at 0003 with
a renamed seed-shaped business: the fixed 0004 left it unlinked, linked the
clinic's named person over a same-instant colleague, and the next db:seed
linked the named person and finished; the committed 0004 (9eba7b5) on the same
data linked "Marco (estimator)". Throwaway database dropped.
Closed 2026-09-28 by /audit independent (scope: step 3.2, re-examining 7c6b593):
the backfill at lines 38-55 now picks only a person whose name equals the
business's name, oldest then id breaking a tie, and joins it to a business with
exactly one owner; a renamed business matches no row and stays unlinked, so the
guess is gone and the seed's link to the named person can no longer collide.
The repair adds nothing new: the unique index and the person-only check above
it are unchanged, and the shared and backend tests pass.

### F-36 [P3] closed - Two comments in this step break the comment standard

**File:** .env.example:63
**Found:** 2026-09-28 by /audit independent (scope: step 3.1; lens: quality)
**Why it matters:** `coding-standards.md` (Comments, "The balance") keeps
history out of code comments and most comments to one or two lines. This step
rewrote the `WIDGET_ORIGINS` note to "Read by the public routes since step
2.4" (history, a step number), and grew the `afterCreateOrganization` comment
(`backend/lib/auth/auth-server.ts:105-109`) to five lines covering three
separate points. Harmless at runtime; it is the pattern the next edit copies,
as F-34 found for the tsconfigs.
**Suggested fix:** "Read by the public booking routes." for the first. For the
hook, keep two lines beside the code: why the person is named after the
business and linked to the owner, and why it sits outside the create
transaction; the note about item 3b fits in one short clause or the build log.
**Resolution:** Fixed 2026-09-28, half by change and half by clarifying the
rule with Frank. The `.env.example` note now reads "Read by the public booking
routes." with no step number. The hook comment stays: Frank clarified that the
comment rule is a guide, not a line count (comments only where they help,
beside their line, as long as needed), and those lines each explain a why at
the line they describe. `coding-standards.md` "The balance" now says so.
Closed 2026-09-28 by /audit independent (scope: step 3.2): `.env.example:63`
reads "Read by the public booking routes." with no step number, and the step
3.2 edits to the same file carry none either. The hook comment in
`auth-server.ts` is unchanged and, under the clarified rule ("a guide, not a
line count"), each of its lines explains a why beside the code it describes,
so it no longer breaks the standard. Kept on Frank's call, not the reviewer's.

### F-37 [P3] open - Switching to another Google account leaves the old account's permission live at Google

**File:** backend/lib/calendar/save-calendar-connection.ts:44
**Found:** 2026-09-28 by /audit independent (scope: step 3.2; lens: security)
**Why it matters:** When a person connects again, the new tokens simply
overwrite the old ones. If the second connect is a different Google account
(the saved test "a reconnect replaces the row" does exactly that), the first
account's permission is never handed back: Google still lists the app under
that account's third-party access, and we no longer hold the token that could
remove it, so step 3.4's Disconnect cannot either. Nothing leaks (we threw the
old token away), but the owner is left with a permission they cannot see from
the dashboard. Today the card only offers Connect when there is no connection,
so this is reached by the API or by 3.4's Reconnect.
**Suggested fix:** In the save (or in `finish-google-connect.ts` just before
it), read the existing row; when its account email differs from the new one,
open the old credentials and hand the old refresh token back, best effort,
after the new row is saved. Leave the same-account case alone: that is one
permission at Google, and revoking it would kill the new tokens too.
**Resolution:** Carried to step 3.4 on Frank's call, 2026-09-29: it belongs with Disconnect and Reconnect, which 3.4 builds. Written into 3.4's plan and Done when in the spec.

### F-38 [P3] closed - When Google refuses a connect, nobody can see why

**File:** backend/lib/calendar/finish-google-connect.ts:55
**Found:** 2026-09-28 by /audit independent (scope: step 3.2; lens: quality)
**Why it matters:** Every way the trip back from Google can go wrong ends in
the same "failed" and nothing is written anywhere. The code swap's error
(`Google refused the code swap (401)`, a wrong secret or redirect) is thrown
away at line 55, a failed save at line 83, and anything unexpected at
`calendar-routes.ts:89`. The owner sees "try again in a minute", and the
person fixing it has no clue whether it was the client secret, the redirect
address, the token key or the database. The step's own by-hand connect needed
a redirect fix; the next one on Railway will have only this.
**Suggested fix:** One `console.warn` at each of those three catches with the
outcome and Google's HTTP status or error code (`invalid_client`,
`invalid_grant`), never a token or the code itself.
**Resolution:** Fixed 2026-09-29 on Frank's yes. Every "failed" path of the callback now leaves one line, `[calendar] connect failed at <step>: <reason>`, through `backend/lib/calendar/warn-connect-failed.ts`: Google's error other than Cancel, no code, the code swap (now carrying Google's own code word, e.g. `400 invalid_grant`, never its free text), the token check (no refresh token, or a sign-in token refused), the save, and the route's last catch. A database error is logged as its Postgres code only, because its message carries the query and its values. Denied, expired and missing permission are the person's own doing and log nothing. Tests: each failed route test checks its exact line, the full consent checks there is none, every test checks no token or locked value reaches a warning, and a unit test checks a failed query logs only `database error 23505`. Five faults planted (raw message logged, swap line removed, Google's word dropped, save line removed, a token put in a line), each caught. 63 backend tests pass. Waits for the next review to close.
Closed 2026-09-30 by /audit independent (scope: step 3.3, re-examining f9601b3): every failed path in `finish-google-connect.ts` (Google error, no code, the code swap, the token check, the save) and the route's last catch (`calendar-routes.ts:91`) still leaves one `[calendar] connect failed at ...` line. Step 3.3 moved the reason logic into `safe-error-reason.ts` unchanged (a failed query still logs only its Postgres code), and `warn-connect-failed.test.ts` plus the route tests that check each exact line and that no secret reaches a warning still pass. Nothing new introduced.

### F-39 [P3] closed - The Google identity check and three give-up paths have no saved test

**File:** backend/lib/calendar/google-oauth-client.ts:110
**Found:** 2026-09-28 by /audit independent (scope: step 3.2; lens: tests)
**Why it matters:** `readIdentity` decides which Google address is saved and
shown on the card, and refuses a sign-in token meant for another app, from
another issuer or with an unverified address. No test sends any of those, so
removing the audience or `email_verified` check would pass the whole suite.
The same holds for three other paths in `finish-google-connect.ts`: the person
unlinked from the login during the ten minutes at Google (line 51, should be
`expired`), a Google error other than Cancel (line 35, `failed`), and a save
that fails (line 83, tokens handed back). Separately, the "connection comes
without the tokens" test (`calendar-routes.test.ts:383`) only passes because
the reconnect test above it ran first, so running it alone fails.
**Suggested fix:** Add route tests with the fake token answer carrying a wrong
`aud`, a wrong `iss` and `email_verified: false` (each ends in `failed`, hands
the token back, saves nothing), plus one each for the unlinked person and
`error=server_error`. Have the connection test make its own connection first.
**Resolution:** Fixed 2026-09-28 on Frank's yes, tests only (`backend/routes/calendar-routes.test.ts`). Six new route tests: a sign-in token for another app, from another issuer, or with an unverified email each end in `failed`, hand the refresh token back and save nothing; a person unlinked during the trip ends in `expired`; `error=server_error` ends in `failed` and uses the ticket up; a save that fails (the lock given a bad key for that one call) hands the tokens back and ends in `failed`. The connection and reconnect tests now make their own connections, and every test starts with Ana unconnected (a `beforeEach` delete), so none depends on another: each passes run alone. Proved: six faults planted one at a time (audience, issuer and verified-email checks removed, the person re-check removed, every Google error treated as Cancel, no hand-back after a failed save), each failing exactly its own test and nothing else; files restored and compared. 61 backend and 42 shared tests, both builds, lint and format pass. Waits for the next review to close.
Closed 2026-09-30 by /audit independent (scope: step 3.3): the six tests are in `calendar-routes.test.ts:358-411` and assert the outcome, the hand-back, that nothing is saved and the exact warning; the connection and reconnect tests make their own connections and a `beforeEach` clears Ana's, so none depends on another. Step 3.3 only swapped the file's database guard for the shared one. 79 backend tests pass.

### F-40 [P3] open - The card's list of outcomes is not tied to the API's, and a made-up one shows an empty red box

**File:** frontend/components/calendar/calendar-connection-card.tsx:17
**Found:** 2026-09-28 by /audit independent (scope: step 3.2; lens: quality)
**Why it matters:** `OUTCOMES` is a plain `Record<string, ...>` looked up with
whatever `?calendar=` says (line 71). An inherited name such as
`/?calendar=constructor` finds a built-in function, so the card shows an empty
error box. Harmless, but it also means the five words are typed only on the
backend (`ConnectOutcomeType`): rename one there and the card silently shows
nothing, and the build does not notice. The spec already disagrees on one of
them (see F-41).
**Suggested fix:** Type the map's keys as the five outcomes and look up with
`Object.hasOwn(OUTCOMES, outcome)`; ideally the outcome list lives once in
`packages/shared` so both sides import it.
**Resolution:** Carried to step 3.4 on Frank's call, 2026-09-29: 3.4 reworks the card's states anyway. Written into 3.4's plan and Done when in the spec.

### F-41 [P3] closed - The spec's contracts still describe the shapes step 3.2 changed

**File:** blueprint/context/current-feature.md:374
**Found:** 2026-09-28 by /audit independent (scope: step 3.2; lens: quality)
**Why it matters:** Steps 3.3 and 3.4 build on the Data / contracts section,
and three lines there no longer match the code: the Routes table names the
Cancel outcome `declined` while the API and card say `denied` (line 374); the
cipher is still written with two arguments, without the person it is now
sealed to (line 326), which 3.3 needs to open the tokens; and the ticket is
said to be used up by id alone (line 320), while the code (rightly) also
requires the same login and an unexpired ticket. The project's rule is that a
wrong spec is corrected before the next step builds on it.
**Suggested fix:** Update those three lines to match the code before 3.3's
plan is written.
**Resolution:** Fixed 2026-09-28 on Frank's yes, docs only. The spec's
outcomes now say `denied`; the cipher signatures carry `boundTo` (the
connection's `resourceId`, sealed in as GCM additional data) and "another
person" joins the refusals; the ticket is used up by one DELETE on its
fingerprint, the session's user and an unexpired `expiresAt`. Found on the way
and fixed with it: the Google section still said the events scope "is checked
before it is written"; it now names `calendar.events.owned`. The build log's
Contracts row for the lock says the same. Waits for the next review to close.
Closed 2026-09-30 by /audit independent (scope: step 3.3): the spec's Data / contracts now say `denied` (outcomes list and Routes), the cipher signatures carry `boundTo`, the ticket is used up by one DELETE on fingerprint, session user and `expiresAt`, and the Google section names `calendar.events.owned`. All match the code read in this pass.

### F-42 [P3] closed - Two names in the calendar folder read differently from their neighbours

**File:** backend/lib/calendar/use-oauth-ticket.ts:18
**Found:** 2026-09-28 by /audit independent (scope: step 3.2; lens: quality)
**Why it matters:** The folder spells the same word two ways:
`googleOAuthClient` beside `createOauthTicket`, `useOauthTicket`,
`oauthStateFingerprint` and the `calendarOauthState` table. And
`useOauthTicket` starts with `use`, which in this repo's frontend means a
React hook; read from an import line it looks like one. Frank reviews names,
and these are the ones 3.3 and 3.4 will import next to them.
**Suggested fix:** One spelling across the folder (`Oauth`, matching the table
whose name costs a migration to change), and a verb that says what happens,
such as `redeemOauthTicket` in `redeem-oauth-ticket.ts`.
**Resolution:** Fixed 2026-09-29 on Frank's yes: `googleOAuthClient` is `googleOauthClient`, matching the table and every other `Oauth` name; `useOauthTicket` is `redeemOauthTicket` in `redeem-oauth-ticket.ts` (its type `RedeemedOauthTicketType`), so it no longer reads like a React hook. The spec follows. The code drawers on the build log keep the old names: they show the step as committed. Waits for the next review to close.
Closed 2026-09-30 by /audit independent (scope: step 3.3): no `googleOAuthClient`, `useOauthTicket` or `use-oauth-ticket` is left in backend, frontend or shared source; the folder spells `Oauth` throughout, and step 3.3's new files import `googleOauthClient` under that name.

### F-43 [P3] open - Two of the busy-times safeguards can be deleted and every test still passes

**File:** backend/lib/calendar/get-busy-times.ts:72
**Found:** 2026-09-30 by /audit independent (scope: step 3.3; lens: tests)
**Why it matters:** The step promises two things the tests do not hold in
place. First, when Google refuses a refresh at the same moment the owner
reconnects, the fresh connection must not be marked "needs reconnecting". The
code guards this (the mark only touches the row as it was read, then reads it
again), but the only same-moment test uses a refresh Google accepts, so
changing line 72 to match the row by id alone passes all 79 tests. The owner
would reconnect and immediately be told to reconnect again. Second, a Google
that hangs is cut off after ten seconds by `AbortSignal.timeout` in
`google-calendar-provider.ts:36`; the "time-out" test makes the fake fetch
throw at once, so deleting that line also passes, and a hung Google would then
hold the booking check for minutes. Neither ever answers "free", so this is
coverage, not a live bug.
**Suggested fix:** Add one test where the token answer reconnects the person
and then answers `invalid_grant`: the row must stay `connected` with the new
keys, and free/busy must be asked with the reconnected access token. For the
time-out, have the fake free/busy honour `init.signal` (wait for its abort) and
run it under fake timers, or assert the request carries a signal.
**Resolution:**
