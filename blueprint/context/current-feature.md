# Feature: Client access: provisioning, and closing signup

**From build-plan:** feature 3b

**Branch:** feature/03b-client-access-provisioning-and-closing-signup

**Status:** verified. Whole feature seen and agreed by Frank 2026-09-30; steps
3b.1 to 3b.3 built, checked and reviewed step by step; step 3b.3's review
findings F-48 to F-51 fixed 2026-09-30, F-49 by the claim table on Frank's
choice. The checkpoint for the final review.

Branch named in the workspace's `feature/NN-name` form, as feature 3's was, so
one number finds the branch, the archive (`03b-...md`) and the tag
(`item-03b-done`).

## Goal

The agency can turn a signed contract into a working login. The platform admin
fills in one form (the business's name, the client's name, the client's email)
and the API creates the client's login and the client's business together,
with the client as its business owner and its first person. The client then
signs in at `/sign-in` with a code sent to that email and lands straight in
their own business. The platform admin is never a member of it.

The second half closes the two doors that are still open beside it: nobody,
the platform admin included, creates a business through Better Auth's own
`/organization/create` any more, and owners cannot invite people, because
there is no invitation flow. Self-signup itself was already closed on
2026-09-23 (`disableSignUp: true`), so this feature does not touch the sign-in
form's behaviour.

Today an onboarded client cannot reach the product at all. Nothing except this
feature lets them, which makes it a prerequisite for Phase 5 and any
client-facing deploy.

## In scope

- `POST /admin/clients`, a platform-admin-only route that creates the client's
  login and business in one request, through Better Auth's own pieces
  (`auth.api.createUser` from the `admin` plugin, `auth.api.createOrganization`
  from the `organization` plugin), with no request headers, so Better Auth
  treats both as server actions on behalf of the client.
- If the business cannot be created after the login was, the login this
  request made is removed again. No request ever leaves a login with no
  business behind.
- `requirePlatformAdminMiddleware`, the one gate for `/admin/*` routes:
  `user.role === "admin"` on the session, the exception the coding standards
  already name.
- One shared Zod schema for the form and the route.
- Closing Better Auth's HTTP business creation for everyone
  (`allowUserToCreateOrganization: false`), and owners' and org admins'
  invitation permissions (`invitation: []`), closing F-16's first half. F-16's
  second half is a comment correction: the platform admin can set `user.role`
  through the admin plugin's `/admin/set-role`, which the comments deny.
- The admin screen `/admin/clients/new`: the form, its states, and the success
  card. Built on shadcn `Input` and `Label` with react-hook-form, per the Forms
  standard (the first form to follow it; see F-14).
- A link to that screen on the dashboard, shown to the platform admin only.
- The signed-in-with-no-business screen (F-13): an ordinary user is told their
  login has no business yet and to contact the agency, with Sign out; the
  platform admin is sent to `/admin/clients/new`.
- Deleting `/create-organization`, which can only refuse once HTTP creation is
  closed.
- The comment corrections F-12 lists in the files this feature touches.

## Out of scope

- **A welcome or invitation email.** There is no email transport until
  feature 6 (Resend). The success card tells the platform admin to let the
  client know. Production sign-in itself cannot send a code until feature 6
  (`send-login-code.ts` throws in production); unchanged here.
- **An owner adding their own staff logins**, invitations, a second member in
  one business. Crew sign-in is named, not planned.
- **Listing, editing, suspending or deleting clients**, moving a client's
  plan, and an audit trail of who set up whom. Feature 23, the admin area.
- **The client's services and hours.** The client sets them in the app
  (feature 12); feature 10 decides how the agency's own business gets its
  first ones.
- **The dev seed.** `admin@example.com` still owns Summit Painting (dev) in
  development. That is a fixture, not a client, and Frank's calendar tests run
  on it. Unchanged.
- **Self-serve signup and business creation.** Feature 25 reopens both, in one
  edit, together with `organizationLimit`.
- **React Query.** One mutation with no cached list; the standard's React
  Query settings apply when the first list arrives (feature 11).
- Better Auth's own `/admin/create-user`, `/admin/set-role` and the rest of the
  admin plugin's HTTP routes stay as they are: platform admin only, and not
  used by the app.

## Build loop

`workflow.stepReview` is `every` and `workflow.checkpointCommits` is
`enabled`.

Each step's plan (Part 1, what it builds; Part 2, Done when) is gone through
with Frank and gets its own yes just before it is built. After that yes the
step runs straight through without asking: build, tests and checks, tick the
box here, write the build log entry and push buildlogs, commit
(`feat: 3b.N <what>`) and push to the feature branch, `/audit` scoped to the
step, then the independent review. The one planned stop is after the review,
where its findings are talked through. P0/P1 are fixed before the next step,
or Frank accepts them with a reason; P2/P3 are recorded and carried.

Only three things stop a step earlier: the agreed plan turns out wrong while
building, a line only Frank crosses (a package, Railway or real data, `main`,
a merge, a force push, deleting anything), or blocking review findings.

`/complete` runs its own final review over the already-reviewed steps, then
merges with a merge commit on Frank's yes.

## Build steps

- [x] **3b.1 The provisioning route.** One request makes the client's login
  and business, with the client as business owner and first person.
  - **Blocker, answered by Frank 2026-09-30: A, refuse.** An email that
    already has a login is `409 email_taken`; one login is one business for
    now. Rejected, B: add the business to that login (a typo hands a business
    to the wrong person, and they pick a business at every sign-in).
  - **Added by Frank 2026-09-30: running the setup again finishes it.** An
    email whose login belongs to no business, and whose `role` is not
    `"admin"`, can only be a setup that did not finish (a crash between the
    two creates, where the clean-up never ran). It is not refused: the
    business is made under that existing login instead. An email whose login
    belongs to any business is still `409 email_taken`. The platform
    admin's login is never reused. The clean-up after a failed business
    stays, as the second safety net.
  - `packages/shared/zod-validation/admin-validation-schemas/provision-client-validation-schema.ts`:
    `businessName` (the existing business-name rule, reused, not copied),
    `clientName` (trimmed, 1 to 100 characters), `clientEmail` (the sign-in
    email rule: trimmed, lowercased, valid). Exported through the package's
    existing `zod-validation` entry. Tests beside it.
  - `backend/middleware/auth-middleware/require-platform-admin-middleware.ts`:
    reads the session with `auth.api.getSession`; none is `401
    unauthenticated`; a user whose `role` is not `"admin"` is `403 forbidden`.
    Not organization-scoped: the platform admin may belong to no business.
  - `backend/lib/admin/provision-client.ts`, one exported function:
    1. slug from `toSlug(businessName)`; empty is `400 bad_request`
    2. the email already has a login: `409 email_taken` when that login
       belongs to any business or is the platform admin; otherwise it is an
       unfinished setup, so step 4 is skipped and its user id is used
    3. the slug is taken: `409 slug_taken`
    4. `auth.api.createUser({ body: { email, name } })`, no headers
    5. `auth.api.createOrganization({ body: { name, slug, userId } })`, no
       headers, so the client is the creator and `creatorRole: "owner"` makes
       them business owner; the existing `afterCreateOrganization` hook makes
       the first person and links it to them
    6. if 5 throws, the login made in 4 (never one reused in 2) is deleted (cascade takes its
       sessions and accounts) and the answer is `409 slug_taken` when the slug
       turned out taken in between, otherwise the error is rethrown (500). A
       failed delete is logged with the user id only.
    The call site carries the comment the build plan asks for: these two
    server calls skip Better Auth's own admin checks because they carry no
    headers, so this function must only ever run behind
    `requirePlatformAdminMiddleware`, and must never be handed the request's
    headers (that would make the platform admin the creator, and so the
    business owner).
  - `backend/routes/admin-routes.ts`: `POST /clients`, mounted at `/admin` in
    `app.ts` with `dashboardCorsMiddleware`, `dashboardCsrfMiddleware` and
    `dashboardNoStoreMiddleware` on `/admin/*`, then
    `requirePlatformAdminMiddleware`. Validates the body with the shared
    schema before any database call (a failed parse is `400 bad_request`;
    malformed JSON is Hono's own plain 400, F-36). Answers `201`.
  - `backend/lib/errors/refuse.ts`: adds `email_taken` and `slug_taken`.
  - `backend/routes/admin-routes.test.ts` against the local `scheduleads_dev`,
    signing in the real way as the existing route tests do, cleaning up its
    own rows.
  - **Done when** the backend and shared tests pass (`npm run test
    --workspace=@scheduleads-app/shared`, `npm run test --workspace=backend`)
    and the backend builds, with tests proving: no session is 401;
    `owner@example.com` is 403; a bad body is 400; the platform admin gets
    201 and the database then holds a login for the client (`role` `user`),
    a business with that slug on plan `agency`, the client as its only member
    with role `owner`, its first person linked to the client, and no
    membership for the platform admin; an existing email is 409
    `email_taken` and creates nothing; a login with no business (made
    directly in the test) gets its business on a second setup, keeping its
    user id, while the platform admin's email is still `email_taken`; a taken slug is 409 `slug_taken` and
    leaves no login behind; a business creation forced to fail
    (`vi.spyOn(auth.api, "createOrganization")`) leaves no login behind; and
    the new client signs in with a code and `GET /me` answers their business
    with role `owner`.

- [x] **3b.2 Close the old doors.** Only the provisioning route makes a
  business, and nobody can invite.
  - `backend/lib/auth/auth-server.ts`: `allowUserToCreateOrganization: false`
    with its comment rewritten (no one creates a business over HTTP; the
    platform admin provisions through `POST /admin/clients`; feature 25
    reopens it together with `disableSignUp` and `organizationLimit`);
    `invitation: []` for `owner` and `admin`; the `user.role` comment says
    the admin plugin's `/admin/set-role` can set it (F-16); the
    `afterCreateOrganization` comment no longer says "today the platform
    admin".
  - The F-12 comment lines in `auth-server.ts` and `sign-in/page.tsx` and
    the shared schema comments that claim server-side use, corrected to the
    code.
  - **Carried from step 3b.1's review (Frank, 2026-09-30):**
    - F-36: Data / contracts says malformed JSON is Hono's own plain 400,
      and a missing or wrong body is `400 bad_request`.
    - F-37: tests that `/admin` answers carry `Cache-Control: no-store`
      and that a form-encoded post from another origin with the platform
      admin's cookie is refused and makes nothing.
    - F-39: finishing an unfinished setup writes the client's name just
      typed over the one on the reused login, and the answer returns it.
    - F-41: force a failing `createUser` and read the log; if the email
      shows, log a safe reason instead and rethrow without the query's
      parameters.
  - **Done when** backend tests prove: the platform admin's own
    `POST /api/auth/organization/create` is 403 and creates nothing; an
    owner's `POST /api/auth/organization/invite-member` is 403; and every 3b.1
    test still passes, so provisioning is unaffected; the F-37 tests pass; a
    retried setup's answer and stored login carry the new name (F-39); and
    a forced `createUser` failure leaves no email in the log (F-41). F-16,
    F-36, F-37, F-39 and F-41 set to `fixed`.

- [x] **3b.3 The admin screen, and nobody stuck.** The platform admin sets up
  a client in the browser; a login with no business is told what to do.
  - `npx shadcn add input label` into `frontend/components/ui/`. If the CLI
    wants to install any package, stop and ask before it does.
  - `frontend/app/admin/clients/new/page.tsx` and
    `frontend/components/admin/new-client-form.tsx`: react-hook-form with the
    shared schema through `@hookform/resolvers/zod`, shadcn `Input` and
    `Label`, the existing `AuthCard` shell.
  - `frontend/lib/api-client.ts`: `provisionClient()` through
    `dashboardApiClient.admin.clients.$post`, one result state per screen,
    as `fetchMe` does.
  - `frontend/app/page.tsx`: the dashboard shows "Set up a client" to the
    platform admin only; `PickOrganization` with an empty list shows the
    no-business card (ordinary user) or goes to `/admin/clients/new`
    (platform admin), never `/create-organization`.
  - `frontend/app/create-organization/page.tsx` deleted, and the now unused
    pieces of `auth-card.tsx` with it if nothing else uses them.
  - F-40, carried from step 3b.1's review: the business-name rule and the
    email rule each move to a file of their own name, and the business-name
    message reads for either a client's business or your own.
  - **Done when** `npm run build --workspace=frontend` and `npm run lint
    --workspace=frontend` pass, and in the browser against the local API:
    the platform admin sets up a test client and sees the success card; that
    client signs in with the code from the API's console and lands on their
    own business as owner, with the calendar card showing their own person;
    `owner@example.com` opening `/admin/clients/new` sees the not-for-you
    card; an email already in use shows its message under the email field.
    The test client is removed afterwards. F-13 and F-40 set to `fixed`.

## Files / areas

- `packages/shared/zod-validation/admin-validation-schemas/` (new),
  `packages/shared/zod-validation/index.ts`, the business-name schema it
  reuses, and the sign-in email schema
- `backend/middleware/auth-middleware/require-platform-admin-middleware.ts`
  (new)
- `backend/lib/admin/provision-client.ts` (new)
- `backend/routes/admin-routes.ts` and `admin-routes.test.ts` (new)
- `backend/app.ts`, `backend/lib/errors/refuse.ts`,
  `backend/lib/auth/auth-server.ts`
- `frontend/app/admin/clients/new/page.tsx`,
  `frontend/components/admin/new-client-form.tsx`,
  `frontend/components/ui/input.tsx`, `frontend/components/ui/label.tsx`
  (new)
- `frontend/app/page.tsx`, `frontend/lib/api-client.ts`,
  `frontend/components/auth-card.tsx`, `frontend/app/sign-in/page.tsx`
  (comments only)
- `frontend/app/create-organization/page.tsx` (deleted)

## Data / contracts

One migration, `0005_client_setup_claim` (step 3b.3's review, F-49): the
`client_setup_claim` table below. Every other table already exists.

**`POST /admin/clients`**

- Dashboard route: dashboard CORS (only `APP_ORIGIN`, with the cookie), the
  origin check, `Cache-Control: no-store`.
- Who: a session whose user has `role === "admin"`, read from Better Auth's
  session on the server. No business is required or read; the route is not
  organization-scoped and takes no organization id from anyone.
- Body (JSON): `{ businessName: string, clientName: string, clientEmail:
  string }`, parsed with `provisionClientValidationSchema`. The slug is
  derived on the server with `toSlug(businessName)`, never sent.
- `201`: `{ organization: { id, name, slug }, client: { id, name, email } }`.
- Refusals, all in the existing `{ error: { code, message } }` shape:
  `401 unauthenticated`, `403 forbidden` (not the platform admin),
  `400 bad_request` (a missing or wrong body, a failed schema, a name with no
  letters or digits; malformed JSON gets Hono's own plain-text 400, because
  the body is checked by Hono's validator, which types it for `AppType`), `409 email_taken`, `409 slug_taken`, `409 setup_in_progress`. Anything else is a 500 with
  no detail.
- Idempotency: a second identical request after a success is `409
  email_taken`. After a setup that died between its two creates, the same
  request finishes it (the login with no business is reused).
  The form disables its button while sending.
- Never in an answer or a log: login codes, the client's email in a log line,
  request headers.

**What a provisioned client is**

- `user`: the email lowercased, the name given, `role` `"user"` (the admin
  plugin's default), `emailVerified` false until their first sign-in. No
  password, no `account` row: they sign in by email code only.
- `organization`: the name given, the derived slug, `plan` `agency` (the
  column default; nothing sends a plan).
- `member`: exactly one, the client, role `owner`.
- `resource`: the first person, named after the business, `kind` `person`,
  `userId` the client's. Made by the existing hook, unchanged.
- The platform admin: no `member` row in it. They reach it later through the
  admin area (feature 23).
- On first sign-in the existing session hook makes it the active business,
  because the client belongs to exactly one.

**A setup is never half made** (step 3b.1's review, F-35 and F-38; the
claims replace the advisory locks after step 3b.3's review, F-49)

- One setup per email and per address at a time, through
  `client_setup_claim`: `key` (text, primary key: `email:<address>` or
  `slug:<address>`), `claimId` (text, a random id per setup), `claimedAt`
  (timestamptz, default now). A setup first deletes claims older than five
  minutes (left by a setup that died), then inserts both keys in one
  statement with `on conflict do nothing`. Short of both, it answers
  `409 setup_in_progress` ("This client is already being set up. Try again
  in a moment.") and makes nothing. It removes only its own claims when it
  ends, whatever happened; a failed removal is logged and the claims expire.
  No database connection is held while a setup runs: holding one (session or
  transaction advisory locks) let postgres.js 3.4.9 crash the API when that
  connection dropped.
- On a failure after Better Auth saved the business, the business is removed
  when nobody but this client is in it, then the login this setup made, and
  only while it belongs to no business. A login reused from an unfinished
  setup is kept for the next try. `409 slug_taken` is answered only when a
  business with someone else in it holds the address.
- The limit: if that clean-up itself fails (the database failing twice in
  one setup), the half-made setup stays, logged, and a retry is
  `email_taken`. It is removed by hand until the admin area (feature 23) can
  delete a client. The setup's own error is the one reported, never the
  clean-up's.

**The server-side bypass, written down where it is used**

`auth.api.createOrganization` called with a `userId` and no headers skips
`allowUserToCreateOrganization` (`crud-org.mjs`, `isSystemAction`), and
`auth.api.createUser` with no headers skips the admin plugin's permission
check. Both are Better Auth's sanctioned server paths. In this codebase they
are called only from `provision-client.ts`, which only `POST /admin/clients`
calls, behind `requirePlatformAdminMiddleware`. A later server-side caller
would create a business with no check at all, so any new caller needs its own
gate and its own line in this contract.

**Closed over HTTP after 3b.2**

- `POST /api/auth/organization/create`: refused for everyone, `403`.
- `POST /api/auth/organization/invite-member` (and accepting one): refused,
  no role holds an invitation permission.

**Frontend**

- `/admin/clients/new`, platform admin only on screen; the API is the real
  gate. States: checking the session; signed out (to `/sign-in`); not the
  platform admin (a card saying this page is for the agency, with a link
  home); the form; sending (button disabled, "Setting up…"); field errors;
  a form-level error (API down or a 500); success (business name, the
  client's email, the sign-in address, "No email is sent yet: tell the client
  yourself", and "Set up another").
- Whether the viewer is the platform admin, for showing links and cards only,
  comes from Better Auth's session in the browser (`authClient.getSession`,
  `user.role`). It never grants anything.
- Every name and email is rendered as React text, never as HTML.

## Testing

- Shared: the schema accepts a normal entry; trims and lowercases the email;
  rejects an empty or too long client name, a bad email, a blank business
  name.
- Backend (`admin-routes.test.ts`, real local Postgres, the existing
  local-dev-database guard): every refusal, the happy path's rows, the two
  conflicts, the forced failure leaving no login, the new client's sign-in
  and `/me`. 3b.2 adds the two closed doors.
- Each new test is shown able to fail once (the check removed or the value
  changed, run red, restored), as earlier steps did.
- Frontend: no test runner exists; the build, the lint and the browser check
  in 3b.3's Done when. No Browser tests command exists, so none is added.

## Notes for the AI

- Better Auth 1.7.5's create paths were read from the installed source
  (`plugins/admin/routes.mjs` `createUser`, `plugins/organization/routes/crud-org.mjs`
  `createOrganization`), not its docs. `addMember` has no HTTP route, so it is
  server-only already; this feature does not need it, because creating the
  business with the client's `userId` makes them its member.
- Better Auth's two creates do not share a transaction with each other, so the
  compensation in step 6 of `provision-client.ts` is the atomicity boundary.
  Name it out loud: a hand-written single transaction (as the seed does) was
  passed over because it would bypass Better Auth's own create path and its
  hooks.
- Never pass `c.req.raw.headers` into the two `auth.api` calls.
- The session hook and `getOrganizationFromSession` need no change.
- The platform admin's dashboard still works with their dev business; with
  none, they now land on `/admin/clients/new` instead of a refused form.
