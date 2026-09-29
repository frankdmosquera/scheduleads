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

### F-35 [P3] fixed - On a renamed seeded business the backfill links a worker to the owner, and the seed then crashes

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

### F-36 [P3] open - Two comments in this step break the comment standard

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
**Resolution:**
