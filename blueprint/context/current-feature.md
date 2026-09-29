# Feature: Calendar connection

**From build-plan:** feature 3

**Branch:** `feature/03-calendar-connection` (the workspace's `feature/NN-name` form)

**Status:** whole feature seen and agreed by Frank 2026-09-28; step 3.1
approved and built 2026-09-28, independent review next

Approved one step at a time (`AGENTS.md`, "A spec is approved one step at a
time"): Frank sees the whole feature once, then each of steps 3.1 to 3.4 gets
its own yes just before it is built. Shaped by the conversation of 2026-09-28
after `/overview`, recorded below under Notes for the AI.

## Goal

Let the business owner connect their own Google calendar, so the app can read
when they are busy. One connection asks Google for both permissions the product
needs (read busy times, and add and edit events), so nobody reconnects when
bookings start being written in a later item. Prove it the way the Phase 1 exit
asks: a real event in Frank's own Google calendar comes back as a busy block.

## In scope

- **A person knows whose login they are.** A person (`resource`) can be linked
  to one login in its business. The business's first person is linked to its
  business owner. That link is how the app knows which person is "you". Step
  3.1's blocker decides this; the rest of the spec assumes the recommended
  answer.
- **The `calendar_connection` table**: one per person, never one for the
  business. Provider, the Google account's email, the encrypted tokens, the
  permissions Google granted, a status, and when it was last read.
- **The token cipher**: AES-256-GCM under `CALENDAR_TOKEN_KEY`, in
  `packages/shared` as the plan puts "the crypto" there.
- **Connect**: the signed-in person starts it from the dashboard, Google asks
  for consent, the API checks that **both** permissions were granted (Google
  silently drops what it does not recognise, and a user can untick one) and
  refuses a half-connection, then stores the tokens encrypted.
- **Disconnect**: revoke at Google, then delete the connection.
- **The provider seam**: one interface the rest of the app calls ("when is
  this person busy?"), with Google as its first and only implementation.
- **Busy times**: a free/busy query for one person over a time range, with the
  access token refreshed when it has expired. A failed check never reports
  "free": it throws, and a refused refresh marks the connection
  `needs_reconnect`.
- **A check command** that prints a person's busy blocks for the next days,
  used to prove the Phase 1 exit against Frank's real calendar.
- **A dashboard card** in the settings mockup's shape: not connected with a
  Connect button; connected, showing the Google account and when it was last
  read, with Disconnect; needs reconnecting, with Reconnect.

## Out of scope

- **Workers connecting their own calendars.** Parked on 2026-09-28 until a
  client has workers (item 13 or 17). The table is one row per person from day
  one, so nothing is migrated then.
- **Writing bookings into Google.** The permission is asked for here; the
  first call that writes an event is built with the first booking (item 5).
  Removing an event on cancel is item 7.
- **The email that tells the business to reconnect.** Resend arrives with
  confirmations (item 6). Here the card shows the state; nothing is sent.
- **Background token refresh.** Tokens are refreshed when a check needs them.
  The job runner is item 8.
- **Microsoft, CalDAV (Apple iCloud) and ICS plugs.** Each is a new file behind
  the seam, built when a client needs one.
- **The Settings page.** The card sits on today's dashboard and moves into
  Settings in item 12.
- **Google's app verification.** Item 22, finished before item 13. Until then
  the app stays in Testing mode and a connection lasts seven days.
- **Railway.** No production environment variable, migration or Google client
  is touched. The feature is built and proved locally.

## Build loop

Steps are built in order, one at a time, with `workflow.stepReview: "every"`
and `workflow.checkpointCommits: "enabled"`. After the green light, nothing
stops until the review (`AGENTS.md`): once a step's plan (Part 1 and Part 2)
has Frank's yes, it runs straight through - build, tests and checks, tick the
box, publish the page, commit and push to `feature/03-calendar-connection`,
`/audit` on the step, the independent review - and stops only after the
review, where its findings are talked through. The only earlier stops: the
agreed plan turns out wrong, a line only Frank crosses (a package, Railway,
real data, `main`), or a P0/P1 finding. Each step commit is
`feat: 3.N <what it does>`. `/complete` makes the final merge on Frank's yes.

## Build steps

- [x] **3.1 A person knows whose login they are, the connection table, and the
  cipher.** Plan approved by Frank 2026-09-28 (Part 1 and Part 2), built the
  same day; every Done when check passed. Independent review next.
  - Blocker, answered by Frank 2026-09-28: **A.** How the app knows which
    person is you: link a person to a login, a `userId` column on `resource`
    (exact, and item 3b and crew sign-in need the same link). Rejected, B:
    take the business's oldest person (no schema change, but it breaks the
    day that person is renamed, removed or reordered).
  - Migration 0004: `resource.userId`, `calendar_connection`,
    `calendar_oauth_state` (see Data / contracts). Existing businesses: their
    first person is linked to the member whose role is `owner`, when there is
    exactly one; otherwise it stays unlinked and the card says so. The first
    person is the one named after the business (how migration 0001 and the
    hook make it); with no person of that name (a renamed business) it stays
    unlinked too, never a guess. Changed while building: the plan said "the
    oldest person", but the seed makes a whole cast in one transaction, so
    everyone shares one `createdAt` and "oldest" was a coin toss. The name-only
    rule is F-35's fix, on Frank's yes, 2026-09-28.
  - The `afterCreateOrganization` hook links the new first person to the
    business's owner, read from the membership Better Auth has just made
    (today the platform admin; item 3b makes it the client, with no change to
    this line).
  - The seed links each dev business's first person to its owner account.
  - `packages/shared/crypto/token-cipher.ts` with its own subpath export
    `./crypto`, and its tests.
  - A development `CALENDAR_TOKEN_KEY` is generated into `.env` (never
    printed), and `.env.example` gains the three names with how to make each.
  - **Done when:** `db:migrate` then `db:seed` on a fresh `scheduleads_dev`
    leaves `painting-dev`'s first person linked to `admin@example.com` and
    `clinic-dev`'s to `owner@example.com`; the database refuses a second
    person linked to the same login in one business and a place linked to a
    login; the cipher tests pass (round trip, a tampered value refused, the
    wrong key refused, a key of the wrong length refused at start); the shared
    and backend tests and both builds pass.

- [x] **3.2 Connect a Google calendar.** Built 2026-09-28, Frank's plan yes
  the same day. Differences from the plan: `google-oauth.ts` became
  `google-oauth-client.ts` (one export, an object, per the one-export-per-file
  rule); `finish-google-connect.ts` (the callback's logic) and
  `oauth-state-fingerprint.ts` added; `connectedAt` dropped from
  `/calendar/connection` (a reconnect keeps the row, so no honest value);
  "a plan without booking" proved with an unrecognised plan, as in 2.4. By
  hand: Frank connected `frankdmosquera@gmail.com` for `admin@example.com`
  after fixing the client's redirect URI (the old
  `/api/calendar/google/callback` path); the by-hand Cancel was not done
  (he went straight to Allow; "denied" is proved by a saved test and can be
  seen by hand once 3.4 adds Disconnect).
  - Blocker, answered by Frank 2026-09-28: **plain `fetch`, no package.**
    Four documented calls (build the consent URL, swap the code, refresh,
    revoke), and PKCE and the state are ours either way. `google-auth-library`
    is Google's standard client and was passed over on purpose: its main job,
    holding tokens in memory and refreshing them, does not fit tokens stored
    encrypted per person, and free/busy is plain `fetch` either way. The price,
    said out loud: we write the four calls (roughly 80 lines, each with saved
    tests), we read Google's error answers ourselves (`invalid_grant` means
    reconnect), and a changed Google URL is ours to fix.
  - Done by Frank 2026-09-28: an OAuth client in Google Cloud (Testing mode,
    Frank's Gmail as a test user, redirect
    `http://localhost:3001/calendar/callback`), its two values in the root
    `.env` (checked set, not printed). An existing client was reused with a
    new secret; the first real connect proves the Google-side settings.
  - `POST /calendar/connect`: for the signed-in person, a single-use state and
    a PKCE verifier are saved for ten minutes, and the Google consent URL is
    returned. Planned in detail 2026-09-28 (being gone through with Frank):
    dashboard CORS and no-store, sign-in, a known plan and the booking module;
    the signed-in person is the resource in the active business whose
    `userId` is the session user, none is a plain refusal; the ticket row
    keeps the SHA-256 of the state (the value lives only in the URL) and the
    PKCE verifier, and making one deletes that user's expired tickets; scopes
    `openid email https://www.googleapis.com/auth/calendar.events.freebusy
    https://www.googleapis.com/auth/calendar.events.owned` (events.owned is
    the narrowest write scope: events on calendars the person owns; checked
    against Google's scope list 2026-09-28); the API refuses to start without
    `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Files:
    `backend/routes/calendar-routes.ts`, `backend/lib/calendar/google-oauth.ts`,
    `find-signed-in-person.ts`, `create-oauth-ticket.ts`; `app.ts` and
    `server.ts` changed.
  - `GET /calendar/callback`: the state is used up in one statement, must be
    unexpired and belong to the signed-in login; the code is swapped; both
    permissions must be present or the tokens are revoked and nothing is
    saved; the tokens are stored encrypted. Always ends in a redirect to the
    dashboard with an outcome, never a JSON page. Planned in detail
    2026-09-28: five outcomes to the fixed `APP_ORIGIN` address, `connected`,
    `denied` (Google's `error=access_denied`), `expired` (no, stale, used or
    other login's ticket, or no session), `missing_permission` (revoked),
    `failed` (swap error, or no refresh token: revoked). The ticket is used up
    with one `DELETE ... WHERE id = sha256(state) AND userId = session AND
    expiresAt > now() RETURNING`. The Google email comes from the `id_token`
    returned directly by the token endpoint over TLS (no signature check
    needed there, OpenID Connect Core 3.1.3.7), `email_verified` required. A
    reconnect upserts on `resourceId`. The cipher gains an associated-data
    argument, the connection's `resourceId`, so a value moved to another row
    fails (the 3.1 reviewer's note). Files: `redeem-oauth-ticket.ts`,
    `save-calendar-connection.ts` new; `calendar-routes.ts`,
    `google-oauth.ts`, `token-cipher.ts` and its test changed.
  - `GET /calendar/connection`: the signed-in person and their connection, if
    any, without tokens. Planned 2026-09-28 (pieces 3 and 4 agreed by Frank,
    and "Google first, other plugs once it works" confirmed): same middleware
    as connect; answers `{ person: { id, name } | null, connection: {
    provider, accountEmail, status, lastCheckedAt, connectedAt } | null }`,
    never `credentials` or `grantedScopes` (a saved test checks); a login
    with no person gets `person: null`, not an error; called through
    `dashboardApiClient`.
  - The dashboard card: Connect, the outcome notice after Google sends the
    browser back, and the connected line. Planned 2026-09-28 (piece 5
    agreed): on the home under the booking links until feature 12;
    `frontend/components/calendar/calendar-connection-card.tsx`; Connect posts
    through `dashboardApiClient` and assigns `window.location`; the
    `?calendar=` outcome is shown in plain words and removed with
    `history.replaceState`; `person: null` shows a line and no button; a
    one-line loading state only (3.4 adds needs reconnecting, Disconnect and
    API down).
  - Part 1 agreed by Frank 2026-09-28 (piece 6 included). Part 2 rewritten
    the same day to match the pieces, being gone through: the saved tests
    below plus the ticket fingerprint and cleanup, `denied` and `failed`
    outcomes, no refresh token revoked, reconnect keeps one row, the fixed
    redirect, `/calendar/connection` without tokens or scopes, `person: null`,
    the lock refusing a value moved to another person, planted faults (ticket
    not used up, scope check removed, lock not bound); by hand also Cancel
    once and the API refusing to start without the Google values.
  - **Done when:** route tests against the local database, with Google's
    endpoints faked, prove: no session is 401; a plan without booking is 403;
    a login with no person gets a clear refusal; an unknown, expired, reused
    or other login's state ends in `expired` and saves nothing; a consent
    missing either permission ends in `missing_permission`, calls revoke and
    saves nothing; a full consent saves one row whose stored credentials do
    not contain the refresh token in plain text. By hand: Frank, signed in as
    `admin@example.com`, connects his real Google and the card shows his
    Google address.

- [ ] **3.3 The provider seam and busy times.**
  - Blocker, waiting on Frank: **which of his Google calendars count as
    busy.** Recommended: his main calendar only (no extra permission). The
    other answer, every calendar he owns, needs one more permission, asked
    now or never without reconnecting.
  - `backend/lib/calendar/calendar-provider.ts`: the seam's type.
    `google-calendar-provider.ts`: free/busy, refresh, revoke.
    `get-busy-times.ts`: loads the person's connection, refreshes when needed,
    saves the new access token encrypted, records `lastCheckedAt`, and returns
    the busy blocks.
  - A person with no connection has no Google busy times: an empty list, not
    an error. A connection that fails is never an empty list.
  - `npm run calendar:check --workspace=backend -- <login email> [days]`
    prints that person's busy blocks in the business's time zone. Refuses any
    database that is not local and `*_dev`, like the seed.
  - **Done when:** tests with Google faked prove: an expired access token is
    refreshed once and the new one saved; Google refusing the refresh marks
    the connection `needs_reconnect` and throws; a Google error, a time-out or
    a per-calendar error throws; no connection returns an empty list. By hand
    (the Phase 1 exit): an event Frank creates tomorrow 10:00 to 11:00 in his
    Google calendar is printed by `calendar:check` as a busy block at those
    times.

- [ ] **3.4 Disconnect, and the card's other states.**
  - `POST /calendar/disconnect`: revokes at Google, then deletes the row. If
    Google does not answer, the row is still deleted and the answer says so,
    so the card can tell him to remove access in his Google account.
  - The card: needs reconnecting (with Reconnect, the same connect flow),
    loading, and the API not answering.
  - Carried from 3.2's review, on Frank's call: **F-37**, a reconnect with a
    different Google account hands the old account's permission back to Google
    (best effort, after the new row is saved; the same account is left alone);
    **F-40**, the card's outcome words are typed to the API's five outcomes
    and looked up only as the card's own keys, so a made-up `?calendar=` shows
    nothing and a renamed outcome fails the build.
  - **Done when:** tests prove disconnect calls revoke and deletes the row,
    still deletes it when revoke fails and reports that, and refuses a login
    with no person. By hand: Disconnect empties the card, and Google's "Your
    connections to third-party apps" page no longer lists the app; a
    connection set to `needs_reconnect` in the database shows Reconnect.
    F-37: a test reconnects with another Gmail and sees the old refresh token
    handed back, and the same Gmail not. F-40: a renamed outcome fails the
    frontend build; `?calendar=constructor` shows no notice.

## Files / areas

- `packages/shared/db/booking-tables/resource-table.ts` (changed: `userId`)
- `packages/shared/db/booking-tables/calendar-connection-table.ts` (new)
- `packages/shared/db/booking-tables/calendar-oauth-state-table.ts` (new)
- `packages/shared/db/index.ts` (changed)
- `packages/shared/migrations/0004_*.sql` (new, generated, then checked)
- `packages/shared/crypto/token-cipher.ts`, `token-cipher.test.ts` (new)
- `packages/shared/package.json`, `tsconfig.json`, `tsconfig.build.json`
  (changed: the `crypto` folder and its export)
- `packages/shared/scripts/seed-dev.ts` (changed: link first people)
- `backend/lib/auth/auth-server.ts` (changed: the hook links the creator)
- `backend/lib/calendar/` (new): 3.2 `google-oauth-client.ts`,
  `find-signed-in-person.ts`, `create-oauth-ticket.ts`, `redeem-oauth-ticket.ts`,
  `oauth-state-fingerprint.ts`, `save-calendar-connection.ts`,
  `finish-google-connect.ts`, `warn-connect-failed.ts` (+ test, F-38); 3.3 `calendar-provider.ts`,
  `google-calendar-provider.ts`, `get-busy-times.ts`, and their tests
- `backend/routes/calendar-routes.ts` and `calendar-routes.test.ts` (new)
- `backend/app.ts` (changed: mounts `/calendar`, CORS and no-store),
  `backend/server.ts` (changed: refuses to start without the Google values)
- `backend/lib/errors/refuse.ts` (changed: one new code, `no_person`)
- `backend/scripts/calendar-check.ts` (new), `backend/package.json` (changed:
  `calendar:check`)
- `frontend/components/calendar/calendar-connection-card.tsx` (new)
- `frontend/lib/api-client.ts`, `frontend/app/page.tsx` (changed)
- `.env.example` (changed), `AGENTS.md` Commands (changed: `calendar:check`)

## Data / contracts

### `resource.userId`

- `text`, nullable, FK `user.id` `on delete set null`.
- Unique per business: a unique index on (`organizationId`, `userId`) where
  `userId` is not null. One login is at most one person in a business.
- A check: `userId` is null, or `kind` is `person`. A place is never a login.
- Never set from a request in this feature. Set by the migration, the hook and
  the seed.

### `calendar_connection`

- `id` text, `randomUUID()`.
- `organizationId` text not null, FK `organization.id` `on delete cascade`.
- `resourceId` text not null; composite FK (`organizationId`, `resourceId`) to
  `resource` (`organizationId`, `id`) `on delete cascade`, the same pattern as
  `availability_rule`, so a connection can only name a person of its own
  business. Unique on `resourceId`: one connection per person.
- `provider` text not null, check in (`google`).
- `accountEmail` text not null: the Google account's address, from the
  `id_token` Google returns with the tokens. Shown on the card.
- `credentials` text not null: the cipher's output (below) of the JSON
  `{ "refreshToken": string, "accessToken": string, "accessTokenExpiresAt":
  ISO-8601 string }`. Never returned by any route, never logged.
- `grantedScopes` text not null: the space-separated list Google granted.
- `status` text not null default `connected`, check in (`connected`,
  `needs_reconnect`). Disconnecting deletes the row, so there is no
  `disconnected` state holding dead tokens.
- `lastCheckedAt` timestamptz, nullable: the last successful busy read.
- `createdAt`, `updatedAt` timestamptz, as every built table.

### `calendar_oauth_state`

- `id` text: SHA-256 (hex) of the state value. The value itself (32 random
  bytes, base64url) exists only in the consent URL.
- `userId` FK `user.id` cascade, `organizationId` FK cascade, `resourceId`
  (composite FK as above).
- `codeVerifier` text: the PKCE verifier (43 base64url characters).
- `expiresAt` timestamptz: ten minutes after it is made.
- Used up by one `DELETE ... WHERE id = sha256(state) AND userId = <session's
  user> AND expiresAt > now() RETURNING ...`, so two callbacks with the same
  state cannot both succeed, and another login's or a stale ticket is never
  touched. Expired rows are deleted when a new state is
  made for the same login.

### The cipher

- `encryptCredentials(plaintext: string, key: Buffer, boundTo: string): string`
  and `decryptCredentials(value: string, key: Buffer, boundTo: string): string`.
  `boundTo` is the connection's `resourceId`, sealed in as GCM additional data
  and not stored: a value only opens for the person it was locked for, so one
  copied onto another person's row is refused.
- Output: `v1.<iv>.<ciphertext>.<tag>`, each base64url; a fresh 12-byte IV per
  call; 16-byte tag. `v1` lets the key or format change later without
  guessing.
- `readTokenKey()`: `CALENDAR_TOKEN_KEY` is 32 bytes, base64. Missing or the
  wrong length stops the API at start, like `BETTER_AUTH_SECRET`.
- A tampered value, a wrong key, another person or an unknown version throws;
  never returns garbage.

### Google

- Consent URL: `https://accounts.google.com/o/oauth2/v2/auth` with
  `response_type=code`, `access_type=offline`, `prompt=consent` (so a refresh
  token comes back every time), `code_challenge_method=S256`, the state, and
  the redirect `${BETTER_AUTH_URL}/calendar/callback`. `BETTER_AUTH_URL` is
  already the API's own origin, so no new variable.
- Scopes: `openid`, `email`,
  `https://www.googleapis.com/auth/calendar.events.freebusy` (read busy
  times; not `calendar.freebusy`, the first repo's trap), and
  `https://www.googleapis.com/auth/calendar.events.owned` (add and change
  events on calendars the person owns), checked against Google's scope list
  on Sep 28.
- Required to count as connected: both calendar scopes present in the granted
  list. `openid email` alone, or one calendar scope, is a half-connection.
- Token swap and refresh: `https://oauth2.googleapis.com/token`. A refresh
  answered with `invalid_grant` means Google no longer accepts the saved
  permission (Testing mode's seven days, or access removed): `needs_reconnect`.
- Revoke: `https://oauth2.googleapis.com/revoke`.
- Free/busy: `POST https://www.googleapis.com/calendar/v3/freeBusy` with
  `items: [{ id: "primary" }]` (step 3.3's blocker may change the list).

### Routes

All under `/calendar`, behind `dashboardCorsMiddleware` and
`dashboardNoStoreMiddleware`. All but the callback also run
`requireOrganizationMiddleware`, `requireKnownSubscriptionMiddleware` and
`requireModuleMiddleware("booking")`. The business and the person always come
from the session, never from the request. "The signed-in person" is the person
in the active business whose `userId` is the session's user.

| Route | Answer |
|---|---|
| `GET /calendar/connection` | 200 `{ person: { id, name } \| null, connection: { provider, accountEmail, status, lastCheckedAt } \| null }` |
| `POST /calendar/connect` | 200 `{ url }`; 409 `no_person` when the login has no person here |
| `GET /calendar/callback` | always 302 to `${APP_ORIGIN}/?calendar=<outcome>` |
| `POST /calendar/disconnect` | 200 `{ revokedAtGoogle: boolean }`; 404 `not_found` when there is nothing to disconnect; 409 `no_person` |

Callback outcomes, the only values `?calendar=` ever carries: `connected`,
`denied` (the person pressed Cancel at Google), `missing_permission`,
`expired` (state unknown, expired, used, or another login's; or no session),
`failed` (Google did not answer or refused the code). The redirect target is
fixed; nothing from the request picks it, so there is no open redirect.

401, 403 and the refusal shape are the existing ones in `refuse.ts`.

## Testing

Vitest, beside the code, run by the existing commands.

- `packages/shared`: the cipher (step 3.1).
- `backend`: the OAuth helpers and the scope check (3.2), the busy-times
  function with Google faked (3.3), the routes against the local seeded
  `scheduleads_dev` with Google faked (3.2, 3.4). Google is never called from
  a test; the fake answers are the documented shapes.
- Each new test is proved able to fail once, as in feature 2.
- By hand, never in a test: the real consent screen, the real busy block,
  Google's third-party apps page.

## Notes for the AI

- **Agreed 2026-09-28, before this spec.** The app holds the only real copy of
  every booking; Google is an optional side pipe per person (their busy times
  in, a copy of their bookings out, nothing read back), so a worker deleting a
  copy loses nothing. The scheduler (items 12b, 19) is our own and needs no
  Google. Feature 3 connects the owner only; the table is still one per
  person. Other providers are plugs behind the seam, built when a client needs
  one; at onboarding the question is "iPhone or Android?".
- **Written fresh.** The plan speaks of porting the first repo's calendar
  code. That code is not in the workspace, so this feature writes it from the
  design and the traps the plans record. Nothing depends on the old code.
- **Traps carried from the plans.** Google silently drops an unknown scope
  and consents to the rest, so the granted list is always checked. Losing
  `CALENDAR_TOKEN_KEY` makes every stored connection unreadable; the dev key
  lives only in `.env`, and the production key is Frank's to set on Railway
  at deploy.
- **Tokens never leave the backend.** No route returns them, no log prints
  them, the check command prints only busy blocks.
- **Do not decide for the owner** (decision 30): the product offers the
  connection; nothing connects or reads by default.
- The permission check rule stands: code asks what a login may do, never
  `role === "owner"`. This feature needs no role check: a person may only
  connect or disconnect their own calendar, which the `userId` link decides.
- The card follows `prototypes/settings.html` (`conn--ok`, `conn--bad`) with
  the dashboard's existing components.

## Open questions

Each is a blocker on its own step, answered when that step is planned:

1. Step 3.1: how the app knows which person is you. **Answered A, Frank,
   2026-09-28**: link a person to a login.
2. Step 3.2: plain `fetch` or `google-auth-library` (recommended: `fetch`).
3. Step 3.3: which of his Google calendars count as busy (recommended: the
   main one only).
