# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-12 [P2] closed - Comments still describe open signup, self-serve business creation and server-side validation the code does not have

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
Step 3b.2, 2026-09-30: the backend and shared lines are corrected (`auth-server.ts` sign-up and hook comments, `sign-in/page.tsx:36`, which no longer claims the API uses the same schema). The `plan` comment already matched the code. Left for step 3b.3: `app/page.tsx:98` ("go create one") and the create page, which 3b.3 deletes.
Repaired by step 3b.3, 2026-09-30, and set to `fixed` by the builder; waits for step 3b.3's review to close. The last line, `app/page.tsx`'s "go create one", now describes the no-business card and the platform admin's way to set up a client; the create page it pointed at is deleted. No comment in the touched files describes open signup or self-serve business creation.
Closed 2026-09-30 by /audit independent (scope: step 3b.3, re-examining a67b75b): `app/page.tsx:100-102` now describes the no-business card and the platform admin's way to set up a client, `/create-organization` is gone, `sign-in/page.tsx:2` and `:36` say sign-in only and that Better Auth checks the address with its own rule, and the shared schema comments claim server use only where it is true (`provision-client-validation-schema.ts:2`, which `admin-routes.ts:25` does parse). The `plan` comment (`auth-server.ts:128-130`) says a sent plan is silently dropped. A search of the touched frontend, backend and shared files finds no comment left describing signup, self-serve creation or shared server-side validation.

### F-13 [P3] fixed - A signed-in user with no business is sent to a create form that can only refuse them, with no way to sign out

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
Repaired by step 3b.3, 2026-09-30, and set to `fixed` by the builder; waits for step 3b.3's review to close. `PickOrganization` (`app/page.tsx`) shows an ordinary login with no business the card "Your login has no business yet" with Sign out, and sends the platform admin to `/admin/clients/new`; `/create-organization` is deleted. Checked in the browser against the local API: a test client whose business was removed saw the card and signed out.
Not closed 2026-09-30 by /audit independent (scope: step 3b.3, re-examining a67b75b): the ordinary login's half is gone (`app/page.tsx:163-173`, the card with `SignOutLink`). The other half is not: a platform admin with no business is now sent to `/admin/clients/new`, which, like the create page before it, has no Sign out (F-48). This finding's suggested fix asked for a sign-out on that page as well, so it stays `fixed` and closes with F-48.

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
Step 3b.3, 2026-09-30: the create form is deleted, and the new Set up a client form follows the Forms standard (shadcn `Input` and `Label`, react-hook-form's `Controller`, the shared schema through `zodResolver`). Only the sign-in form still uses the hand-written `Field`; out of feature 3b's scope.

### F-16 [P3] closed - Better Auth endpoints already open two paths the spec reserves for later items

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
Repaired by step 3b.2, 2026-09-30, and set to `fixed` by the builder; waits for step 3b.2's review to close. `owner` and `admin` now hold `invitation: []` (`auth-server.ts`), and a route test shows an owner's `/organization/invite-member` is 403 with no invitation row; the `user.role` comments (`auth-server.ts`, `user-table.ts`) now say the platform admin can set it through the admin plugin. Shown able to fail: with `invitation: ["create", "cancel"]` back, the invite test failed.
Closed 2026-09-30 by /audit independent (scope: step 3b.2, re-examining ea23e45): `owner`, `admin` and `member` all hold `invitation: []` (`auth-server.ts:62-78`), and Better Auth's `/organization/invite-member` gates on `hasPermission` (`crud-invites.mjs:95`), so the route test's 403 with no invitation row is the real refusal; `addMember` has no HTTP path (`crud-members.mjs:25`, a pathless `createAuthEndpoint`). The `user.role` comments (`auth-server.ts:92-94`, `user-table.ts:15-16`) now match the admin plugin (`createUser` and `set-role` gate on `user:set-role`, `admin/routes.mjs`) and `input: false` (`db/schema.mjs:65-74`, a 400). Accepting an invitation made before this change is not role-gated; see F-47.

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

### F-35 [P2] closed - A failure after Better Auth has saved the business leaves a business with no owner, and is reported as a taken name

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
Closed 2026-09-30 by /audit independent (scope: step 3b.2, re-examining 76ef009 and ea23e45): Better Auth 1.7.5 saves the business, the owner row and then runs `afterCreateOrganization` as separate writes (`crud-org.mjs:74`, `:100`, `:137`); a failure after any of them now reaches `removeBusinessMadeFor` (`provision-client.ts:90`), which removes a business at the slug with no member but this client (zero members included, so a failed owner insert is covered too) and answers `slug_taken` only when someone else is in it. The slug was checked free under its lock at `:64`, so the business removed can only be this setup's. Both route tests pass (backend suite 119/119). Not introduced by the repair but worth knowing: if the clean-up itself fails the half setup stays, see F-44.

### F-36 [P3] closed - The spec still says broken JSON is answered with the refusal shape

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
Carried to step 3b.2 on Frank's call, 2026-09-30. Written into that step's plan in the spec.
Repaired by step 3b.2, 2026-09-30, and set to `fixed` by the builder; waits for step 3b.2's review to close. The spec's Data / contracts and step 3b.1's route line now say malformed JSON is Hono's own plain-text 400 and a missing or wrong body is `400 bad_request`.
Closed 2026-09-30 by /audit independent (scope: step 3b.2, re-examining ea23e45): the contract now matches hono 4.13.8 `validator/validator.js:14-21` (a JSON content type with an unparsable body throws `HTTPException(400, "Malformed JSON in request body")`; no JSON content type leaves `{}`, which the schema refuses as `bad_request`). One nuance, not worth reopening: an empty body sent as `application/json` is also Hono's plain 400, since `c.req.json()` fails on it.

### F-37 [P3] closed - No test proves the /admin routes carry the dashboard's guards

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
Carried to step 3b.2 on Frank's call, 2026-09-30. Written into that step's plan in the spec.
Repaired by step 3b.2, 2026-09-30, and set to `fixed` by the builder; waits for step 3b.2's review to close. Two route tests: a 201 answer carries `Cache-Control: no-store`, and a form-encoded post from another origin with the platform admin's cookie is 403 and makes no login. Shown able to fail: without the `/admin/*` guard line in `app.ts`, both failed.
Closed 2026-09-30 by /audit independent (scope: step 3b.2, re-examining ea23e45): `admin-routes.test.ts:395-415` asserts `Cache-Control: no-store` on a 201 and a 403 with no login for a cross-origin form post carrying the platform admin's cookie. The 403 can only come from the origin check: without `app.ts:22` the form body skips Hono's JSON validator (`validator.js:14`, non-JSON content type leaves `{}`) and the schema answers 400, so the test is not satisfied by any other guard.

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
Not closed 2026-09-30 by /audit independent (scope: step 3b.2, re-examining 76ef009 and ea23e45): the original race is gone (the two overlap tests pass, and setups for one email now run one after another), but the repair introduced a new defect: each setup holds one of the pool's ten connections while it waits for, and then holds, its locks, so ten setups at once leave none for their own queries and the whole API stops answering (F-43, reproduced). F-42 is also a defect of this repair. Stays `fixed` until F-43 is resolved.
Not closed 2026-09-30 by /audit independent (scope: step 3b.3, re-examining 22a411b and a67b75b): F-43 is now closed and both overlap tests pass (backend 120/120), but the lock design this repair introduced has a further defect: a lock connection that drops mid-setup crashes the API process or hangs the setup, because the unlock is sent on a dead reserved connection (F-49, reproduced). Stays `fixed` until F-49 is resolved.
Re-repaired 2026-09-30 in the step 3b.3 review-fix commit: the race is now stopped by `client_setup_claim` (see F-49), not advisory locks. The second of two overlapping setups answers `409 setup_in_progress` and makes nothing; the clean-up still deletes a login only while it belongs to no business.

### F-39 [P3] closed - Finishing an unfinished setup ignores the client name sent with it

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
Carried to step 3b.2 on Frank's call, 2026-09-30. Written into that step's plan in the spec.
Repaired by step 3b.2, 2026-09-30, and set to `fixed` by the builder; waits for step 3b.2's review to close. `renameLogin` (`provision-client.ts`) writes the name typed now over the reused login's, and the answer returns it; the reuse test checks both. Shown able to fail: without the rename, the test failed.
Closed 2026-09-30 by /audit independent (scope: step 3b.2, re-examining ea23e45): `renameLogin` (`provision-client.ts:121-125`) runs only on the reuse path, under the email lock, before the business is made, and the answer is built from its return; `admin-routes.test.ts:213-217` asserts the new name in both the answer and the stored login. A rename that survives a later failed business is intended (the next try keeps the correction).

### F-40 [P3] closed - Two shared field schemas live in files named after other schemas

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
Carried to step 3b.3, which deletes the create page the business-name rule's file is named after on Frank's call, 2026-09-30. Written into that step's plan in the spec.
Repaired by step 3b.3, 2026-09-30, and set to `fixed` by the builder; waits for step 3b.3's review to close. `businessNameValidationSchema` lives in `business-name-validation-schema.ts` (the old create-organization file, renamed; `createOrganizationValidationSchema` is gone with its page) and `emailAddressValidationSchema` in `email-address-validation-schema.ts`; the business-name message reads "Enter the business's name."
Closed 2026-09-30 by /audit independent (scope: step 3b.3, re-examining a67b75b): `business-name-validation-schema.ts` and `email-address-validation-schema.ts` each hold the one export they are named after, `zod-validation/index.ts:4` and `:7` export them, `provision-client-validation-schema.ts:6-7` and `sign-in-email-validation-schema.ts:5` import them from their own files, and `createOrganizationValidationSchema` has no remaining reference. The message reads for either form. Shared tests 55/55, both builds pass.

### F-41 [P3] closed - A database error inside a setup may print the client's email in the API's log

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
Carried to step 3b.2 on Frank's call, 2026-09-30. Written into that step's plan in the spec.
Confirmed 2026-09-30 by a route test before any repair: a real duplicate-key error inside the login's creation reached Hono's error log as `Failed query: insert into "user" ...` with the client's email in its values. Repaired by step 3b.2, 2026-09-30, and set to `fixed` by the builder; waits for step 3b.2's review to close. `provisionClient` now logs `[admin] a client setup failed: <safe reason>` (the database error reduced to its Postgres code by `safeErrorReason`, moved from `lib/calendar` to `lib/errors` now that two areas use it) and rethrows a plain error. The same test now passes; with the raw error rethrown it fails again.
Closed 2026-09-30 by /audit independent (scope: step 3b.2, re-examining ea23e45): re-shown by planting `throw error` back in `provisionClient`'s catch (the F-41 test failed, 21 of 22 passed) and restoring it byte for byte. Every error out of the locked setup passes through that one catch (`provision-client.ts:30-37`), drizzle 0.45.2's `DrizzleQueryError` message starts with "Failed query" (`errors.js:12`) so `safeErrorReason` keeps only its Postgres code, and Better Auth logs nothing itself on a server-side `auth.api` call (its router `onError`, `api/index.mjs:212`, runs only for HTTP).

### F-42 [P3] fixed - If releasing the setup locks fails, the reserved connection is never handed back and the real error is lost

**File:** backend/lib/admin/provision-client.ts:52
**Found:** 2026-09-30 by /audit (scope: step 3b.2 and step 3b.1's fixes; lens: quality, performance)
**Why it matters:** `withSetupLocks` runs `pg_advisory_unlock_all()` and then
`connection.release()` in one `finally`. If the unlock query throws (the
connection dropped mid-setup), `release()` never runs, so that reserved
connection may never return to the pool of ten, and the unlock error replaces
whatever error the setup itself threw. Needs a dropped connection, so rare.
**Suggested fix:** Release in its own `finally` (or `try { unlock } finally {
release }`), and do not let an unlock failure replace the setup's own error; a
dropped connection already frees its advisory locks.
**Resolution:**
Independent review 2026-09-30 (/audit independent, scope: step 3b.2): agreed, P3, with one correction. A dropped connection does go back: postgres.js 3.4.9's `onclose` (`cjs/src/index.js:421-427`) moves it to the closed list and clears `reserved`, so the pool reopens it. What stands is the error masking, and one case worse than described: when the setup itself succeeded, a failing unlock turns its 201 into a 500, and the retry the platform admin then makes is `email_taken`. Release and unlock should never be able to replace the setup's own result.
Fixed 2026-09-30 on Frank's yes, in the step 3b.2 review-fix commit; waits for step 3b.3's review to close. `releaseSetupLocks` runs the unlock in its own try, logs a failure through `safeErrorReason` without throwing, and always releases the connection in `finally`, so an unlock failure can neither replace the setup's own error nor turn a finished setup into a 500. No test forces an unlock failure; checked by reading.
Not closed 2026-09-30 by /audit independent (scope: step 3b.3, re-examining 22a411b): the repair is right for an unlock that fails with an error (logged, the connection always released, the setup's own result kept). But the case this finding names, a connection dropped mid-setup, never reaches that `catch`: postgres.js throws the unlock's failure outside the promise, so the process crashes or the unlock hangs (F-49, reproduced), and the new comment at `provision-client.ts:58` says the opposite. Stays `fixed` and closes with F-49.
Superseded 2026-09-30 by the F-49 repair: there is no unlock any more. `releaseSetupClaims` deletes this setup's own claims, logs a failure through `safeErrorReason` and never throws, so it cannot replace the setup's own outcome; a claim left behind expires after five minutes.

### F-43 [P2] closed - Ten setups at once take every pooled connection and freeze the whole API

**File:** backend/lib/admin/provision-client.ts:45
**Found:** 2026-09-30 by /audit independent (scope: step 3b.2; lens: performance)
**Why it matters:** `withSetupLocks` reserves one of the pool's ten connections
(`database.ts:19`, `max: 10`) for the whole setup, including while it waits on
`pg_advisory_lock`, but the setup's own queries and Better Auth's run on other
pool connections. With ten setups in flight (any emails), all ten connections
are reserved, every setup's next query waits for a free one, none is ever
released, and every other request in the API (sign-in, `/me`, the public
booking pages of every tenant) waits behind them until the process restarts.
Nothing times out. Reproduced against the local database with a throwaway probe
calling `provisionClient` ten times at once: nothing finished in 8 s and a plain
`select` on `db` then hung too; with nine, all nine answered 201. The probe was
removed and left no rows or advisory locks. Only the platform admin can call
the route and the form will disable its button, so it needs a script, a retry
loop or a buggy client, but the cost is a full outage for every tenant, and the
same holds for setups queued on one email, each holding a connection while it
waits.
**Suggested fix:** Keep the lock connection out of the query pool: a separate
small `postgres()` client used only for the setup locks, or a cap on setups in
flight below the pool size (one at a time is plenty for one platform admin),
with a bounded wait (`pg_try_advisory_lock` in a short retry loop, or
`lock_timeout` on the lock connection) so a stuck setup cannot queue others
forever. Add a test that starts more setups at once than the pool holds and
asserts they all answer.
**Resolution:**
Fixed 2026-09-30 on Frank's yes, in the step 3b.2 review-fix commit; waits for step 3b.3's review to close. The locks now take their connection from `advisoryLockClient` (`database.ts`, two connections of its own), never the API's pool of ten, so waiting setups queue there. A route test runs 14 setups at once: all 201, and `/health` still answers. Shown able to fail: with the lock back on `db.$client.reserve()`, that test timed out at 15 s and every test after it hung, the freeze reproduced.
Closed 2026-09-30 by /audit independent (scope: step 3b.3, re-examining 22a411b): `withSetupLocks` reserves from `advisoryLockClient` (`database.ts:27`, `max: 2`) while every query the setup and Better Auth run uses `db`'s pool of ten, so waiting setups queue in postgres.js's `reserve()` (`index.js:203-211`, a promise on the lock pool's own queue) and never hold an API connection. Email locks are always taken before address locks, so the two lock connections cannot deadlock each other. The 14-setup test passes (backend 120/120) and asserts `/health` afterwards. The suggested bounded wait was not added: a setup stuck inside Better Auth blocks later setups, but no longer the API, which is what the spec's contract promises. The lock pool does carry F-49 (a dropped lock connection), which predates this repair.

### F-44 [P3] closed - A failed clean-up leaves a half-made setup that no retry can finish, and hides the real error

**File:** backend/lib/admin/provision-client.ts:90
**Found:** 2026-09-30 by /audit independent (scope: step 3b.2; lens: quality)
**Why it matters:** The spec promises "A setup is never half made". The
promise holds only while the clean-up's own queries work. The likeliest reason
`createOrganization` fails after saving the business is a database fault, and
then `removeBusinessMadeFor` (unguarded) usually fails too: its error replaces
the original one in the log, and the business stays with the client as its
owner and possibly no first person. Every retry is then `409 email_taken`,
because the login now belongs to a business, and nothing in the product can
remove it before feature 23. Not introduced by the F-35 repair (the earlier
code ended the same way under a database fault), and it needs a database fault
mid-setup, so P3.
**Suggested fix:** Write the limit into the spec's "A setup is never half
made" contract (it holds unless the database fails during the clean-up; the
fix is then by hand), and log the setup's own safe reason before the clean-up
runs, so a failing clean-up cannot hide it.
**Resolution:**
Fixed 2026-09-30 on Frank's yes, in the step 3b.2 review-fix commit; waits for step 3b.3's review to close. The clean-up runs in its own try: a failure there is logged with a safe reason and the setup's own error is the one rethrown. The spec's "A setup is never half made" now states the limit: if the clean-up itself fails, the half-made setup stays, a retry is `email_taken`, and it is removed by hand until feature 23. No test forces a failing clean-up; checked by reading.
Closed 2026-09-30 by /audit independent (scope: step 3b.3, re-examining 22a411b): the clean-up (`provision-client.ts:104-113`) runs in its own try, logs only `safeErrorReason`, and the setup's own error is rethrown at `:116`, then logged safely and replaced by a plain error at `:35-36`, so neither the clean-up's error nor a query's parameters reach Hono. When the business delete fails, the new login's delete is skipped, which leaves a login with no business that the next setup with that email finishes, as intended. The spec's "A setup is never half made" states the limit. Checked by reading, as the builder did.

### F-45 [P3] closed - The overlap tests start the second setup on a fixed 50 ms timer, not once the first holds the lock

**File:** backend/routes/admin-routes.test.ts:331
**Found:** 2026-09-30 by /audit independent (scope: step 3b.2; lens: tests)
**Why it matters:** Both overlap tests assume the first request has taken its
locks within 50 ms (session lookup, a connection reserved, two lock queries,
two reads, `createUser`). If it has not, on a cold pool or a busy machine, the
second request takes the locks first, the 300 ms hold (a `mockImplementationOnce`)
lands on it instead, and the first answers 409: the tests then fail on
`first.status` although the code is right. They pass today on the laptop.
**Suggested fix:** Start the second setup from inside the mocked
`createOrganization` (resolve a promise when the mock is entered, then wait on
it), so it always overlaps a first setup that already holds both locks.
**Resolution:**
Fixed 2026-09-30 on Frank's yes, in the step 3b.2 review-fix commit; waits for step 3b.3's review to close. The overlap tests now send the second setup only once the first is inside its locks (the held `createOrganization` signals a promise the test awaits), with no fixed timer.
Closed 2026-09-30 by /audit independent (scope: step 3b.3, re-examining 22a411b): `holdFirstSetup` (`admin-routes.test.ts:318-331`) resolves `inside` from within the mocked `createOrganization`, which runs only after both locks are held, and the second request is sent after `await held.inside` (`:334-339`, `:356-361`). The mock is `Once`, so the second setup gets the real create. Both tests pass; no timer decides who takes the lock first.

### F-46 [P3] closed - The new tests carry finding and step numbers in their comments and names

**File:** backend/routes/admin-routes.test.ts:269
**Found:** 2026-09-30 by /audit independent (scope: step 3b.2; lens: quality)
**Why it matters:** `coding-standards.md` (Comments, "The balance") keeps
history out of code, naming step and finding numbers. This delta adds `// F-35:`
(`:269`), `// F-38:` (`:315`), `// F-41:` (`:369`) and the describe names "(F-37)"
(`:395`) and "(step 3b.2)" (`:417`). The ledger is archived and reset by
`/complete`, so these numbers point at nothing a reader can find later.
**Suggested fix:** Keep the plain-words part of each comment and name, drop the
numbers ("the old doors are closed", "the /admin routes keep the dashboard's
guards").
**Resolution:**
Fixed 2026-09-30 on Frank's yes, in the step 3b.2 review-fix commit; waits for step 3b.3's review to close. No finding or step number is left in `admin-routes.test.ts` or `provision-client.ts`; the two describe blocks are named for what they prove.
Closed 2026-09-30 by /audit independent (scope: step 3b.3, re-examining 22a411b and a67b75b): a search for `F-NN`, `step N`, `3b.N` and `feature N` in `admin-routes.test.ts`, `provision-client.ts`, `database.ts` and the step 3b.3 frontend and shared files finds none in those two files; the describe blocks read "the /admin routes keep the dashboard's guards" and "Better Auth's own ways into a business are closed". The only hit is a forward pointer, "(feature 6)", in `new-client-form.tsx:121`, which names a plan item, not history.

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

### F-48 [P3] fixed - The Set up a client page has no Sign out and no way back, so a platform admin with no business cannot sign out

**File:** frontend/app/admin/clients/new/page.tsx:63
**Found:** 2026-09-30 by /audit (scope: step 3b.3; lens: quality)
**Why it matters:** The form and its success card render no Sign out and no
link to the dashboard. For a platform admin with no business, `/` now sends
them straight back to `/admin/clients/new` (`PickOrganization`), so no screen
they can reach offers Sign out: the same "nobody stuck" gap F-13 closed for
ordinary logins. In production the platform admin may well have no business of
their own until feature 10.
**Suggested fix:** Give the form and the success card the footer every other
signed-in card has: Sign out, plus "Back to the dashboard" when the admin has a
business.
**Resolution:**
Independent review 2026-09-30 (/audit independent, scope: step 3b.3, re-examining a67b75b): agreed, P3, confirmed by reading. `PickOrganization` (`app/page.tsx:125-127`) sends a platform admin with an empty list to `/admin/clients/new`, and neither `NewClientForm` nor `SetUpCard` renders a footer. Not a hard lock: `/sign-in` does not turn away a signed-in user, so typing that address and signing in as someone else replaces the session, but nothing offers Sign out. This is the platform admin's half of F-13 (whose suggested fix asked for a sign-out on the page a no-business login is sent to), so F-13 stays `fixed` until this is repaired.
Fixed 2026-09-30 on Frank's yes, in the step 3b.3 review-fix commit; waits for the next review (the final one at /complete) to close. The form and the success card carry a footer with Sign out (now `components/sign-out-link.tsx`, shared with the dashboard) and "Back to the dashboard" when the platform admin has a business (the page reads `organization.list()`). Checked in the browser: both links show for the dev platform admin, and Sign out from the form lands on /sign-in.

### F-49 [P2] fixed - A lock connection that drops mid-setup crashes the API process, or hangs the setup for good

**File:** backend/lib/admin/provision-client.ts:63
**Found:** 2026-09-30 by /audit independent (scope: step 3b.3; lens: quality, performance)
**Why it matters:** `releaseSetupLocks` sends `pg_advisory_unlock_all()` on the
reserved lock connection in every `finally`, and its comment says a dropped
connection is harmless ("its locks are already gone"; a failed unlock "is
logged, never thrown"). In postgres.js 3.4.9 it is not. When a reserved
connection's socket closes, `closed()` sets `socket = null` and `onclose` moves
it to the closed list (`cjs/src/connection.js:436-458`, `cjs/src/index.js:421-427`),
but a query sent on the reserved handle still goes to `c.execute`
(`index.js:226-230`), whose write is scheduled with `setImmediate(nextWrite)`
and then calls `socket.write` on `null` (`connection.js:246-258`). That throws
outside any promise: an uncaught `TypeError`, which ends the Node process, so
every tenant's API goes down until Railway restarts it, and the setup never
answers. Reproduced twice, both cleaned up with no rows, locks or product files
left:
- a throwaway route-level probe called `provisionClient` and, inside the held
  `createOrganization`, ran `pg_terminate_backend` on the lock connection: one
  backend killed, the setup gave no answer in 5 s, and Vitest caught "Uncaught
  Exception TypeError: Cannot read properties of null (reading 'write')" from
  `nextWrite`.
- a plain postgres.js script: the same crash for a connection killed while
  holding its lock; for one killed while waiting on `pg_advisory_lock`
  (ECONNRESET on Windows, `hadError` true, so pending queries are never
  errored, `connection.js:453`) the unlock never resolved, so the setup would
  hang and keep one of the lock pool's two connections for good; two such
  events and every later setup waits forever.
Introduced with the locks themselves (the F-38 repair), not by the F-42 or F-43
repairs, and needs Postgres to drop that one connection during a setup (a
database restart, failover or network reset), so not P1. The cost when it
happens is the whole API, not one request.
**Suggested fix:** Do not send a query after the setup on a connection that may
be gone. Transaction-scoped locks need no unlock at all:
take both locks with `pg_advisory_xact_lock` inside `advisoryLockClient.begin(...)`
and run the setup within that callback; Postgres then frees both locks at commit, rollback or connection loss. The same probe with
`begin` and `pg_advisory_xact_lock` rejected cleanly with `CONNECTION_CLOSED`
and the pool kept working. One trade-off to write into the spec: when the drop
comes after the setup finished, the commit fails and the answer is a 500 for a
setup that was made (the retry then says `email_taken`). Correct the comments
that say a drop is harmless, and the spec's "released when it ends or its
connection dies" line if the mechanism changes.
**Resolution:**
Fixed 2026-09-30 on Frank's yes, in the step 3b.3 review-fix commit; waits for the next review (the final one at /complete) to close. The planned repair (transaction-scoped advisory locks) was built and proved wrong by a route test that terminated the lock's backend mid-setup: postgres.js 3.4.9 (the newest) gave up on the transaction at once and later threw the same uncaught `TypeError ... reading 'write'` from `connection.js` `nextWrite`, while the setup ran on. Any lock that holds a connection can hit it. On Frank's call (option A, 2026-09-30) the locks are replaced by `client_setup_claim` rows (migration 0005): a setup inserts its email and address keys in one statement with `on conflict do nothing`, answers `409 setup_in_progress` short of both, removes only its own claims when it ends, and clears claims older than five minutes first. No connection is held while a setup runs, so there is nothing to drop; `advisoryLockClient` is gone. Tests: both overlap tests now expect `setup_in_progress` for the second, then `email_taken` once the first is done and its claims are gone; a claim held by another setup gives 409 and is left alone; a claim older than five minutes is cleared. Shown able to fail: claims ignored (three tests failed), stale claims never cleared (its test failed), every claim released instead of its own (its test failed).

### F-50 [P3] fixed - The sign-in Field keeps a hint prop that only the deleted create page used

**File:** frontend/components/auth-card.tsx:40
**Found:** 2026-09-30 by /audit independent (scope: step 3b.3; lens: quality)
**Why it matters:** Step 3b.3 says to delete "the now unused pieces of
`auth-card.tsx`" with `/create-organization`. The create page was the only
caller that passed `hint` (its "Your address will be ..." line); the two
remaining `Field`s in `sign-in/page.tsx` pass none. The `hint` prop, its id,
its `aria-describedby` entry and its paragraph are now dead code, against
"No unused imports or variables" and the step's own instruction.
**Suggested fix:** Remove `hint` and `hintId` from `Field` and keep only the
error in `aria-describedby`, or leave it with the next form that needs it.
**Resolution:**
Fixed 2026-09-30 on Frank's yes, in the step 3b.3 review-fix commit; waits for the next review (the final one at /complete) to close. `Field` no longer takes `hint`; its error is linked to the input directly.

### F-51 [P3] fixed - A business name with no letters or digits comes back as a form-level notice, not under the Business name field

**File:** frontend/lib/api-client.ts:177
**Found:** 2026-09-30 by /audit independent (scope: step 3b.3; lens: quality)
**Why it matters:** The shared schema only asks for 2 to 80 characters, so a
name like "!!" or "--" passes the form, and the API answers `400 bad_request`
("Use at least a couple of letters or numbers in the name."). `provisionClient`
maps only `email_taken` and `slug_taken` to fields, so this lands in the
form-level `Notice`. The spec's Frontend states keep the form-level error for
"API down or a 500" and list field errors separately; the deleted create page
checked `toSlug` before sending for exactly this case. Cosmetic: the message
still says what to fix.
**Suggested fix:** Map `bad_request` to `businessName` in `provisionClient`
(it is the only field the server can refuse after the shared schema passed),
or check `toSlug(businessName)` in the form before sending, as the create page
did.
**Resolution:**
Fixed 2026-09-30 on Frank's yes, in the step 3b.3 review-fix commit; waits for the next review (the final one at /complete) to close. `businessNameValidationSchema` refuses a name whose address would be empty ("Use at least a couple of letters or numbers."), so the form shows it under Business name and sends nothing; the API's own empty-slug check stays as the backstop. Shared test added; checked in the browser: "!! ??" showed the message under the field and no request was sent.
