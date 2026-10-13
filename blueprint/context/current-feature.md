# Feature: First deploy

**From build-plan:** feature 10b

**Size:** heavy - two separate risks with real consequences: putting the API, the dashboard and the database live with sign-in working across two addresses (cookies, the proxy's visitor address, a clean stop, the first login on an empty database), and then putting real data and a real Google calendar on it.

**Branch:** feature/10b-first-deploy

**Status:** specced 2026-10-12; live domain bought (decision 5); waiting on 10b.1's yes.

## Goal

Scheduleads runs for real use for the first time: the API and the database on Railway, the
dashboard on Vercel, at the agency's own addresses. Frank signs in on the live app with an
emailed code, AgentsWeb is set up there from its setup file, his real Google calendar is
connected, and the booking package is published, so the agency site can install it the day its
own plan allows. Deployed ahead of the agency site's launch, so backups (12c) and Primo (13) can
follow (Frank, 2026-10-12).

## In scope

- **Production readiness in the code** (only what a first deploy needs):
  - a one-time command that makes the platform admin login on a database with none (signup is
    closed and the seed refuses any live database, so today an empty live database has no way in);
  - the setup command (`client:setup`) opened to the live database behind an explicit flag, so it
    never touches it by accident;
  - the job runner's first start retried for a bounded time while Postgres is still coming up
    (F-179), instead of crash-looping until Railway stops restarting the API.
- **The deploy**: Railway's backend service and Postgres, Vercel's frontend, the two addresses
  under one domain with the session cookie shared between them, every production variable set,
  `NODE_ENV=production`, Railway's draining time set to 30 seconds (F-176), the migrations
  applied to the live database.
- **First-deploy checks, observed on the live app**: a clean stop at a redeploy (F-176), whether
  Railway's proxy replaces a visitor's own `X-Real-IP` (the rate limits depend on it), a restart
  with Postgres down (F-179), sign-in and sign-out across the two addresses.
- **AgentsWeb live**: the business made on `/admin/client-setup`, its setup file applied to the
  live database.
- **The one Google Cloud trip**: the live redirect, `http://localhost:3401/calendar/callback`, the
  `calendar.calendarlist.readonly` permission, then 12h's check against Frank's real calendar and
  the two findings carried for it (F-410, F-411).
- **The booking package published** to GitHub Packages (`@frankdmosquera/booking-component`,
  version from `package.json`), so a site can install it.

## Out of scope

- Backups, restore and retention (12c, next, before any client's data).
- Google's app verification and leaving Testing mode (item 22's calendar half, before 13).
- The agency site's own launch: installing the package, its `WIDGET_ORIGINS` entry (its item 12).
- Texts on the live app: Twilio stays unset, so texts fail and wait, as the code already does,
  until a business needs them.
- Custom error pages, monitoring, alerts, analytics.

## Build loop

Approved one step at a time (AGENTS.md). Heavy: `workflow.stepReview` is `every`,
`checkpointCommits` enabled. After a step's plan has Frank's yes, nothing stops until the review,
except the lines only he crosses, which in this feature are most of the work: every change on
Railway, Vercel, the domain's DNS, Resend, Google Cloud and GitHub Packages, and every write to
the live database, is done by Frank or on his yes at that moment, each one named in the step's
plan beforehand so there is no surprise trip. The rest runs through: build, tests and checks,
tick the box, write the build log entry and commit it to buildlogs, commit and push the step to
`feature/10b-first-deploy`, `/audit` scoped to the step, then the independent review. The
planned stop is after the review. Blocking findings (P0/P1) are fixed by default; P2/P3 are
recorded and carried. `/complete` makes the final pass and merges on Frank's yes.

## Build steps

- [ ] **10b.1 Live, and Frank signs in.** "Frank opens the dashboard at its live address, asks
  for a code, gets it by email from the agency's address, and is in as the platform admin. He
  signs out and back in. The API's health answers at its own address. A redeploy while a job runs
  lets the job finish. A visitor who sends a made-up `X-Real-IP` is still limited as themselves."
  - Code: `packages/shared/scripts/create-platform-admin.ts`
    (`npm run admin:create --workspace=@scheduleads-app/shared -- <email>`): makes the one
    platform admin login, refuses when one already exists, prints the database it wrote to.
    `apply-client-setup.ts`: the live database only with `--live` (a database that is not local
    `*_dev` without `--live` is refused as today; with `--live` the dry run is still the default
    and `--apply` is still needed to write). `start-job-runner.ts`: the first start retried for at
    most 60 seconds while Postgres refuses connections, then the API exits as today.
  - Frank's trips, in this order: the domain's DNS (two records), Railway (the backend service,
    its variables, the draining time, the domain), Vercel (the frontend, `NEXT_PUBLIC_API_URL`,
    the domain), Resend (the sending domain verified, if it is not already).
  - On his yes: `db:migrate` against the live database through the tunnel, then `admin:create`
    with his email.
  - Checks on the live app: `GET /health`; sign-in, sign-out, sign-in; a redeploy with a job in
    flight; the `X-Real-IP` check; a restart with Postgres stopped and started again (F-179).
  **Done when:** the new command's and the runner's tests pass, the setup command refuses a live
  database without `--live` (test), and every check above is observed on the live app and written
  in the log, with F-176 and F-179 closed or re-recorded with what was seen.

- [ ] **10b.2 AgentsWeb live, with Frank's real calendar.** "On the live app Frank makes AgentsWeb
  on `/admin/client-setup`, applies its setup file, connects his real Google calendar on Settings,
  Calendar and ticks the calendars that count. The live API's free times for AgentsWeb leave out
  his real appointments, and a test booking through the live API lands in his Google calendar and
  his inbox. The booking package is published."
  - Frank's trip: Google Cloud once (the live redirect `https://api.booking-crm.com/calendar/callback`,
    `http://localhost:3401/calendar/callback`, the `calendar.calendarlist.readonly` permission on
    the client's Data Access).
  - On his yes: `client:setup --live` dry run, then `--apply`, against the live database; the
    package published (`npm publish`, its version first).
  - Checks: 12h's pick against the real calendar (a second calendar ticked and unticked changes
    the free times); F-410 and F-411 looked at against the real account and closed or carried; a
    test booking made and then cancelled through its own link.
  **Done when:** every check above is observed on the live app and written in the log, and the
  package installs from GitHub Packages in an empty folder.

## Files / areas

- `packages/shared/scripts/` (`create-platform-admin.ts` new, `apply-client-setup.ts`), its
  `package.json` scripts, `packages/shared/helpers/assert-local-dev-database.ts` (read, unchanged)
- `backend/lib/jobs/start-job-runner.ts` and its test
- `.env.example` (the production values named, never set), `AGENTS.md` Commands (the new command,
  the live flag, the live addresses)
- Outside the repo, Frank's: Railway, Vercel, the domain's DNS, Resend, Google Cloud, GitHub Packages

## Data / contracts

- **`admin:create <email>`**: one `user` row with `role: "admin"`, `emailVerified: true`, name
  empty, as the seed makes it; refused with a message and exit code 1 when any user already has
  `role: "admin"`, or the email is not an email. Signs nobody in; the code comes at sign-in.
- **`client:setup <file> --live [--apply]`**: without `--live`, exactly today's guard; with it,
  any database, and the first line printed names the database's host and name before anything
  else is read.
- **The runner's first start**: retried while the database refuses connections, at most 60
  seconds, then the error as today; any other error at once.
- **The live addresses**: the dashboard and the API on two subdomains of one domain;
  `COOKIE_DOMAIN` is that domain, `APP_ORIGIN` the dashboard, `BETTER_AUTH_URL` the API,
  `NEXT_PUBLIC_API_URL` the API. `WIDGET_ORIGINS` empty until a site goes live. The live
  `CALENDAR_TOKEN_KEY`, `BOOKING_LINK_KEY` and `BETTER_AUTH_SECRET` are new values, kept in the
  password manager, never the development ones.

## Testing

`npm run test --workspace=@scheduleads-app/shared`, `npm run test --workspace=backend`, the
frontend build and lint. One test per rule that would hurt if broken:

- 10b.1: `admin:create` makes one admin and refuses a second; the setup command refuses a
  database that is not local `*_dev` without `--live`, and with `--live` still writes nothing
  without `--apply`; the runner's first start retries while refused and gives up after its limit.
- 10b.2: no new code; its checks are observed on the live app.

## Decisions (made while planning, Frank's to overrule)

1. **Deploy now, ahead of the agency site** (Frank, 2026-10-12): the plan's Oct 9 timing waited on
   QuickBooks, which nothing plans; 12c and 13 need a live app.
2. **The first login comes from a one-time command**, not from opening signup or a back door in
   the API: it runs from the laptop through the tunnel, like the migrations, and refuses once an
   admin exists.
3. **The setup command reaches the live database only with `--live`**: the guard that keeps it on
   `*_dev` stays the default, so a wrong `.env` line is still refused.
4. **Railway's draining time 30 seconds** (F-176, Frank 2026-10-05), under which the API already
   stops itself at 25.
5. **The live domain is `booking-crm.com`** (Frank bought it 2026-10-12, in Vercel, so its DNS is
   there): the dashboard at `app.booking-crm.com` (Vercel), the API at `api.booking-crm.com`
   (Railway), the bare name kept free for a product page later. So `COOKIE_DOMAIN` is
   `.booking-crm.com`, `APP_ORIGIN` is `https://app.booking-crm.com`, and `BETTER_AUTH_URL` and
   `NEXT_PUBLIC_API_URL` are `https://api.booking-crm.com`.

## Notes for the AI

- Railway builds from the repo root with `railway.json` (build, start, watch paths, health check,
  draining) and Node 26 from `.node-version` (2026-10-12: the dashboard's build command never
  reached the first build, and Railpack chose Node 24). Not the root `engines`: Vercel offers only
  Node 24 and 22, so the frontend runs on 24. Check its time zone data on the live
  `/b/` page in 10b.2 (Alberta on UTC-6 all year needs tz 2026c). Railway retires `railway.json`
  on 2026-12-01: move it to `.railway/railway.ts` (`railway config migrate`) before then, in 10b.
- The dashboard's watch paths skip commits that change only root files: such a commit deploys
  with `railway redeploy --service scheduleads --from-source`.

- Railway with Root Directory `backend` may not see `packages/shared`, which the backend's
  `prebuild` compiles. Check Railway's monorepo docs in 10b.1 before Frank's Railway trip; if it
  cannot, the service builds from the repo root with `npm run build --workspace=backend` and
  `npm run start --workspace=backend`, with watch paths on `backend/**` and `packages/shared/**`.
  The settled architecture (two deploy units, isolated) holds either way; say the mechanism in
  the step's plan. Vercel's `frontend` root must install the workspace from the repo root, since
  its `prebuild` needs `backend` and `packages/*`: check the same.
- Railway's proxy and `X-Real-IP`: `backend/lib/rate-limit/visitor-address.ts` trusts it in
  production. Checked by calling a public route past its limit with a different made-up
  `X-Real-IP` each time: limited means Railway replaces it.
- Production refuses to start without `RESEND_API_KEY` and `LOGIN_EMAIL_FROM`; the sending
  address must be on a domain verified in the agency's Resend account.
- Google OAuth stays in Testing: the connection needs reconnecting every seven days until item 22.

## Open questions

None. The live addresses were answered by decision 5.
