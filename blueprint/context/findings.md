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

### F-15 [P3] fixed - `coding-standards.md` still says migrations run through drizzle-kit from `backend`

**File:** blueprint/context/coding-standards.md:240
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** The Backend section says Drizzle migrations "run through
`drizzle-kit` from `backend`". This feature moved them: `drizzle.config.ts` and
the `db:*` scripts live in `packages/shared`, and `AGENTS.md` (Commands) says
"Never generate a migration from `backend` or `frontend`: two workspaces
generating against one database is how a migration ledger forks." Same class as
F-09, in the same file, missed by its repair. An agent obeying the standard
would recreate the fork `AGENTS.md` warns about.

**Suggested fix:** Rewrite the sentence to say migrations are generated and
applied from `packages/shared` with the commands in `AGENTS.md`.
**Resolution:** 2026-09-23, during Frank's folder walkthrough. The Backend section now says
migrations run through `drizzle-kit` from `packages/shared` only, never from `backend` or
`frontend`, and points at Commands in `AGENTS.md`. Awaiting re-review.

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

### F-17 [P2] closed - A database rebuilt from migrations and the seed has businesses with no first person

**File:** packages/shared/scripts/seed-dev.ts:87
**Found:** 2026-09-25 by /audit independent (scope: current; lens: quality)
**Why it matters:** Step 2.1 makes "every business has a first person" an
invariant and states it in `drizzle-schema.ts:138`: made by migration 0001 for
businesses that existed then, and by the `afterCreateOrganization` hook for
every new one. `seed-dev.ts` is a third way a business is created, and it
inserts `organization` rows directly through Drizzle, so the Better Auth hook
never runs. On a fresh database, the documented rebuild path (`AGENTS.md`:
"`db:migrate` builds a fresh one and `db:seed` makes it usable"; the workspace
rule that each machine rebuilds its local database from migrations and the
seed) runs the migration's backfill against zero organizations, then the seed
creates `agency-dev` and `test-salon-dev` with no resource. This machine's
database hides it because both businesses existed before 0001 was applied
(checked: one `person` each). Nothing reads `resource` yet, so nothing fails
today, but step 2.3's plan says "The first person every business already has
from 2.1 is used, never duplicated", which is false on any other machine.
**Suggested fix:** In `seed-dev.ts`, after the organization is found or made,
insert its first person (kind `person`, named after the business) when it has
no resource, in the same transaction. This can land in step 2.3, which already
edits this file, but correct the 2.3 plan text now so it says the seed creates
the person when missing rather than assuming it exists.
**Resolution:** Still open. Planned into step 2.3 with Frank on 2026-09-25: the seed creates each dev business's first person when missing; the spec's 2.3 text was corrected the same day. Closed 2026-09-26 by /audit independent (step 2.3, `7b04316`): `seed-dev.ts:281` now finds or makes the first person (kind `person`, named after the business) inside the seed's one transaction, before any hours or people. The builder left this entry `open` rather than `fixed`; this pass re-examined the repair directly. Evidence: the local database was rebuilt (both users, both businesses and all 20 resources carry one creation timestamp from the seed's transaction, and no old dev business remains), each business has exactly one resource named after it, and a second `db:seed` left every row of the six seeded tables byte-identical. No new defect in the repair; related gaps in the same file are recorded as F-22 to F-25.

### F-18 [P3] closed - Several refinements in the business-row schema have no test

**File:** packages/shared/src/zod-validation/availability/availability-rule-validation-schema.ts:28
**Found:** 2026-09-25 by /audit independent (scope: current; lens: tests)
**Why it matters:** The standard (`coding-standards.md`, Testing) asks for tests
on validators where a wrong answer is possible. The 15 new tests cover the
week, the one-off dates and four rule cases, but not the hand-written
duplicate-closed-date refine (line 28), the `holidayCountry` and
`holidayRegion` patterns (lines 31-40, e.g. a lowercase `ca` or a four
character region), `horizonDays` at 0, or a negative `minimumNoticeMinutes`.
Each mirrors a database check or a spec rule, so a regression there would
only surface as a raw constraint error from a writer in 2.3 or item 12.
**Suggested fix:** Add one refusal test per rule to
`availability-validation-schemas.test.ts`, ideally asserting the issue path
(`holidayRegion`, `closedDates`) rather than only `success === false`.
**Resolution:** Fixed 2026-09-25 on Frank's yes: four tests added (a closed date twice, country and province written out instead of their codes, zero days ahead, negative notice). Removing the horizon and notice limits made exactly those two tests fail. Awaits the next review pass to close. Closed 2026-09-26 by /audit independent: the four tests are at `availability-validation-schemas.test.ts:104-124`. Each targets a row only the business branch could accept (the person branch is `.strict()` and refuses a time zone), so removing the refine, either regex or either limit flips that test; 25 shared tests pass. Asserting the issue path was suggested, not required.

### F-19 [P2] closed - No test catches a person with a row losing the business's one-off dates

**File:** backend/src/lib/availability-rules.test.ts:49
**Found:** 2026-09-25 by /audit independent (scope: current; lens: tests)
**Why it matters:** Step 2.2's rule says "A person following the business's week
also gets the business's one-off dates" (`current-feature.md`, 2.2), and
`availability-rules.ts:67-69` does it. But no test gives a follower who has a row
and the business one-off dates on different days. The "only a one-off date"
test runs against a salon with no one-off dates, and the "same date" test only
proves the override. Checked by mutation in a scratch copy: changing line 67 to
`hasOwnWeek || person !== null` drops the business's one-off dates for every
follower with a row, and all 10 tests still pass. That is the function items 5
and 9 reuse, and the wrong answer is silent: the person would be bookable on the
week's hours on a day the business changed.
**Suggested fix:** Add one test: the salon with a one-off date on one day, a
follower with their own one-off date on another, and assert both dates come
back, sorted.
**Resolution:** 2026-09-25, fixed by /implement: added the test "a person with a row who follows the business's week keeps the business's one-off dates" (salon opens Nov 2, Ben has his own Oct 13, both come back sorted). Re-ran the reviewer's mutation (`hasOwnWeek || person !== null` on line 67): the new test fails by name, 1 failed and 10 passed; restored, 11 pass. Awaiting re-review. Closed 2026-09-26 by /audit independent: the test at `availability-rules.test.ts:57` gives a follower with a row (Oct 13) and a business one-off date (Nov 2) and asserts both, sorted. Under the mutation the follower gets only `personDateHours`, so the assertion fails; the mutation was traced, not re-run from a copy. 11 backend tests pass.

### F-20 [P3] closed - `AvailabilityRuleRowType` is the one type in the project that is not exported

**File:** backend/src/lib/resolve-availability.ts:15
**Found:** 2026-09-25 by /audit independent (scope: current; lens: quality)
**Why it matters:** `coding-standards.md` (Naming) says types end in `Type` "and
always exported". Every other type under `backend/src` and `packages/shared/src`
is exported (the only exceptions are the augmented `ContextVariableMap`
interfaces the standard names). Small, but it is the pattern the next file copies.
**Suggested fix:** `export type AvailabilityRuleRowType = ...`.
**Resolution:** 2026-09-25, fixed by /implement: `export type AvailabilityRuleRowType`. Backend build and Prettier pass. Awaiting re-review. Closed 2026-09-26 by /audit independent: exported at `resolve-availability.ts:15`; backend build passes. The same class recurs in the 2.3 seed, recorded separately as F-24.

### F-21 [P3] closed - The build log's "full diff" links move with the branch

**File:** blueprint/context/project-log.html:3715
**Found:** 2026-09-25 by /audit independent (scope: current; lens: quality)
**Why it matters:** `AGENTS.md` says each code drawer "Ends with a link to the
step's commit on GitHub for the full diff". The 2.2 drawer links
`compare/b4b39a5...feature/booking-links-resources-and-availability-rules`, and
the 2.1 drawer (line 3328) `compare/cb8e09c...` the same branch. A compare
against a branch name follows the branch head, so the 2.1 link already shows
2.1 and 2.2 together, and each new push widens both. After the merge they show
the whole feature, not the step.
**Suggested fix:** When the next step republishes the page, pin each link to
the step's own commits (`compare/b4b39a5...2519644` for 2.2,
`compare/cb8e09c...b4b39a5` or the step commit for 2.1). A step's own hash
cannot be in its own commit, so pin it on the following republish.
**Resolution:** 2026-09-25, fixed by /implement: the 2.1 link now compares `cb8e09c...ab16897` and the 2.2 link `b4b39a5...98e2493`, each a step plus its review fix. `AGENTS.md` now says every drawer link is pinned to commits, never the branch. Awaiting re-review. Closed 2026-09-26 by /audit independent: `project-log.html:3375` compares `cb8e09c...ab16897` and `:3817` `b4b39a5...98e2493`, exactly 2.1 plus its fix and 2.2 plus its fix. No link in the page targets a branch name; the 2.3 drawer says its link comes once committed, as the F-21 note expects.

### F-22 [P3] fixed - The seed's one-off and closed dates are fixed dates, so the clinic loses its "only an extra date" practitioner after Oct 18

**File:** packages/shared/scripts/seed-dev.ts:174
**Found:** 2026-09-26 by /audit independent (scope: current; lens: quality, tests)
**Why it matters:** The seed promises "six practitioners with every kind of
hours" (line 146), and the 2.3 contract and its spot check rely on Daniel being
the practitioner with only a one-off date. His date is the literal `2026-10-18`.
From Oct 19, 2026 `resolveAvailability` drops it as past, so Daniel resolves
exactly like Ana, and a database rebuilt from migrations and the seed (the
workspace rule for every machine) no longer shows that case at all. The closed
dates (lines 97 and 144) run out on 2027-01-01 the same way, and Summit
Painting's two closed dates already sit outside its 60-day horizon, so the
painting business resolves with no closed dates until late October (checked
with `resolveAvailability` on the seeded rows). Features 5 and 9 compute slots
against this data.
**Suggested fix:** Compute the seed's dates relative to the day it runs (for
example Daniel on the Sunday about three weeks ahead, closed dates inside each
horizon), or say beside line 174 that the case expires and when to move it.
**Resolution:** 2026-09-26, fixed by /implement on Frank's yes: the seed's dates are relative to the day it runs. Each business gets one closed day 21 days out (inside both booking windows) and Daniel's extra day is the Sunday at least 14 days out. Proved by rebuilding the practice database: closed day 2026-10-17 for both, Daniel 2026-10-11, a Sunday. Awaiting re-review.

### F-23 [P3] fixed - A seeded person given one-off dates but no `weeklyHours` key is silently skipped

**File:** packages/shared/scripts/seed-dev.ts:313
**Found:** 2026-09-26 by /audit independent (scope: current; lens: quality)
**Why it matters:** `PersonSeedType` makes both `weeklyHours` and `dateHours`
optional (lines 60-61), but line 313 writes a row only when
`weeklyHours !== undefined`. An entry like
`{ name: "Ana", kind: "person", dateHours: [...] }` type-checks and its dates
are dropped without a word. Daniel works only because he spells out
`weeklyHours: null`. This file is the only writer of hours until item 12, and
the next person to give a follower a one-off date will write it the natural way.
**Suggested fix:** Decide the row from both fields
(`weeklyHours !== undefined || dateHours !== undefined`), or make the type say
it, for example one optional `hours: { weeklyHours, dateHours }` whose presence
means a row.
**Resolution:** 2026-09-26, fixed by /implement on Frank's yes: a seeded person gets a row when they have a week or any extra dates; a missing week is stored as null (follows the business). Proved by planting a person with only an extra date: their row was written with no week and the date; the plant was removed after. Awaiting re-review.

### F-24 [P3] fixed - The seed's types are not exported, and `PersonSeedType` also describes rooms

**File:** packages/shared/scripts/seed-dev.ts:57
**Found:** 2026-09-26 by /audit independent (scope: current; lens: quality)
**Why it matters:** `coding-standards.md` (Naming) says types end in `Type` "and
always exported", the rule F-20 enforced one step earlier; `PersonSeedType`
(57), `ServiceSeedType` (64) and `TransactionType` (200) are all unexported.
The same section says names say what a thing is: `PersonSeedType` carries
`kind: "person" | "place"` and types the five rooms (lines 176-180), while the
schema calls both a resource and the helper beside it is `ensureResource`.
**Suggested fix:** Export the three types and rename `PersonSeedType` to
`ResourceSeedType` (and `people` to `resources` if wanted).
**Resolution:** 2026-09-26, fixed by /implement on Frank's yes: `ResourceSeedType` (renamed from `PersonSeedType`, since it also describes rooms), `ServiceSeedType` and `TransactionType` are exported. The seed type-checks on its own. Awaiting re-review.

### F-25 [P3] fixed - On a dev database that was not rebuilt, the seed adds the new businesses beside the old ones

**File:** packages/shared/scripts/seed-dev.ts:247
**Found:** 2026-09-26 by /audit independent (scope: current; lens: quality)
**Why it matters:** The seed finds businesses by slug and never touches others.
On any machine whose `scheduleads_dev` still holds `agency-dev` and
`test-salon-dev` (every machine but this one, which was rebuilt for 2.3),
`db:seed` creates `painting-dev` and `clinic-dev` and a second owner membership
for each dev account, so both accounts land in the pick-a-business state and
the admin's home may open on the old, empty agency. Step 2.5's Done when ("the
home lists `painting-dev`'s three links") then depends on which business is
active. Nothing in `AGENTS.md` (Commands) or the seed header says an existing
dev database must be rebuilt after this step.
**Suggested fix:** One line in `AGENTS.md` Commands and the seed header: after
pulling 2.3, drop and rebuild the local `scheduleads_dev` (`db:migrate`, then
`db:seed`). Removing the old businesses from the seed is not needed.
**Resolution:** 2026-09-26, fixed by /implement on Frank's yes (option A, the seed cleans up): the seed deletes the retired made-up businesses `agency-dev` and `test-salon-dev` by exact slug, inside the local `_dev` guard, and says so; their members, people, hours and services cascade. Proved by putting both back with members, a person and a service: the seed removed them, left exactly the new cast, and the admin login belongs to one business again; a second run removed nothing. Awaiting re-review.
