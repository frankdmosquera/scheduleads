# Feature: Google calendar approval

**From build-plan:** feature 22a

**Size:** light - paperwork and a three-page static site, no app logic: one small site, one trip
to Google Cloud, and a wait for Google's review.

**Branch:** feature/22a-google-calendar-approval

**Status:** verified

## Goal

Calendar connections stop dropping every seven days, and Google stops warning that the app is
unverified, so a client like Primo (item 13) connects to a normal Google screen. Google needs the
product to have a public home: booking-crm.com, with a home page, a privacy policy and terms,
under the product's name, Booking CRM (Frank, 2026-10-23). IA a la Orden, the agency that sells
and uses Booking CRM, is its first user and the first to stop reconnecting.

## In scope

- **The product's site** at `https://booking-crm.com`: a new, small Next.js project,
  `booking-crm-site` (stack 1, its own private GitHub repo, made with `newproj`, shaped like
  `tamales-avimery`'s one-pager), with three pages: `/` (what Booking CRM does, who runs it, links
  to the other two), `/privacy` and `/terms`. English first; Spanish later. No forms, no tests.
- **The privacy policy says what Google needs**: which Google data is read (calendar free/busy,
  the calendar list, the events the app makes), why (to show free times and add bookings), where
  it is kept and for how long, how to have it deleted, a contact, and Google's Limited Use
  statement for Google user data.
- **Vercel**: a new project from that repo on the bare `booking-crm.com` (its DNS is already in
  Vercel).
- **Google Cloud, the consent screen**: the name "Booking CRM", a support email, the home page,
  privacy and terms links, `booking-crm.com` as an authorized domain; then **publish** (Testing to
  In production), which ends the seven-day expiry; then **submit for verification** of the three
  calendar scopes with their reasons and a short screen recording.
- **The dashboard's browser title** says "Booking CRM", not "Scheduleads"
  (`frontend/app/layout.tsx`), so Google's reviewer sees one name everywhere.

## Out of scope

- The Gmail scopes (22b), the sales site's real content and its Spanish version, a logo (it would
  add Google's brand review; later), renaming the repo or anything internal.
- The other product sites (websites, AI agents, SEO): Frank's later channels.

## Build loop

Light, so one plan yes for the feature, each step built straight through to its commit, and the
independent review once, at `/complete`. **After the green light, nothing stops until the
review**: build, the step's one check, tick the box, the build log, commit and push. The trips
that are Frank's (`newproj`, Vercel, Google Cloud, the recording) are listed in the steps, so none
is a surprise. Google's review is a wait: the feature stays open until it answers.

## Build steps

- [x] **22a.1 booking-crm.com is live.** "Anyone opening booking-crm.com sees what Booking CRM
  is, with its privacy policy and terms one click away."
  - Frank: `gh repo create frankdmosquera/booking-crm-site --private`, then from
    `ai-web-agency`, `newproj booking-crm-site` (stack 1, no extra libraries, small, the repo URL).
  - Claude: the three pages in that repo, copied in shape from `tamales-avimery`; the workspace
    `CLAUDE.md` table gains the new project.
  - Frank (or Claude with the Vercel CLI on his yes): a Vercel project from the repo, domain
    `booking-crm.com`.
  **Done when:** `https://booking-crm.com`, `/privacy` and `/terms` each load over HTTPS with
  their content, and the home page links to both.

- [x] **22a.2 Google publishes, then approves.** "The consent screen says Booking CRM,
  connections stop expiring, and once Google approves, the unverified warning is gone."
  - Claude: the dashboard title; the reasons for each scope and the recording's script, written
    out for Frank.
  - Frank's Google Cloud trip: branding (name, support email, the three links, the authorized
    domain), publish, then submit verification with the recording (unlisted on YouTube).
  **Done when:** the consent screen shows "Booking CRM"; the app is In production. (The
  seven-day check and Google's approval moved to 22c on 2026-10-23, see Amendments.)

## Files / areas

- New repo `booking-crm-site`: `app/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`,
  `app/layout.tsx`
- `frontend/app/layout.tsx` (the title)
- `ai-web-agency/CLAUDE.md` (the projects table)
- Outside: GitHub, Vercel, Google Cloud's consent screen, YouTube (unlisted)

## Data / contracts

- Public URLs: `https://booking-crm.com/`, `/privacy`, `/terms`. The consent screen's three links
  point there exactly, and `booking-crm.com` is its authorized domain.
- Scopes, unchanged: `calendar.events.freebusy`, `calendar.events.owned`,
  `calendar.calendarlist.readonly`.

## Testing

No app logic, so no saved tests. 22a.1: the three URLs load (curl). 22a.2: the consent screen
seen, the connection checked after seven days with `calendar:check` on the live database, and a
fresh connect after approval.

## Decisions (made while planning, Frank's to overrule)

1. **The product is called Booking CRM** (Frank, 2026-10-23), the name on Google's screen and the
   site; IA a la Orden and AgentsWeb are the agencies that sell it.
2. **Its own small site, not inside the dashboard app** (Frank, 2026-10-23): the product's sales
   site grows on its own (English and Spanish, SEO) and never mixes with the dashboard's code; the
   dashboard option lost on that. ialaorden.com lost because Google wants the app's own domain and
   the agency sells more than this one product.
3. **Publish before verification is done**: publishing alone ends the seven-day expiry; until
   Google approves, users see Google's unverified warning (IA a la Orden only, for now).
4. **No logo yet**: a logo makes Google review the brand as well, a longer wait for nothing needed.
5. **The support email is Frank's Gmail**, unless he picks another on the trip; reversible.

## Amendments

- 2026-10-23, 22a.1: Claude ran every step (Frank's say-so): the repo, the scaffold, Vercel and the
  domain. `newproj` failed on `@hookform/resolvers` 6.0's peer clash, so the site is plain Next.js
  without the Blueprint kit or the default libraries (Frank: keep it simple). Contact on the pages:
  `hola@ialaorden.com`.
- 2026-10-23, 22a.2: done as far as it can be today: the consent screen's branding says Booking
  CRM with booking-crm.com's three links and its authorized domain, booking-crm.com is verified in
  Search Console, the app is published (In production), and IA a la Orden reconnected after
  publishing. The dashboard's title and icon say Booking CRM. Frank closed the feature here so the
  slot frees for 12i: submitting Google's verification, waiting for its answer, the seven-day
  check on IA a la Orden's connection and the fresh connect without the warning moved to a new
  build-plan item, 22c.

## Notes for the AI

- The privacy policy is not legal advice; Frank approves its words. Keep it short and true to
  what the code does.
- `newproj` asks its questions in the terminal; Frank runs it. Then build in that folder.
- Google may ask follow-up questions by email during the review; answer them with Frank.
- Never stage `blueprint/ai-voice-proposal.md`.

## Implementation walkthrough

Feature 22a was specced light, two steps, one review at `/complete`. 22a.1 is `69549ad`; 22a.2 is
`36107b5` (the dashboard's title) and `4070c27` (the icon); five carried P3s were fixed on the way
in `5b1d0c2`. Closed at publishing on 2026-10-23 (`58d7cf1`) so the feature slot frees for 12i;
Google's verification and the checks after it moved to 22c. Four plan chores rode on the branch:
buildlogs is read on the laptop only (`ecf9778`), Primo waits for IA a la Orden (`3d61d87`), 12i
added (`37b3f74`, `a72e921`).

### booking-crm.com (22a.1)

A new project outside this repo, `booking-crm-site` (private repo, its own Vercel project on the
bare domain): `/`, `/privacy` (which Google data is read, why, where it is kept, how to have it
deleted, and Google's Limited Use statement) and `/terms`. `newproj` failed on `@hookform/resolvers`
6.0's peer clash, so it is plain Next.js finished by hand, with no Blueprint kit (Frank: keep it
simple). The workspace `CLAUDE.md` table lists it.

### One name (22a.2)

`frontend/app/layout.tsx`'s title says Booking CRM, and `frontend/app/icon.svg` is Frank's option 3
of three (a calendar and a contact on a teal tile), the same mark as booking-crm.com. The customer's
own pages under `/customer-booking` keep their own icon, so customers never see the product's mark.

### Frank's Google trip (22a.2)

booking-crm.com verified in Google Search Console first (a TXT record in Vercel's DNS, kept for
good). Branding: the name Booking CRM, the three links, `booking-crm.com` as the only authorized
domain. The app published to In production, which ends the seven-day expiry; IA a la Orden
reconnected afterwards and read its calendar. The old buildlogs Google client was deleted from the
project on purpose, so the project holds only Booking CRM's client.

### Carried findings fixed

`.env.example` names the three live variables the API refuses to start without (F-436) and the
three the restore reads (F-454); finding and step tags left new comments and test names (F-450);
`packages/shared/tsconfig.json` includes `backups/` so its test is type-checked (F-452); the
runbook opens a backup copy with `gpg --output`, never a PowerShell redirect (F-453).

### What the archive does not prove

The independent review raised F-456: parts of this spec (In scope, Build loop, the 22a.2 title,
Testing) still describe Google's verification, the seven-day check and the fresh connect as 22a's
work. They were not done here; they are 22c's. The spec stays byte-for-byte as reviewed, so F-456
is carried to 22c, whose spec is written from the build plan's 22c line, not from this one.
`frontend/app/icon.svg` also changed, though Files / areas does not name it.

## Findings

### 22a/F-436 [P3] closed - The live variables listed in .env.example leave out three the live API refuses to start without

**File:** .env.example:17-28 (required by backend/server.ts:28-31; backend/lib/email/read-email-settings.ts:12-21; backend/lib/calendar/google-oauth-client.ts:60-62)
**Found:** 2026-10-23 by /audit independent (scope: current, c89e355..7654439; lenses: quality, security, performance, tests)
**Why it matters:** AGENTS.md says "The live values are listed at the top of `.env.example`", and the block says "Railway sets these on the API". It names APP_ORIGIN, BETTER_AUTH_URL, NEXT_PUBLIC_API_URL, COOKIE_DOMAIN, NODE_ENV, DATABASE_URL, LOGIN_EMAIL_FROM and the three keys, but not RESEND_API_KEY, GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. server.ts calls `readEmailSettings()` (production refuses without RESEND_API_KEY) and `googleOauthClient.assertConfigured()` (refuses without the Google client) before it listens. Someone rebuilding the Railway service from this list, as after the Oct 21 secret swap, gets an API that fails its health check until those are found elsewhere. It fails loudly, never silently, hence P3.
**Suggested fix:** Add the three names to the live block (RESEND_API_KEY: the agency's Resend key; GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET: the same OAuth client, which holds both redirects), and say WIDGET_ORIGINS stays empty until a site goes live, as the spec's contract does.
**Resolution:** Fixed 2026-10-23 on feature/22a: the live block in `.env.example` names RESEND_API_KEY, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as required to start, and WIDGET_ORIGINS as empty until a site goes live. Re-examined 2026-10-23 by the independent review of c08bc8d..58d7cf1: `.env.example`'s live block names RESEND_API_KEY, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, and its "refuses to start" matches backend/server.ts:28-31 (`googleOauthClient.assertConfigured()`, `readEmailSettings()`); WIDGET_ORIGINS is named as empty until a site goes live. No value is written. Closed.

### 22a/F-449 [P3] closed - The runbook's "live database is lost" case swallowed the backup paragraph's last lines and leaves out opening the copy and the backup secret

**File:** AGENTS.md:587-592
**Found:** 2026-10-23 by independent review of step 12c.2 (scope: e445997..d1f883d; lenses: quality, security, performance, tests)
**Why it matters:** "A copy now: `gh workflow run database-backup.yml`. A failed run emails Frank; a run that never starts emails nobody." now continues the third bullet, so it reads as a step of the disaster case and drops out of the Backups paragraph it belongs to. The case itself: `backup:restore` refuses a non-local target, so the copy must be opened by hand, and no gpg command is given; and after the new Postgres, `BACKUP_DATABASE_URL` in GitHub (and the public TCP proxy) must point at it, or every 6-hourly run fails from then on.
**Suggested fix:** Move the two sentences back to the end of the Backups paragraph. In the third case add the gpg line (`gpg --output <copy.dump> --decrypt <copy.dump.gpg>`, then delete the opened file) and "update `BACKUP_DATABASE_URL` in GitHub and open the TCP proxy again".
**Resolution:** Fixed 2026-10-23: the two Backups sentences are back in the Backups paragraph; the lost-database case now opens the copy by hand, turns on the new database's TCP proxy, makes `backup_reader` again and saves its address as `BACKUP_DATABASE_URL`. Re-examined 2026-10-23 by the independent review of 24ba21a..7208529: the two sentences are back in the Backups paragraph and the lost-database case names the proxy, `backup_reader` and the secret, but the new hand-opening command redirects gpg's binary output (F-453), so it stays `fixed` until that is settled. Re-examined 2026-10-23 by the independent review of c08bc8d..58d7cf1: with F-453 settled, the lost-database case opens the copy by hand with `gpg --output`, then names the TCP proxy, `backup_reader` and `BACKUP_DATABASE_URL`; the two Backups sentences stay in their paragraph. Closed.

### 22a/F-450 [P3] closed - New code comments and test names carry step and finding numbers, which the comment standard keeps in the build log

**File:** packages/shared/backups/restore-target.ts:1,3,19; packages/shared/scripts/restore-backup.ts:1,54,65,115; packages/shared/backups/restore-target.test.ts:1,23,38; .github/workflows/database-backup.yml:1
**Found:** 2026-10-23 by /audit independent current (scope: 24ba21a..7208529; lenses: quality, security, performance, tests)
**Why it matters:** coding-standards.md:365-366: "No history in code comments (step numbers, finding numbers ...): that lives in the build log." The new files tag their comments and test names with `(12c)`, `(12c.2)` and `(F-445)` to `(F-448)`. Once `/complete` archives this ledger and resets it, a bare `F-445` points at nothing (its permanent form is `12c/F-445`), and a later ledger restarting at `F-01` can reach the same number for a different finding. Every one of these comments already states its reason without the tag.
**Suggested fix:** Drop the `(12c)`, `(12c.2)` and `(F-44x)` tags from the comments and test names; keep the sentences.
**Resolution:** Fixed 2026-10-23 on feature/22a: the `(12c)`, `(12c.2)` and `(F-44x)` tags are gone from the comments and test names in the four files; the sentences stay. Re-examined 2026-10-23 by the independent review of c08bc8d..58d7cf1: `git grep` finds no `(12c)`, `(12c.2)` or `(F-4xx)` tag left in the four files; only comments and test names changed, and the shared tests pass (203). Closed.

### 22a/F-451 [P3] closed - The overview's plan fingerprint matches neither the committed nor the checked-out plans, so /status will ask for /overview

**File:** blueprint/context/project-overview.md:3
**Found:** 2026-10-23 by /audit independent current (scope: 24ba21a..7208529; lenses: quality, security, performance, tests)
**Why it matters:** a9e3d66 set the marker to `0ae170a8...`. Recomputing `/overview`'s contract (project-plan bytes, one zero byte, build-plan bytes with `- [x]` normalized) gives `05f497ca...` on the checked-out CRLF files and `43581c55...` on the committed LF blobs; the legacy exact-byte forms (`e817f86d...`, `443127c1...`) differ too. The markers at 24ba21a and 8640e41 both matched the CRLF form, so the contract held until this commit. The overview's text does carry the 12c/13b split, so the content is current and the marker is not: every `/status` now reports drift, and a later real plan change will look the same.
**Suggested fix:** Recompute the marker from the final plans by `/overview`'s contract (or rerun `/overview`).
**Resolution:** Fixed 2026-10-23 by /complete for 22a: the overview's item 22 line names 22c and no longer repeats "calendar half before 13"; the marker is recomputed over the checked-out plans with 22a ticked, `ea36dec9…`, the checked-out form the review computed. Fixed 2026-10-23 by /complete for 12c: the marker is recomputed over the checked-out (CRLF) bytes with 12c ticked, `05f497ca…`, the form the review computed. Re-examined 2026-10-23 by the independent review of c08bc8d..58d7cf1: the 12c repair held: `05f497ca…` is the CRLF form of the plans at c08bc8d. The marker was rewritten afterwards on this branch and is stale again for a new reason, recorded as F-455. Closed.

### 22a/F-452 [P3] closed - The package's editor and type-check config leaves out `backups/`, so the new test file is type-checked by nothing

**File:** packages/shared/tsconfig.json:15-28
**Found:** 2026-10-23 by /audit independent current (scope: 24ba21a..7208529; lenses: quality, security, performance, tests)
**Why it matters:** tsconfig.json describes itself as "the whole package: the code, its tests, ..." and lists every source folder except the new `backups`. tsconfig.build.json compiles `restore-target.ts` but excludes tests, and Vitest does not type-check, so `restore-target.test.ts` is checked by no config; in the editor both files fall into an inferred project without `types: ["node"]` or NodeNext resolution. `tsc -p tsconfig.json --listFilesOnly` lists only `dist/backups/restore-target.d.ts`. Both files type-check today when compiled by hand with the package's options, so this is a gap, not a present error.
**Suggested fix:** Add `"backups"` to tsconfig.json's `include`.
**Resolution:** Fixed 2026-10-23 on feature/22a: `backups` is in `packages/shared/tsconfig.json`; `tsc --noEmit -p tsconfig.json` passes with the test file in it. Re-examined 2026-10-23 by the independent review of c08bc8d..58d7cf1: `backups` is in tsconfig.json's include; `tsc -p tsconfig.json --listFilesOnly` now lists `backups/restore-target.ts` and `restore-target.test.ts`, and `tsc --noEmit -p tsconfig.json` passes. Closed.

### 22a/F-453 [P3] closed - The runbook's hand-opening command writes the decrypted copy through a shell redirect, which Windows PowerShell 5.1 turns into a corrupt file

**File:** AGENTS.md:592-593
**Found:** 2026-10-23 by /audit independent current (scope: 24ba21a..7208529; lenses: quality, security, performance, tests)
**Why it matters:** `gpg --decrypt <copy.dump.gpg> > copy.dump` is safe in Git Bash, but in Windows PowerShell 5.1 (this laptop's default shell) a native command's output is read as text and `>` writes it back as UTF-16, so the file is no longer a pg_dump archive and pg_restore refuses it. This is the "live database is lost" case, the one run under pressure. F-449's suggested fix gave the shell-independent form.
**Suggested fix:** Use `gpg --output copy.dump --decrypt <copy.dump.gpg>` (or say the line is for Git Bash).
**Resolution:** Fixed 2026-10-23 on feature/22a: the runbook opens the copy with `gpg --output copy.dump --decrypt <copy.dump.gpg>` and says why a redirect is not used. Re-examined 2026-10-23 by the independent review of c08bc8d..58d7cf1: AGENTS.md:593 reads `gpg --output copy.dump --decrypt <copy.dump.gpg>` and says why no redirect is used; no other copy of the redirect form is left in AGENTS.md. Closed.

### 22a/F-454 [P3] closed - `.env.example` does not name the three variables the restore reads from the root `.env`

**File:** .env.example; packages/shared/scripts/restore-backup.ts:47,51,76
**Found:** 2026-10-23 by /audit independent current (scope: 24ba21a..7208529; lenses: quality, security, performance, tests)
**Why it matters:** The restore reads `BACKUP_PASSPHRASE`, `PG_BIN` and `GPG` from the root `.env`, and its own error says "set PG_BIN in the root .env", but `.env.example`, the list a new machine's `.env` is built from, names none of them; only AGENTS.md does. F-443's suggested fix asked for the passphrase line if it stayed in `.env`. A second machine still restores without them (gpg asks for the key), so this is discoverability, not breakage.
**Suggested fix:** Add the three names to `.env.example`, commented and empty, with a line each on what they are for. No values.
**Resolution:** Fixed 2026-10-23 on feature/22a: `.env.example` ends with the restore's BACKUP_PASSPHRASE, PG_BIN and GPG, commented and empty, each with what it is for. Re-examined 2026-10-23 by the independent review of c08bc8d..58d7cf1: `.env.example` ends with BACKUP_PASSPHRASE, PG_BIN and GPG, commented and empty, matching what restore-backup.ts reads (lines 47, 51, 76) through `--env-file-if-exists=../../.env`. Closed.

## Independent review

**Status:** passed
**Target commit:** 58d7cf1457a587b1ba47019fcaf519de1e6b8ce9
**Base commit:** c08bc8ddb6b4d3fa626fb15a60ed11997ea8c590
**Base ref:** main
**Spec hash:** f5278a78b0a523bdbff87279b2cf248f3b9b435ea60d4346b80f5335f2d2d36d
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-23T23:19:18Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-23T23:25:57Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `c08bc8ddb6b4d3fa626fb15a60ed11997ea8c590..58d7cf1457a587b1ba47019fcaf519de1e6b8ce9` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain --untracked-files=all`: pass (HEAD, merge base and spec hash match the request; only review.md differed)
- `npm run test --workspace=@scheduleads-app/shared`: pass (30 files, 203 tests)
- `npx tsc --noEmit -p packages/shared/tsconfig.json`: pass (lists `backups/restore-target.ts` and its test)
- `npm run build --workspace=backend`: pass
- `npm run test --workspace=backend`: pass (91 files, 1052 tests, local `scheduleads_dev`)
- `npm run lint --workspace=frontend`: pass
- `npm run build --workspace=frontend`: pass (prebuild built shared, the API's route types and the booking component)
- `npm run format:check`: pass
- `/overview` source-hash recomputation (node, by the overview skill's contract) at every commit in the range: marker matches no form at 58d7cf1 (F-455)

### Evidence

- Nine commits, 13 files. Code: `frontend/app/layout.tsx` title "Booking CRM"; `frontend/app/icon.svg` redrawn (served only to the dashboard; `/customer-booking` keeps its own `icon.svg`, so customers never see the product mark); comment and test-name tags dropped in `packages/shared/backups/*` and `scripts/restore-backup.ts`; `backups` added to `packages/shared/tsconfig.json`. No logic changed.
- Config and docs: `.env.example` live block and restore variables (names only, no values); AGENTS.md build log wording and the `gpg --output` runbook line; build plan 12i, 13 note, 22a/22c/22b; overview 12i and 13 lines.
- Security: no secret or value added; `.env.example` entries are empty or commented; no route, auth or trust boundary touched. `git grep` finds no user-visible "Scheduleads" left in `frontend/app` beyond a CSS comment.
- Performance: no runtime path changed.
- Tests: no new logic, so no new tests owed; renamed tests still assert the same refusals.
- Ledger: F-436, F-449, F-450, F-451, F-452, F-453, F-454 re-examined and closed; F-444 left `fixed` (its GitHub run was not re-observed); F-455 and F-456 added.

### Findings

- F-455 [P3] open - the overview's plan fingerprint and its item 22 line were not updated after 12i, the item 13 note and 22c
- F-456 [P3] open - the spec still lists Google's verification, the seven-day check and the fresh connect as 22a's work, and omits `icon.svg`
- No P0 or P1.

### Remaining risk

- The `booking-crm-site` repo (home, privacy, terms), its Vercel deployment and the live URLs are outside this repo and were not reviewed or fetched; no network access was used.
- Google Cloud's consent screen (name, links, authorized domain, In production) was not observed; the spec's 22a.2 Done when rests on the builder's report.
- The booking component's own tests were not run (the package is unchanged in this delta; it built as part of the frontend prebuild).
- `/check` not run (not required).
