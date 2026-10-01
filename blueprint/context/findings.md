# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-14 [P3] fixed - The sign-in and create-business forms bypass the project's form standard without saying so

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
Fixed 2026-10-01 on Frank's call (the pending tasks before step 4.2), in a chore commit on `feature/04-crm-spine`; waits for step 4.2's review to close. The sign-in form now follows the Forms standard: `auth-card.tsx`'s `Field` is built on shadcn `Input` and `Label`, both sign-in steps are react-hook-form forms through `Controller` with the shared schemas via `zodResolver`, and the Set up a client form uses the same `Field`. Checked in the browser against the local API: a bad email and a short code each showed their message under the field with focus there; "Use a different email" kept the address; a typed " Admin@Example.com " was sent trimmed and lowercased; the dev admin signed in to Summit Painting; the Set up a client form still showed all three messages.

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

### F-34 [P3] fixed - Three config comments carry history the comment standard keeps out of code

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
Fixed 2026-10-01 on Frank's call (the pending tasks before step 4.2), in a chore commit on `feature/04-crm-spine`; waits for step 4.2's review to close. `backend/tsconfig.types.json` no longer says "step 2.5", and `backend/tsconfig.json` and `packages/shared/tsconfig.build.json` no longer carry "(Frank, 2026-09-26)"; each keeps its why.

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

### F-52 [P3] fixed - Three comments still point at the advisory lock and at a role check that has moved

**File:** backend/lib/admin/provision-client.ts:171
**Found:** 2026-09-30 by /audit independent (scope: current; lens: quality)
**Why it matters:** This project treats its comments and standards as the
record of why, and each of these now sends the reader to something that is not
there:
- `provision-client.ts:171` says the address "was free when this setup checked,
  under its lock". There is no lock any more; the address is held by a
  `client_setup_claim` row, and that is exactly the reason the business removed
  in the clean-up can only be this setup's.
- `require-platform-admin-middleware.ts:15` calls itself "The one place a role
  name is compared", but `provision-client.ts:143` also compares
  `login.role === "admin"` (to refuse the platform admin's email), and
  `frontend/lib/is-platform-admin.ts:5` does the same for the screen.
- `coding-standards.md:402-403` names the platform-admin exception "(see
  `allowUserToCreateOrganization`)". Since this feature that option is the
  literal `false` and compares no role; the check lives in
  `requirePlatformAdminMiddleware`.
Harmless at runtime. It is the kind of drift F-12 recorded, and the next item
that touches the setup path or the admin role reads these lines first.
**Suggested fix:** Say "under its claim" at `:171`; reword the middleware line
to "the platform admin is the one role compared by name (coding standards,
Backend)"; point the standard at `requirePlatformAdminMiddleware` instead of
`allowUserToCreateOrganization`.
**Resolution:**
Fixed 2026-10-01 on Frank's call (the pending tasks before step 4.2), in a chore commit on `feature/04-crm-spine`; waits for step 4.2's review to close. `provision-client.ts` says "under its claim"; the platform-admin middleware says the platform admin is the one role compared by name, not that it is the one place; `coding-standards.md` points the exception at `requirePlatformAdminMiddleware`.

### F-53 [P3] fixed - The same-name test passes on any refusal and only after an earlier test has run

**File:** backend/lib/crm/seed-pipeline-stages.test.ts:92
**Found:** 2026-09-30 by /audit independent (scope: step 4.1; lens: tests)
**Why it matters:** The test that proves one business cannot have "New", "new"
or "NEW" twice asserts a bare `rejects.toThrow()`, so any failed insert counts
as proof of the unique index (a broken foreign key or a renamed column would
pass it too). Every other rejection in the backend tests names the error it
expects. It also relies on `first` having been seeded by a test in the other
`describe` block: run on its own (`vitest -t "capitals ignored"`), `first` has
no stages, the `add("New")` insert succeeds and the test fails for a reason
unrelated to the rule. The rule itself is correct today (the index in
migration 0006 is `("organizationId", lower("name"))`, and the suite passes).
**Suggested fix:** Seed its own throwaway business inside the test, and assert
the refusal is the name index, for example
`rejects.toMatchObject({ cause: { constraint_name: "pipeline_stage_organization_name_unique" } })`
(or the code `23505`), for all three inserts.
**Resolution:**
Carried to step 4.2 on Frank's call, 2026-10-01. Written into that step's plan in the spec.
Fixed 2026-10-01 in step 4.2's commit; waits for step 4.2's review to close. The capitals test makes its own business, adds New, then expects each of New, new and NEW to be refused with Postgres code 23505 on `pipeline_stage_organization_name_unique`, not any failure.
