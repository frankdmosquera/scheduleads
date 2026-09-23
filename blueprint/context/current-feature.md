# Feature: Multi-tenant auth, with the org fix

**From build-plan:** feature 1

**Branch:** `feature/multi-tenant-auth-with-the-org-fix`

**Status:** verified, 2026-09-22. All six steps observed against the running
app. Two things in this spec turned out to be wrong and are recorded here
rather than quietly corrected:

- Step 6's `Done when` asks for "two organizations, **both** created only
  through the app". Only one could be: the database arrived holding the first
  repo's tenant, "The Latam Painters", adopted at step 1.2 rather than
  created here. The intent was that onboarding a tenant needs no database
  touch, and that is proved by the second one, "Ana's Hair & Co.". Deleting a
  real tenant to satisfy the letter of the gate would have been worse than
  recording the gap.
- Step 6 says to promote the admin role "through `drizzle-kit studio`". Done
  with a direct SQL update instead, which is the same act without a browser
  and can be shown in a transcript. The point of the instruction is that the
  promotion happens by hand and not through a request path, which holds.
- Step 1 lists `transpilePackages` in the Next config among its pieces, and it
  was deliberately dropped: once `packages/shared` compiled to JavaScript the
  setting did nothing, and config that does nothing is worse than none.
  `frontend/next.config.ts` is therefore untouched scaffold. The build log
  recorded this at the time; this preamble did not, which is the gap an
  independent review found as F-04.

`user.role` was then **proved** unsettable rather than asserted: a sign-in
body carrying `role: "admin"` is refused with 400 `FIELD_NOT_ALLOWED`.
`organization.plan` is safe too but fails differently, being silently
replaced by its default on create. Both are documented at the declarations in
`backend/src/lib/auth.ts`.

## Goal

A second organization can be created through the app with no database touch,
sign-in lands on that organization without a workaround, and a route behind the
package gate refuses an organization whose rung does not include it.

This is the feature that decides where the trusted actor comes from. Every item
from 2 to 26 reads its `organizationId` from whatever this feature establishes,
so the boundary it draws is the one the product keeps.

## Design reference

`prototypes/theme.css` and `prototypes/shell.css` hold the shared tokens: deep
indigo accent, roomy light default, explicit light/dark toggle with no system
setting. Port those tokens into the frontend before building any screen here.

There is no sign-in or create-organization mockup in `prototypes/`. Build both
plainly from the ported tokens. Do not invent a richer treatment than the
mockups that do exist.

## In scope

- Better Auth on the Hono backend, with the `emailOTP`, `organization` and
  `admin` plugins.
- The Better Auth Drizzle schema in `packages/shared`, plus the first
  migration, plus the subpath-export and build wiring that makes the shared
  package consumable by both sides.
- `organization.plan`, text, default `agency`, server-set only.
- The auto-active-organization fix, as a session-create hook plus the
  read-time membership fallback.
- The plan-limits config with the one rung `agency`, and the gate middleware
  every module route will call.
- `GET /me`, the dashboard bootstrap route, behind auth and the gate.
- `/sign-in` and `/create-organization` on the frontend, plus the signed-in
  shell that reads `/me`.
- Credentialed CORS for the dashboard origin, kept separate from the public
  widget origins.

## Out of scope

- The admin area and the rungs above `agency`. Item 23. This feature ships the
  `admin` plugin and the gate, not the screens or the ladder.
- Real OTP email through Resend. Item 6 owns transactional email. This feature
  ships the send seam with a development transport.
- Any product table: `booking_link`, `availability_rule`, `contact`, `lead`.
  Items 2 and 4.
- The Hono RPC `AppType` seam. Feature 1's only frontend-to-backend calls go
  through the Better Auth client, which carries its own types. The RPC contract
  arrives with item 2's first public read route.
- Invitations and a second member in one organization. No item asks for it yet;
  the schema supports it because Better Auth ships the table.
- Google OAuth verification. Item 22.

## Build loop

`stepReview` is `every` and `checkpointCommits` is `enabled`. Stop after each
build step for review, and make a checkpoint commit on the feature branch once
that step's `Done when` is observed. `/complete` makes the final feature commit
and merges.

## Build steps

- [x] **1. Make `packages/shared` real, and put the Better Auth schema in it.**
  Replace the `main`/`types` stub with subpath exports (`./db`, `./db/schema`,
  `./config`), a `tsc` build emitting `dist/`, and a `drizzle.config.ts`.
  Declare `drizzle-orm` and `zod` as dependencies and `drizzle-kit` and
  `typescript` as devDependencies; all four are already in the tree, so this
  declares what is there rather than pulling anything new in. Write the Better
  Auth tables under `src/db/schema/auth-schema/` (`user`, `session`, `account`,
  `verification`, `organization`, `member`, `invitation`), ids text, timestamps
  `timestamptz`, with the one added column `organization.plan` text not null
  default `'agency'`. Give `backend` a `prebuild` that runs
  `tsc -p ../packages/shared/tsconfig.json`, and add
  `transpilePackages: ["@scheduleads-app/shared"]` to the frontend config.
  Generate the first migration.
  **Done when:** `npm run build --workspace=backend` succeeds,
  `npm run build --workspace=frontend` succeeds, and a generated migration file
  under `packages/shared/drizzle/` contains the `plan` column with its
  `'agency'` default.

- [x] **2. Better Auth on the Hono backend.** `backend/src/database.ts` holds
  the pool; the schema comes from `@scheduleads-app/shared/db`. Write
  `backend/src/lib/auth.ts`: `drizzleAdapter` with `provider: "pg"`,
  `emailOTP`, `organization` and `admin`. Mount the handler at `/api/auth/*`.
  Configure, in this file and nowhere else:
  - `plan` as an organization additional field with `input: false`, so it can
    never be written from a request.
  - The owner role without `organization:delete`, through the plugin's access
    control. Only the platform `admin` role deletes an organization.
  - `databaseHooks.session.create.before`, stamping `activeOrganizationId` from
    the user's membership when they have exactly one. With two or more and no
    prior choice it stays unset; picking one would be guessing which tenant the
    user meant.
  - A `sendLoginCode` seam. Outside production it prints the code to the server
    console. In production it throws, so reaching production before item 6
    fails loudly instead of pretending the mail was sent. The code is never in
    a response body in either case.
  - `trustedOrigins` from `APP_ORIGIN`. Cookies stay `SameSite=Lax` in
    development, where frontend and API differ only by port on `localhost`, and
    become `SameSite=None; Secure` with a cross-subdomain domain from
    `COOKIE_DOMAIN` in production.
  Add credentialed CORS for `APP_ORIGIN` on `/api/auth/*` and the authenticated
  routes. Leave `WIDGET_ORIGINS` for the public widget reads that arrive in item
  2, and never allow credentials on those.
  **Done when:** the backend starts, requesting a sign-in code for a new email
  prints the code to the server console, the response body contains no code, and
  a `verification` row exists for that address.

- [x] **3. Active organization and the role guard.** Write
  `backend/src/lib/active-organization.ts`, ported from the first repo's
  `frontend/lib/active-organization.ts` with the Next adapters swapped for Hono
  ones: session first, then the active member, then a membership lookup as the
  fallback, returning nothing when the user has two memberships and no active
  choice. Add the Hono middleware that puts `{ userId, organizationId, role }`
  on the context, and `requireOrgRole("owner")` for the owner-only actions items
  3 and 12 will need. The organization id is derived from the session and never
  read from a body, query string or path parameter; write that rule as a comment
  where the middleware sets it, because this is where it starts.
  **Done when:** an unauthenticated request to a guarded route returns 401, a
  signed-in user with one membership resolves to that organization, and a user
  with two memberships and no active organization is refused rather than
  assigned one.

- [x] **4. The package gate.** `packages/shared/src/config/plan-limits.ts` is a
  pure config module with no database import, holding the one rung `agency` and
  the modules it unlocks. An unrecognized or null plan resolves to a locked set
  with no modules, not to `agency`: `plan` is server-set, so an unknown value is
  a misconfiguration and the gate fails closed. `backend/src/lib/plan-gate.ts`
  reads the active organization's `plan` and refuses with 403 and a stable error
  shape. Add `GET /me` behind auth, the org middleware and the gate, returning
  the user, the organization, the role, the plan and the resolved limits, and
  nothing about any other organization.
  **Done when:** `GET /me` as a signed-in owner returns that organization and
  `plan: "agency"`, and setting the same organization's `plan` to an
  unrecognized value directly in the database makes the identical request return
  403 with the stable error shape.

- [x] **5. Sign-in and create-organization on the frontend.** Add `better-auth`
  to the `frontend` workspace at the version already resolved for the backend.
  `frontend/lib/auth-client.ts` builds the client against
  `NEXT_PUBLIC_API_URL` with `organizationClient()`, `emailOTPClient()` and
  `adminClient()`, and sends credentials on every call. Build `/sign-in` as the
  two-step email then code flow, and `/create-organization` for the first
  organization. The signed-in shell reads `/me` and renders four states: the
  organization and its plan, a not-signed-in redirect, the refusal state when
  the gate returns 403, and the pick-an-organization state when the session
  resolves to no active organization. Email and code validation come from Zod
  schemas in `packages/shared` so the two sides cannot drift.
  **Done when:** `npm run build --workspace=frontend` succeeds and, with both
  dev servers running, a new email signs in with the console-printed code,
  arrives at `/create-organization`, creates an organization, and lands on a
  signed-in page showing that organization's name and the `agency` plan.

- [x] **6. The second organization, and the env and command record.** Create a
  second organization as a second user, entirely through the app. Confirm each
  session sees only its own. Update `.env.example`: `BETTER_AUTH_URL` becomes
  the API origin rather than `http://localhost:3000`, and
  `NEXT_PUBLIC_API_URL`, `APP_ORIGIN`, `COOKIE_DOMAIN` and `WIDGET_ORIGINS`
  join it. Drop the ImageKit and S3 blocks if nothing in the plan claims them,
  or leave them and say why. Record `db:generate` and `db:migrate` under
  Commands in `AGENTS.md`. Promote Frank's own user row to the `admin` role
  through `drizzle-kit studio` and note in the spec archive that no request path
  can set that field.
  **Done when:** two organizations exist, both created only through the app,
  `GET /me` for each session returns only its own organization, and both
  workspace builds pass.

## Files / areas

- `packages/shared/package.json`, `tsconfig.json`, `drizzle.config.ts` - new
  exports, build script and Drizzle config.
- `packages/shared/src/db/schema/auth-schema/*`, `src/db/index.ts` - the Better
  Auth tables and their barrel.
- `packages/shared/src/config/plan-limits.ts` - the rungs, no database import.
- `packages/shared/src/validation/auth.ts` - the email and code Zod schemas.
- `packages/shared/drizzle/` - generated migrations, committed.
- `backend/src/database.ts` - the pool.
- `backend/src/lib/auth.ts` - the Better Auth instance and every plugin choice.
- `backend/src/lib/active-organization.ts`, `backend/src/lib/plan-gate.ts` - the
  two guards.
- `backend/src/index.ts` - CORS, the auth handler mount, `GET /me`, `/health`.
- `backend/package.json` - the `prebuild` hook.
- `frontend/lib/auth-client.ts`, `frontend/app/sign-in/`,
  `frontend/app/create-organization/`, the signed-in layout.
- `frontend/app/globals.css` - the tokens ported from `prototypes/theme.css`.
- `frontend/next.config.ts` - `transpilePackages`.
- `frontend/package.json` - `better-auth`.
- `.env.example`, `AGENTS.md` - step 6.

## Data / contracts

- All ids text, Better Auth style. All timestamps `timestamptz`.
- `organization.plan`: text, not null, default `'agency'`. Server-set only,
  `input: false`. The only writer before Phase 9 is Frank, by hand.
- `user.role`: the `admin` plugin's field. Server-set only. No request path may
  write it in this feature or any later one before item 23.
- `session.activeOrganizationId`: set by the session-create hook when the user
  has exactly one membership, otherwise left unset.
- Plan resolution: a recognized rung returns its limits; anything else, null
  included, returns the locked set. The lookup lives in one function in
  `plan-limits.ts` and nothing else reads the raw string.
- `GET /me` returns `{ user: { id, email, name }, organization: { id, name,
  slug, plan }, role, limits }`. No field from any other organization appears in
  any response in this feature.
- Refusals: 401 unauthenticated, 403 for a role or plan refusal, both with the
  same JSON error shape so later items do not each invent one. Fix the shape in
  step 4 and reuse it.
- Cookies: `SameSite=Lax` in development, `SameSite=None; Secure` with the
  `COOKIE_DOMAIN` value in production. The frontend and the API must sit under
  one registrable domain in production or the session cookie is dropped.

## Testing

No unit test runner is configured and `verification.logicTests` is
`when-configured`, so this feature adds no automated tests and claims none. Each
step's `Done when` is observed by hand against the running app and the two
workspace builds. `/tests` can add a runner later; the plan-limits resolver and
the active-organization fallback are the two pieces worth covering first when it
does.

No browser test command exists, so no browser coverage is claimed.

## Notes for the AI

- The first repo put Better Auth inside Next; this repo puts it on Hono, so
  items 1 to 3 are ports of the reasoning, not of the files. Carry over the
  comments that explain *why* - the two-membership refusal, the wall around the
  secret, the never-from-the-request rule - and rewrite the adapters around
  them.
- Read these before writing, they are the proven shapes:
  `../scheduleads/frontend/lib/auth.ts`,
  `../scheduleads/frontend/lib/active-organization.ts`,
  `../scheduleads/packages/shared/package.json`,
  `../codestash/lib/config/plan-limits.ts`,
  `../codestash/lib/actions/get-org-plan-limits.ts`.
- `better-auth`, `drizzle-orm`, `postgres`, `drizzle-kit` and `resend` are
  already installed in `backend`. Step 1 declares `drizzle-orm`, `zod`,
  `drizzle-kit` and `typescript` on `packages/shared` and step 5 adds
  `better-auth` to `frontend`; every one of those is already in the lockfile, so
  nothing new enters the tree. Ask before anything else.
- Next 16 has breaking changes against older training data. Read the guide in
  `node_modules/next/dist/docs/` before writing framework code.
- Do not assert Better Auth endpoint paths from memory. Read them off the
  installed version's types when wiring step 5.
- Local Postgres goes through the SSH tunnel. When port 5433 listens but every
  query resets, kill the stale `ssh.exe`.
- The gate on `GET /me` is deliberate. An organization on an unrecognized rung
  is misconfigured and has no working product, so the dashboard refuses rather
  than rendering empty. Item 2 mounts the same middleware on the first real
  module route.

## Open questions

- **Render or Railway for the backend.** The overview says Railway; you said
  Render. It changes nothing in steps 1 to 6, which all run on localhost, but
  the production cookie needs both real hostnames under one registrable domain
  before the first deploy. Answer it at `/release`, not here.
- **Whether `.env.example` keeps its ImageKit and S3 blocks.** Scaffolder
  defaults that nothing in the plan currently claims. Step 6 either removes them
  or records why they stay; your call at that step's review.
