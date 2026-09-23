# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P1] closed - Migration 0000 has no snapshot, so the next `db:generate` recreates all seven tables

**File:** packages/shared/drizzle/meta/_journal.json:1
**Found:** 2026-09-22 by /audit (scope: current; lens: quality)
**Why it matters:** The journal records entry `0000_adopt_repo_one_tables`, but
`meta/` holds only `_journal.json`. There is no `0000_snapshot.json`.
drizzle-kit builds its previous state only from the non-underscore files in
`meta/` (`prepareOutFolder`, bin.cjs:8135) and falls back to the empty schema
when that list is empty (bin.cjs:19864). So the next generate diffs the whole
schema against nothing.

Confirmed by running it, not inferred: `drizzle-kit generate` against a
scratchpad copy of the folder produced `0001_*.sql` containing seven bare
`CREATE TABLE` statements with no `IF NOT EXISTS`, and no trace of any real
delta. Applied to the live database, which migration 0000's own comment says
already holds all seven tables, that fails on the first statement.

`AGENTS.md:378` documents `db:generate` as the way this project evolves its
schema, and build-plan item 2 opens by adding `booking_link`,
`availability_rule`, `contact` and `lead`. That is when this fires, and it
fires quietly: the generated file looks like an ordinary migration.

The hand-written 0000 is the right call for adopting the first repo's database;
the gap is only that the ledger was never given the snapshot that makes the
next diff correct.

**Suggested fix:** Commit the missing `packages/shared/drizzle/meta/0000_snapshot.json`
describing the schema as of 0000. Generate it once in a throwaway folder from the
current `schema.ts`, keep only the snapshot, rename it to `0000_snapshot.json`,
and leave the committed `0000_adopt_repo_one_tables.sql` untouched. Then confirm
a following `db:generate` reports no changes.
**Resolution:** Fixed 2026-09-22 exactly as suggested. Generated a snapshot of
the current schema into a scratchpad folder with an empty `meta/`, which
produced a first-in-chain snapshot (`prevId` all zeros, version 7, all seven
tables, `organization.plan` with its `'agency'` default, and the
`member_organization_user_unique` index). Copied it in as
`packages/shared/drizzle/meta/0000_snapshot.json`;
`0000_adopt_repo_one_tables.sql` untouched. Verified by running the real
`npm run db:generate --workspace=@scheduleads-app/shared`, which now reports
"No schema changes, nothing to migrate" where the same command previously
emitted seven bare `CREATE TABLE` statements. No stray migration file was
produced.

Closed 2026-09-23 by the second independent review, which tested the claim
rather than accepting it. `packages/shared/drizzle/meta/0000_snapshot.json` is
present, 15,341 bytes, `prevId` all zeros, version 7. Ran the real
`npm run db:generate --workspace=@scheduleads-app/shared`: exit 0, output
"No schema changes, nothing to migrate", and drizzle-kit's own summary confirms
the snapshot it read describes the current schema (`organization 7 columns`,
`member 5 columns 1 indexes`). Recorded the SHA-256 of all three files under
`drizzle/` before and after the run; none changed and no new file appeared, so
the generate really is a no-op rather than a quiet write. The repair holds. A
separate and distinct gap in the same ledger is recorded as F-06: a correct
snapshot still does not let the ledger create the schema from nothing.

### F-02 [P2] closed - The one shared refusal shape cannot be reused, so two of four refusal sites hand-roll it

**File:** backend/src/lib/active-organization.ts:41
**Found:** 2026-09-22 by /audit (scope: current; lens: quality)
**Why it matters:** The spec's Data / contracts section says refusals use "the
same JSON error shape so later items do not each invent one. Fix the shape in
step 4 and reuse it." The type is exported but `refuse` is not, so no other
module can reach it. Both remaining refusal sites therefore build the object by
hand: `backend/src/lib/plan-gate.ts:48` returns `code: "plan_required"`, which
is not a member of `Refusal["error"]["code"]`, and `backend/src/index.ts:73`
re-types a `no_active_organization` literal that already exists three lines of
code away.

The result is that the contract is documented and not enforced. Every route
from item 2 to item 26 adds refusals, and a reader has three examples to copy,
only one of them typed. `frontend/lib/api.ts:79` already branches on these code
strings with nothing shared to check them against, so a later rename on the
server goes undetected on the client.

**Suggested fix:** Export `refuse`, add `plan_required` to the
`Refusal["error"]["code"]` union, and call `refuse` from `plan-gate.ts` and
`index.ts` instead of the two literals. Exporting the union from
`packages/shared` would also let `frontend/lib/api.ts` branch on a checked type,
but that is a larger move and item 2's RPC seam may supply it instead.
**Resolution:** Fixed 2026-09-22. `refuse` is now exported from
`active-organization.ts`, and the code union is extracted as a named
`RefusalCode` type with `plan_required` added as a fourth member, each code
carrying a one-line comment saying when it applies. `plan-gate.ts` and the
`/me` missing-organization branch in `index.ts` both call the helper instead
of hand-rolling the object, so all four refusal sites now go through one
function and every code is inside the union. Proved at runtime rather than by
the build alone: unauthenticated `/me` returns 401 `unauthenticated`, and
flipping a live organization to an unrecognised plan returns 403
`plan_required` with the shared shape, then 200 again once restored. The
shared-package move stays out of scope, as the finding suggests.

Closed 2026-09-23 by the second independent review. `refuse` is exported at
`active-organization.ts:58`, `RefusalCode` is a named four-member union at lines
34 to 42, and a search for a bare `error:` object literal across `backend/src`
returns only the `Refusal` type declaration and the helper's own body, so no
call site builds the object by hand any more. All four refusal sites go through
the helper: `index.ts:74`, `active-organization.ts:144`,
`active-organization.ts:192` and `plan-gate.ts:50`. The backend build passes and
unauthenticated `GET /me` against the running API answers 401 with the shared
shape. One caveat recorded rather than reopened: the shape covers this API's own
routes only. Better Auth owns `/api/auth/*` and answers with its own message and
code shape, confirmed live against `/api/auth/organization/list`, so the
description at `frontend/lib/api.ts:40` of a shape the API "reuses everywhere"
overstates its reach. Harmless today, because `/me` is the only route that
helper parses.

### F-03 [P2] open - `GET /me` resolves the session three times and reads the same organization row twice

**File:** backend/src/lib/active-organization.ts:130
**Found:** 2026-09-22 by /audit (scope: current; lens: performance)
**Why it matters:** `requireOrganization` resolves the session at line 125, then
calls `getActiveOrganization`, which resolves it again at line 63, then calls
`auth.api.getActiveMember`, whose `orgSessionMiddleware` runs `sessionMiddleware`
and resolves it a third time (`better-auth/dist/plugins/organization/call.mjs:11`).
`session.cookieCache` is not configured in `auth.ts`, so each of the three is a
database read rather than a cookie check.

Then `plan-gate.ts:38` selects `plan` from the organization row and
`index.ts:62` selects `name` and `slug` from that same row in a second query.
The comment at `index.ts:58` notices the duplication and leaves it.

This is not a hypothesis about latency, which was not measured; it is the call
count, read off the code. It matters because `/me` is the dashboard's bootstrap
on every load and because this middleware stack is the one every route from item
2 onward mounts, so the duplication is inherited rather than confined here. Local
development runs Postgres over an SSH tunnel, where per-query cost is exactly
what is felt first.

**Suggested fix:** Have `requireOrganization` pass the session it already
resolved into `getActiveOrganization` rather than letting it re-derive one, and
resolve the active member from the session's `activeOrganizationId` with the
membership query already in that file instead of going through
`auth.api.getActiveMember`. Separately, let `requireModule` select `plan`,
`name` and `slug` in its one query and put the row on the context for the
handler to read.
**Resolution:** Re-confirmed 2026-09-23 by the second independent review and
left `open`, unchanged. All of it is still there: the three session resolutions
at `active-organization.ts:142`, `active-organization.ts:80` and inside
`auth.api.getActiveMember`, no `session.cookieCache` in `auth.ts`, and the
organization row read twice at `plan-gate.ts:39` and `index.ts:62`. The repair
commit deliberately left it, recording that the cookie cache keeps a revoked
session alive for the cache window and is therefore a decision rather than a
cleanup. That reasoning is sound, and the suggested fix above needs no cookie
cache to work. P2, so it does not block the merge.

### F-04 [P3] closed - The spec ticks step 1 including `transpilePackages`, which was deliberately dropped

**File:** blueprint/context/current-feature.md:96
**Found:** 2026-09-22 by /audit (scope: current; lens: quality)
**Why it matters:** Step 1 instructs adding `transpilePackages: ["@scheduleads-app/shared"]`
to the frontend config, and Files / areas lists `frontend/next.config.ts` for it.
The box is ticked and `frontend/next.config.ts` is untouched scaffold with no
`transpilePackages`; the file does not appear in the feature's diff at all.

The decision itself is sound and is recorded properly on the published build log
as `dropped`, with its reason, at `project-log.html:1455`. Nothing is hidden from
the person who reads the page. The gap is only in the spec, whose own preamble
records two other deviations "rather than quietly corrected" and is silent on
this third one. The spec is what `/complete` archives and what the review hash
pins, so it is the copy that outlives the page's current state.

**Suggested fix:** Add one line to the spec's Status preamble naming the dropped
piece and pointing at the build log entry, in the same form as the two
deviations already listed there.
**Resolution:** Fixed 2026-09-22. A third bullet added to the spec's Status
preamble naming `transpilePackages` as deliberately dropped, why it was
dropped (once `packages/shared` compiled to JavaScript the setting did
nothing), that `frontend/next.config.ts` is therefore untouched scaffold, and
that the build log carried it at the time while the preamble did not. Note
this changes the spec bytes, so the review receipt's spec hash no longer
matches and a fresh review is required regardless.

Closed 2026-09-23 by the second independent review. The third bullet is present
at `current-feature.md:22-27` and says all of that. Confirmed the state it
describes rather than the claim: `frontend/next.config.ts` is seven lines of
untouched scaffold with no `transpilePackages`, and both workspace builds pass
without it, so the dropped setting genuinely does nothing. The specific gap this
finding named is gone. Two other spec-to-reality gaps survived the amendment and
are recorded separately as F-10 rather than keeping this entry open.

### F-05 [P1] fixed - Any email address can create an account and unlimited tenants on the `agency` rung

**File:** backend/src/lib/auth.ts:110
**Found:** 2026-09-23 by /audit (scope: current; lens: security)
**Why it matters:** This feature's stated Goal is that it "decides where the
trusted actor comes from" and that "the boundary it draws is the one the product
keeps". The boundary it draws admits anyone.

Three permissive defaults are left untouched, each read off the installed
better-auth 1.7.5 rather than assumed:

- `emailOTP` is configured without `disableSignUp`. `routes.mjs:102` computes
  `shouldSendOTP` as `type === "sign-in" && !opts.disableSignUp`, and
  `routes.mjs:412` refuses account creation only when `disableSignUp` is set. So
  a `sign-in` code is issued for an address that has no account, and verifying
  it creates the user.
- The `organization` plugin is configured without
  `allowUserToCreateOrganization`. `crud-org.mjs:56` resolves an undefined
  option to `true`, so every authenticated user may create an organization.
- `organizationLimit` is also unset. `crud-org.mjs:61` evaluates the whole cap
  expression to `false` when the option is absent, so there is no per-user
  ceiling either.

New organizations take `plan: "agency"` from the `defaultValue` at
`auth.ts:135`, and `plan-limits.ts:31` gives `agency` both `booking` and `crm`.
The reachable path is therefore: a stranger requests a code for any address they
control, verifies it, gets a user row, then posts to
`/api/auth/organization/create` as many times as they like, each one a tenant on
the paid rung.

That contradicts a written product decision, not a matter of taste.
`project-overview.md:254` says "Agency-provisioned first ... Frank creates the
organization and bills as the agency"; `project-overview.md:32` puts the
self-serve customer in Phase 9; `build-plan.md:189` is item 25, "Self-serve
onboarding and billing - signup, pick a package". `AGENTS.md:16` says the same
thing with a different phase number. Nothing anywhere asks for open signup now.

**The timing is the dangerous part.** It is not exploitable in production today,
because `send-login-code.ts:30` throws in production, so no code is ever issued
there and nobody can sign in at all. It becomes exploitable the moment
build-plan item 6 swaps Resend into that seam, with no other change. Item 6's
charter is transactional email; nobody working it will be looking at signup
policy, and the spec itself describes that step as the send seam being
"swapped". A guard that has to be remembered during an unrelated item is a guard
that will not be there.

**Suggested fix:** Two options on the `betterAuth` call in
`backend/src/lib/auth.ts`, one line each. On `emailOTP`, set
`disableSignUp: true` if only existing users should ever sign in. On
`organization`, set `allowUserToCreateOrganization` to a function that returns
true only for the platform admin until item 25 relaxes it, and set
`organizationLimit` to a real number. Whichever is chosen, say so at the
declaration, because the next reader will assume the permissive default was
deliberate. If Frank decides the risk window is acceptable and the guard belongs
to item 6 or item 25, that is his call to record as `accepted` with the reason;
it should not be closed silently.

**Resolution:** Fixed 2026-09-22 in `3030ef0`, partially, and the rest
deliberately deferred rather than silently dropped. The finding named three
permissive defaults; they did not all deserve the same answer.

- `allowUserToCreateOrganization` is now a function returning true only when
  `user.role === "admin"`, at `backend/src/lib/auth.ts:136`, with the reason
  written at the declaration as the finding asked. This is the half that was
  actually a hole: it is what stood between a stranger and an unlimited supply
  of `agency`-rung tenants. The commit records a live proof, signed in as a
  non-admin through the app and posting to `organization/create`: 403
  `YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION`, organization count
  unchanged afterwards.
- `disableSignUp` is now set, 2026-09-23, a day after the first half. It was
  briefly left open on the argument that a client being onboarded needs to
  sign in and has no user row yet. That is true in general and was wrong here:
  it assumed someone was mid-onboarding, and nobody is. Every user who needs
  to sign in today already exists, so the door had no legitimate user at all,
  while it did have a cost - this API could be made to send mail to any
  address a stranger named, which is what item 6 turns real by putting Resend
  behind the send seam. Existing users are unaffected, verified against
  `routes.mjs:103`, which short-circuits only when `findUserByEmail` comes
  back empty. The deliberate consequence is that a new client now cannot get
  in at all without the agency, which is what build-plan item 3b exists to
  provide.
- `organizationLimit` is still unset and is now moot. It caps organizations
  per user, and the only user who may create one is the platform admin, so the
  cap would only ever restrain Frank. Left off deliberately; if item 25 ever
  reopens creation to ordinary users it has to come back in the same edit.

Verified beyond the commit's own claim, against the installed better-auth
1.7.5 source rather than its docs. `crud-org.mjs:57` resolves the option and
refuses when it returns false. Two bypasses were checked and neither is
reachable over HTTP: a signed-in non-admin cannot impersonate by putting
`userId` in the body, because `user` is taken from the session and the
permission check runs against them (`crud-org.mjs:48-55`); and the
`isSystemAction` escape at `crud-org.mjs:57-58`, which does skip the check,
sits behind `if (!session && (ctx.request || ctx.headers)) throw UNAUTHORIZED`
at `crud-org.mjs:47`, and both of those are always present on an HTTP call.
That escape exists for direct server-side `auth.api` calls with no headers,
which nothing in this codebase makes today. Worth carrying into item 3b: it is
the sanctioned provisioning path, and it is also the one place a later
server-side caller could create an organization without the admin check, so
that item should say so where it uses it.

Not re-proved at runtime in this pass: the dev API was not running and
bringing it up needs the Railway SSH tunnel. The live 403 recorded above is
the builder's, from the fix commit. An independent review pass should re-run
it before moving this to `closed`.

### F-06 [P2] open - The migration ledger can only alter tables, so `db:migrate` fails on any fresh database

**File:** packages/shared/drizzle/0000_adopt_repo_one_tables.sql:15
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** Migration 0000 is entirely `ALTER TABLE` plus one
`CREATE UNIQUE INDEX`. There is no `CREATE TABLE` anywhere under
`packages/shared/drizzle/`. Postgres applies `ADD COLUMN IF NOT EXISTS` to the
column, never to the table, so line 15's `ALTER TABLE "user" ADD COLUMN IF NOT
EXISTS "role" text` errors with `relation "user" does not exist` against an
empty database, and the migration aborts on its first statement.

Adopting the first repo's tables instead of recreating them was the right call
for the one database that exists, and F-01's snapshot now makes the ledger diff
correctly going forward. This is the other half of the same gap: the ledger can
evolve that database but can never produce it. There is no sanctioned substitute
either, because `coding-standards.md` forbids `drizzle-kit push` against
anything but a local scratch database.

`AGENTS.md:379` records `db:migrate` as how this project applies schema, and
this fires the first time anyone stands up a staging database, a CI database, or
a replacement Railway instance. Deployment is the next thing after this feature:
the spec's own Open questions leave Render versus Railway to `/release`.

Not reproduced against a real empty database, because this review may not create
one or modify any row. The conclusion is read off the SQL and Postgres's
documented behaviour for `ADD COLUMN IF NOT EXISTS`, which is unambiguous.

**Suggested fix:** Nothing in migration 0000 should change; it is applied. Add
`0001` as the bootstrap instead, generated from the current schema into a
throwaway folder so it is the seven `CREATE TABLE IF NOT EXISTS` statements plus
their constraints, then hand-checked so it is a no-op against the live database
and a full create against an empty one. Confirm both directions before
committing, and say at the top of the file that it exists because 0000 adopts
rather than creates.

**Resolution:**

### F-07 [P2] fixed - `/me` refuses any rung that lacks `crm` and tells the user their plan is unrecognized

**File:** backend/src/index.ts:53
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** The rule the code says it implements and the rule it
implements are different rules.

Stated in three places: `index.ts:46` says "A business on a rung nothing
recognises is misconfigured and has no working product"; the spec's Notes for
the AI say "An organization on an unrecognized rung is misconfigured ... so the
dashboard refuses rather than rendering empty"; and the dashboard copy at
`frontend/app/page.tsx:77` tells the user "Your business is on a plan this
dashboard does not recognise".

Implemented: `requireModule("crm")`, which refuses whenever the resolved limits
do not include `crm`, recognized or not.

Today the two coincide, because `agency` is the only rung and it carries both
modules. Build-plan item 23 is "the rungs above `agency` in the plan-limits
config, what each unlocks", and `project-overview.md:255` says "each rung
unlocks modules through the plan-limits config". The first rung that unlocks
`booking` without `crm`, which is the obvious shape of a cheaper booking-only
tier, locks that tenant out of the dashboard entirely and shows them a sentence
that is false: their plan is recognized, it just does not include the CRM.
`index.ts:53` is also the middleware stack item 2 onward copies, so the
conflation propagates rather than staying here.

**Suggested fix:** Decide which rule is wanted and make one of the two match.
Either gate `/me` on the rung being recognized rather than on a module, letting
the dashboard render whatever the plan does include, or keep the `crm` gate and
rewrite the three comments and the user-facing sentence to say what it actually
does. In either case the frontend refusal should render the API's own message,
which it already receives at `api.ts:84`, rather than asserting a cause.

**Resolution:** Fixed 2026-09-23, choosing the first of the finding's two
options: the dashboard's front door asks only that the rung be recognised, and
each module's own route checks what the rung unlocks. Frank's call. The other
option, keeping the `crm` check and rewording the comments, would have locked
out the first booking-only tier entirely, and a price ladder is the next thing
item 23 builds.

The gate is now two layers in `backend/src/lib/plan-gate.ts`.
`requireKnownPlan` reads the rung and refuses one the config does not define.
`requireModule` reads what the first put on the context and refuses a rung that
lacks the module, costing no query of its own. `/me` mounts only the first.
Each throws if the layer before it is missing, the pattern `requireOrgRole`
already used.

Three things came with it, each so that a refusal never asserts the wrong cause:

- A new refusal code, `plan_unrecognised`, kept apart from `plan_required`.
  They mean different things to a customer, and the dashboard's refusal screen
  was already claiming the first while the code sent the second.
- A missing organization row now answers `no_active_organization` from the
  gate, where it used to fall through to a plan refusal. The session pointing at
  a deleted business is not a plan problem.
- `frontend/lib/api.ts` now branches on `plan_unrecognised` by name. Any other
  403 falls through to the unexpected-status answer instead of being shown the
  "plan not recognised" screen, which is what the finding's last sentence
  asked for.

Found alongside, and fixed in the same edit because it was the same line:
`getPlanLimits` tested `plan in PLAN_LIMITS`, and `in` walks the prototype.
`"constructor"`, `"toString"` and `"__proto__"` all passed it and resolved to
functions with no `modules`, so a plan hand-edited to any of them would have
crashed the gate with a 500 rather than failing closed with a 403. Now
`Object.hasOwn`, behind a new exported `isKnownRung`. Tested against the
compiled `dist/`, not the types: `agency` is known with both modules, and
`toString`, `constructor`, `__proto__`, `enterprise`, the empty string, null
and undefined all resolve to unknown and no modules.

Backend build, frontend build and lint pass. Not proved against the running
API in this pass: that needs the SSH tunnel and a signed-in session, and
flipping a live organization's plan to prove the 403. The independent review
that closes F-05 needs the same setup and should re-run the plan flip here,
now expecting `plan_unrecognised` rather than `plan_required`.

### F-08 [P2] fixed - `APP_ORIGIN` and `BETTER_AUTH_URL` fall back to localhost in production instead of refusing to boot

**File:** backend/src/index.ts:27
**Found:** 2026-09-23 by /audit (scope: current; lens: security)
**Why it matters:** `backend/src/index.ts:27` and `backend/src/lib/auth.ts:36`
both default `APP_ORIGIN` to `http://localhost:3000`, and `auth.ts:74` defaults
`BETTER_AUTH_URL` to `http://localhost:3001`. That value becomes the single
credentialed CORS origin (`index.ts:29-34`) and Better Auth's only trusted
origin (`auth.ts:89`). A production deploy that misses the variable therefore
grants `http://localhost:3000` the right to send credentials to the live API,
which is narrow but real: anything the victim runs on that port could call the
API with their session attached.

The same two files throw for `BETTER_AUTH_SECRET` (`auth.ts:27`) and
`DATABASE_URL` (`database.ts:16`), so the pattern here is inconsistent as well
as fail-open. `frontend/lib/auth-client.ts:29-42` argues carefully for its own
fallback, and that argument is specific to `NEXT_PUBLIC_*` values being inlined
at build time. Neither backend variable is inlined; both are read at runtime,
where a throw is a failed boot rather than a failed local build.

Recorded honestly: the blast radius is limited, because a production deploy
missing `APP_ORIGIN` is also a broken deploy. `trustedOrigins` would reject the
real dashboard origin, so the app would not work and the mistake would be
noticed. The finding is the direction of the failure, not a live exposure. CORS
itself is correctly scoped today: a request carrying an unlisted Origin gets no
`Access-Control-Allow-Origin` header back, verified against the running API.

**Suggested fix:** Throw for both when `NODE_ENV === "production"`, beside the
two checks that already do, and keep the localhost default for development only.
`/release` owns deployment readiness and is a natural second place to check them,
but a check in the code is what makes the boot fail rather than the review.

**Resolution:** Fixed 2026-09-23 as suggested. Both variables now go
through one helper in `backend/src/lib/auth.ts`, `settingWithDevDefault`, which
returns the value when set, the localhost default in development, and throws in
production. That matches the two checks the same files already made for
`BETTER_AUTH_SECRET` and `DATABASE_URL`, so the pattern is consistent as well
as closed. The reasoning, including why the frontend's `NEXT_PUBLIC_API_URL`
keeps its fallback while these do not, is written at the helper.

Went one step past the suggestion. `APP_ORIGIN` was read twice, at
`index.ts:27` and `auth.ts:36`, each with its own copy of the default. It is
now read once, exported from `auth.ts`, and imported by `index.ts` for CORS,
so the credentialed CORS origin and Better Auth's trusted origin cannot drift
apart. An empty string counts as unset, because `APP_ORIGIN=` left blank in a
platform's env editor is a mistake rather than an origin.

Proved by running the compiled module, not inferred from the diff. Imported
`backend/dist/lib/auth.js` directly with no `.env` loaded, a dummy secret and a
database URL pointing nowhere, under five environments:

- production with neither set: refused, naming `APP_ORIGIN`
- production with only `APP_ORIGIN`: refused, naming `BETTER_AUTH_URL`
- production with `APP_ORIGIN` set to the empty string: refused, naming it
- production with both set: booted, `appOrigin` the configured value
- development with neither set: booted, `appOrigin` `http://localhost:3000`

`/release` remains a natural second place to check these, but the boot now
fails without it, which is the direction the finding asked for.

### F-09 [P2] fixed - `coding-standards.md` now contradicts the shipped code in three places

**File:** blueprint/context/coding-standards.md:52
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** `AGENTS.md` lists this file as "read before changing code".
Feature 1 made three of its statements false and none was updated, so the next
agent that obeys it will undo a deliberate decision.

- The `packages/shared` paragraph says the package "exposes subpath exports that
  point at source files, no barrel". They point at `dist/`
  (`packages/shared/package.json:6-19`), and `AGENTS.md:387` now states the
  opposite of the standard: "`packages/shared` compiles to `dist/` and both apps
  build it first". An agent following the standard would add a source-pointing
  export and break both builds.
- Styling says "Dark mode first, light mode as option". `frontend/app/globals.css`
  ports the mockups' explicit decision, which is light by default with dark
  reachable only through `data-theme="dark"`, and says so at length.
- Comments says "No banner/header blocks, section dividers, or step-by-step
  narration" and "Over-commenting is a common AI tell, so resist it". Every new
  file in this feature opens with a header block, `globals.css` uses long rules
  of equals signs as section dividers, and `backend/src/lib/send-login-code.ts`
  is 17 lines of comment above 18 lines of code.

The comments are not the problem: they carry the reasoning this project
deliberately keeps, and the spec's Notes for the AI ask for exactly that. The
problem is a standards file that forbids what the project has decided to do,
which is the two-levels-contradicting failure the workspace `CLAUDE.md` says
must never happen.

**Suggested fix:** Edit `coding-standards.md` to match what shipped, not the
other way round. Correct the `packages/shared` sentence to `dist/`, replace
"Dark mode first" with the explicit-toggle decision the mockups actually make,
and narrow the Comments section so it forbids comments that restate the code
while permitting the file-level why-blocks this codebase is built on.

**Resolution:** Fixed 2026-09-23, editing the standards to match what
shipped rather than the other way round, which is the direction the finding
asked for. All three statements were confirmed false before being touched.

- The `packages/shared` paragraph said the subpath exports "point at source
  files, no barrel". They point at `dist/` (`package.json:8-13`). Rewritten to
  say so, to keep the extensions reason that made it true once, and to add the
  warning the old text invited: an export pointing at `src/` breaks both builds.
- "Dark mode first, light mode as option" is the opposite of what shipped.
  `globals.css:117` defines light on `:root` and `globals.css:215` puts dark
  behind `[data-theme="dark"]`, with no `prefers-color-scheme` anywhere and no
  third "system" state. Replaced with the decision the mockups actually make.
- The Comments section forbade "banner/header blocks" and warned that
  over-commenting is an AI tell, while every file this feature added opens with
  a why-block. Narrowed rather than deleted: restating the code is still
  forbidden, region-announcing comments and narration are still forbidden, and
  file-level blocks carrying a decision or a rejected alternative are now
  explicitly encouraged. Added the citation habit this feature used throughout,
  naming the dependency file and line a behaviour was read from.

The comments were never the problem and none were removed. The problem was a
file `AGENTS.md` tells the next agent to read before changing code, telling
them to undo deliberate decisions, which is the two-levels-contradicting
failure the workspace `CLAUDE.md` forbids.

### F-10 [P3] fixed - The spec still lists step 1 pieces that never shipped, and its own deviation count is now wrong

**File:** blueprint/context/current-feature.md:8
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** F-04's repair added the missing `transpilePackages` bullet
and stopped there. Two gaps of the same kind survive in the same preamble, and
the repair introduced a third.

- Line 8 still reads "Two things in this spec turned out to be wrong" above
  three bullets. The count was not updated when the third was added, and
  `AGENTS.md` is explicit that a bare count beside a list is how a reader is
  misled.
- Step 1 (line 98) lists `./db/schema` among the subpath exports and (line 103)
  says to write the tables "under `src/db/schema/auth-schema/`"; Files / areas
  (line 206) lists `packages/shared/src/db/schema/auth-schema/*` and
  `src/db/index.ts`. What shipped is a single `packages/shared/src/db/schema.ts`
  with no `db/index.ts`, and the third export is `./validation`, which step 1
  never names. `schema.ts:19-23` explains the one-file decision well; the
  preamble does not record it.

Same consequence F-04 named: the spec is what `/complete` archives and what the
review hash pins, so it is the copy that outlives the build log's current state.

**Suggested fix:** Change "Two things" to "Three things", or drop the count and
let the bullets speak. Add one bullet naming the one-file schema and the
`./validation` export in place of `./db/schema`, pointing at the reason already
written in `schema.ts`.

**Resolution:** Fixed 2026-09-23, both halves.

The count is gone rather than corrected. `AGENTS.md` is explicit that a bare
count beside a list misleads, and this one had already gone stale once; a
number that has to be maintained in step with a list it sits above will go
stale again. The preamble now says what it is and why it carries no number.

The missing deviation is recorded as a fourth bullet: step 1 named
`./db/schema` among the exports and told the builder to write the tables under
`src/db/schema/auth-schema/`, with Files / areas listing that directory and
`src/db/index.ts`. What exists is one file, `packages/shared/src/db/schema.ts`,
no barrel, no `db/index.ts`, and a third export of `./validation` that step 1
never mentions. Confirmed against the tree rather than assumed: `src/` holds
exactly three files. The bullet points at the argument already written at
`schema.ts:19-23` instead of restating it.

### F-11 [P3] fixed - `.env.example` claims every variable it lists is read today, and two are not

**File:** .env.example:8
**Found:** 2026-09-23 by /audit (scope: current; lens: quality)
**Why it matters:** Line 8 states "Every variable listed here is read by code
that exists today", and justifies it: "A variable in an example file that nothing
reads teaches the next person to configure something that does nothing". Two of
the entries then say the opposite about themselves. `WIDGET_ORIGINS` at line 56
says "Arrives with build-plan item 2; nothing reads it yet", and
`RESEND_API_KEY` at line 61 is claimed by item 6. Both are genuinely unread:
nothing under `backend/src` references either name.

Each entry is honest on its own, which is why this is small. The header is not,
and it is the line a reader trusts before reading the rest.

**Suggested fix:** One clause on line 8: every variable is either read today or
says which build-plan item claims it. That keeps the rule the header exists to
state while describing the file as it actually is.

**Resolution:** Fixed 2026-09-23 with the one clause the finding
suggested. The header now says every variable is either read by code that
exists today or names the build-plan item that claims it, and names the two of
the second kind, `WIDGET_ORIGINS` and `RESEND_API_KEY`, so a reader meeting
them further down is not surprised. The rule the header exists to state
survives; it now describes the file as it actually is. The ImageKit, S3 and
volume sentence is untouched, because that part was always true.
