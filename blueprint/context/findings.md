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

### F-35 [P2] fixed - A failure after Better Auth has saved the business leaves a business with no owner, and is reported as a taken name

**File:** backend/lib/admin/provision-client.ts:54
**Found:** 2026-09-30 by /audit (scope: step 3b.1; lens: quality, security)
**Why it matters:** Better Auth 1.7.5's `createOrganization` saves the business,
then its owner row, then runs `afterCreateOrganization` (the first person), as
separate writes with no transaction around them (`crud-org.mjs`, the org adapter's
`createOrganization` and `createMember`). If anything after the first write
throws, the catch at `provision-client.ts:54-60` removes the new login (the owner
row goes with it, by cascade) but leaves the business saved, with no owner and
no person. It then sees the slug as taken and answers `409 slug_taken`, "A
business with that name already exists", hiding a real fault behind a wrong
message, and every retry with that name is refused for good. On the reuse path
the login is kept, so the business keeps its owner row but has no first person,
and a retry is `email_taken`. The spec's promise is "never half made"; this half
is the business, not the login. Needs a database fault mid-request, so not P1.
**Suggested fix:** In the catch, before deciding `slug_taken`, remove a business
at that slug that this request made: one whose only members are this client, or
which has no members at all, and was not there at the pre-check. Then answer
`slug_taken` only when a business at that slug still exists after that, and
rethrow otherwise. Add a test that forces the failure after the business is
saved (for example a failing first-person insert) and asserts no business, no new
login and a 500.
**Resolution:**
Fixed 2026-09-30 on Frank's yes, in the step 3b.1 review-fix commit. On a failure, `removeBusinessMadeFor` (`provision-client.ts`) removes a business at the slug that has no member but this client (its owner row and first person go by cascade), then the login this setup made; `slug_taken` is answered only when a business with someone else in it holds the slug. Two route tests force a failure right after Better Auth's save: a new login (no business, no login left, 500) and a reused one (no business, login kept, the retry answers 201). Shown able to fail by removing the business delete: both failed. Waits for the next review to close.

### F-36 [P3] open - The spec still says broken JSON is answered with the refusal shape

**File:** blueprint/context/current-feature.md:259
**Found:** 2026-09-30 by /audit (scope: step 3b.1; lens: quality)
**Why it matters:** Data / contracts lists "malformed JSON" under `400
bad_request`. The route checks the body with Hono's `validator("json")`, which
throws its own `HTTPException(400, "Malformed JSON in request body")` before the
schema callback runs (`hono/dist/validator/validator.js`), so broken JSON gets a
plain-text 400. The build log records the departure; the spec, which later
steps and `/complete` read, does not.
**Suggested fix:** Correct the contract line: malformed JSON is Hono's own plain
400; a missing or wrong body is `400 bad_request`.
**Resolution:**

### F-37 [P3] open - No test proves the /admin routes carry the dashboard's guards

**File:** backend/routes/admin-routes.test.ts:120
**Found:** 2026-09-30 by /audit (scope: step 3b.1; lens: tests)
**Why it matters:** `app.ts` mounts the dashboard CORS, origin check and
`no-store` on `/admin/*`, and the calendar tests prove the same for `/calendar`
with a cross-site form post. Nothing in `admin-routes.test.ts` would fail if the
`/admin/*` line were dropped, and an answer naming a client's login is exactly
what `no-store` exists to keep out of caches.
**Suggested fix:** Assert `Cache-Control: no-store` on one answer, and that a
form-encoded post from another origin with the platform admin's cookie is
refused (403) and makes nothing.
**Resolution:**

### F-38 [P2] fixed - Two overlapping setups for one email can give the client two businesses, or delete the owner of a business reported as made

**File:** backend/lib/admin/provision-client.ts:57
**Found:** 2026-09-30 by /audit independent (scope: step 3b.1; lens: quality, security, tests)
**Why it matters:** A setup still in flight looks exactly like an unfinished
one: between `createUser` (line 41) and the business being saved, the new login
has no membership, so a second request for the same email takes the reuse path
at line 29. Nothing serializes the two. Reproduced against the local database
with a throwaway probe (removed after; no product file changed), holding the
first request's `createOrganization` 400 ms to widen the window:
- same email, two business names: both answered `201` and the client ended
  with two memberships. That is option B, which Frank refused on 2026-09-30
  ("one login is one business"), and the session hook then pre-selects nothing.
- same email, same business (a double submit or a retried request): the second
  request reused the login and made the business; the first lost the slug race,
  and its catch deleted the login it had made (line 57) without checking it now
  owns a business. Result: `201` naming a client id that no longer exists, a
  business with no member and no login, and `409 slug_taken` on the other.
Without the delay, two simultaneous identical requests gave `500` and `201`
(the second `createUser` refused the duplicate). Only one platform admin uses
this route and the form will disable its button, so the window is narrow, but
the outcome is silent and the 201 is wrong. No test covers overlapping requests.
**Suggested fix:** Serialize setups per email, for example a Postgres advisory
lock on the email's hash held across the two creates (or a reuse rule that also
requires the login to be older than a setup can take). Independently, make the
compensation delete the login only while it still has no membership, so it can
never remove another request's owner. Add a test that runs two overlapping
setups for one email and asserts one business, one owner, and no 201 for a
deleted client.
**Resolution:**
Fixed 2026-09-30 on Frank's yes, in the step 3b.1 review-fix commit. `withSetupLocks` holds two Postgres advisory locks on one reserved connection for the whole setup, email first then address, so setups for one email (or one address) run one after another and the second sees the first's finished login as `email_taken`. The login clean-up also deletes only while the login belongs to no business (`removeLoginWithoutBusiness`); with the locks no request can reach that case, so no test exercises that guard. Two route tests hold the first setup 300 ms and start a second for the same email 50 ms later, with the same business and with another: one 201, one 409, one business, one owner. Shown able to fail by removing the locks: both failed. Waits for the next review to close.

### F-39 [P3] open - Finishing an unfinished setup ignores the client name sent with it

**File:** backend/lib/admin/provision-client.ts:40
**Found:** 2026-09-30 by /audit independent (scope: step 3b.1; lens: quality)
**Why it matters:** On the reuse path the login is returned as stored and
`input.clientName` is never used, so the answer's `client.name` is the earlier
attempt's name, not the one just typed. The contract says the user is "the name
given". The likeliest reason to run a setup again is correcting the first
attempt, and the correction is dropped without a word. The reuse test
(`admin-routes.test.ts`) sends "Client finished" against a login named
"Unfinished" and does not assert the name either way.
**Suggested fix:** Either update the reused login's name to the one given (one
`db.update(user)` before creating the business, or Better Auth's admin
`updateUser` with no headers), or write in the spec that the first name stands,
and assert the chosen behaviour in the reuse test.
**Resolution:**

### F-40 [P3] open - Two shared field schemas live in files named after other schemas

**File:** packages/shared/zod-validation/organization-validation-schemas/create-organization-validation-schema.ts:6
**Found:** 2026-09-30 by /audit independent (scope: step 3b.1; lens: quality)
**Why it matters:** The naming standard is one file per export, the file named
after the thing imported. `businessNameValidationSchema` now lives in
`create-organization-validation-schema.ts` and `emailAddressValidationSchema` in
`sign-in-email-validation-schema.ts`, so the import in
`provision-client-validation-schema.ts:6-7` reads as if it reused the sign-in and
create-business forms. Step 3b.3 deletes `/create-organization`, its only user,
which leaves `createOrganizationValidationSchema` dead and the live business-name
rule in a file named after it. The rule's message, "Enter the name of your
business.", is also now shown to the platform admin about the client's business.
**Suggested fix:** Give each field schema its own file, named after it, in its
area folder, export them through `index.ts`, and remove
`createOrganizationValidationSchema` with its page in 3b.3. Word the business
name message so it reads right on both forms.
**Resolution:**

### F-41 [P3] unverified - A database error inside a setup may print the client's email in the API's log

**File:** backend/lib/admin/provision-client.ts:61
**Found:** 2026-09-30 by /audit independent (scope: step 3b.1; lens: security), raised as a remaining risk and recorded by the builder
**Why it matters:** The spec says the client's email never goes in a log line.
`provisionClient` rethrows unexpected errors (`:61`), and Hono's default error
handler logs them. A drizzle query error carries its parameters, so a failure
inside `createUser` (a duplicate email in the F-38 race, for example) would
print the email. Not observed: no run produced such a log line.
**Suggested fix:** Confirm by forcing a failing `createUser` and reading the log.
If it shows, log a safe reason (the project already has `safe-error-reason.ts`
for the calendar) and rethrow a plain error without the query's parameters.
**Resolution:**
