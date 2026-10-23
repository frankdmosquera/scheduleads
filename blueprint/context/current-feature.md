# Feature: Backups and restore

**From build-plan:** feature 12c

**Size:** heavy - two separate risks with real consequences: the live data leaving Railway every
6 hours (a way into the database, the copies locked and encrypted, the keys in GitHub), and a
restore proved to bring every row back.

**Branch:** feature/12c-backups-and-restore

**Status:** 12c.1 built 2026-10-23; its review next.

## Goal

No single mistake can lose a client's leads and bookings: a wiped Railway database, a bad
migration, a bug that damages rows, or a user deleting something. Every 6 hours a GitHub job
copies the live database, encrypts it and stores it in a Cloudflare R2 bucket outside Railway,
where old copies thin out by themselves and none can be deleted early. A restore is proved once,
end to end, and written down so it can be repeated on a bad day. Before item 13, Primo's real data.

## In scope

- **The nightly job, every 6 hours**: a GitHub Actions workflow (cron, UTC) that dumps the live
  database through a read-only login, encrypts the dump, and uploads it to R2. A failed run sends
  GitHub's own failure email to Frank.
- **The schedule** (Frank, 2026-10-23), by folder in the bucket, each expiring by itself:
  every copy in `6h/` for 3 days; one a day also in `daily/` for 14 days; one a week also in
  `weekly/` for 60 days (Frank set 60 in R2, 2026-10-23); one a month also in `monthly/` for
  365 days. About 40 copies at any moment.
- **Protection against one mistake**: copies encrypted with a passphrase kept in Frank's
  password manager, GitHub and the root `.env`; the job's database login can read but never change anything; the
  bucket's lock rules refuse deleting or overwriting a copy before its folder's age, even with
  the job's own key; the copies live outside Railway, so nothing done in Railway reaches them.
- **The restore**: one command that decrypts a copy and restores it into a local scratch
  `*_dev` database, then prints every table's row count; a restore of the newest real copy,
  compared with the live counts; a short runbook in `AGENTS.md` for the three cases (put one
  thing back, a damaged set of rows, the live database lost).
- **The plan split** (Frank, 2026-10-23): what happens to a business's data when it leaves, and
  to a customer who asks to be removed, becomes its own item, 13b.

## Out of scope

- A client leaving and a customer's removal request: item 13b.
- Railway's own backups: Pro plan only; the account stays on Hobby (Frank, 2026-10-23).
- Copies more often than every 6 hours, and point-in-time recovery.
- An alert when a run never starts at all (only a failed run emails). At about 120 of 2,000 free
  GitHub minutes a month, running out is not a realistic cause; noted under Notes.
- Files: the app stores none yet. When it does, they go to R2 or the volume by the standards'
  rule, and their backup is that feature's question.
- Replacing the live database from a copy: written in the runbook, never rehearsed against live.

## Build loop

Heavy, so `workflow.stepReview` is `every` for this feature: each step's plan gets Frank's yes
just before it is built. **After the green light, nothing stops until the review**: build,
checks, tick the box, write the build log, commit and push to `feature/12c-backups-and-restore`,
`/audit` scoped to the step, then the independent review. Frank's outside trip (Railway,
Cloudflare, GitHub) is one planned trip inside 12c.1, listed in its plan, so there is no surprise
trip. The only early stops are the three in `AGENTS.md`. Blocking findings (P0/P1) are fixed by
default; P2/P3 are recorded and carried. `/complete` makes the final pass and merges on Frank's yes.

## Build steps

- [x] **12c.1 A copy lands in R2 every 6 hours.** "Every 6 hours a locked, encrypted copy of the
  live database appears in the R2 bucket, in the right folders, and nobody can delete it early."
  - Frank's one trip, in this order:
    1. Railway: turn on the Postgres service's public TCP proxy (Settings, Networking).
    2. Cloudflare: create the bucket `scheduleads-backups`; its lifecycle rules (`6h/` 3 days,
       `daily/` 14, `weekly/` 60, `monthly/` 365) and bucket lock rules with the same prefixes
       and ages; an R2 API token with Object Read & Write on that bucket only.
    3. His password manager: a new long passphrase, "Scheduleads backup key".
    4. GitHub, the `scheduleads` repo's Actions secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
       `R2_SECRET_ACCESS_KEY`, `BACKUP_PASSPHRASE` (typed by him; they never pass through chat).
  - On his yes, through the tunnel: the read-only login `backup_reader` (a generated password,
    `GRANT pg_read_all_data`), and its connection string through the public address saved as the
    secret `BACKUP_DATABASE_URL` with `gh secret set`, piped, never printed.
  - Code: `.github/workflows/database-backup.yml`: `schedule: cron "0 */6 * * *"` and
    `workflow_dispatch`; installs `postgresql-client-18` from the PostgreSQL apt repository;
    `pg_dump --format=custom`; refuses a dump under 10 KB or with no tables; `gpg --symmetric
    --cipher-algo AES256` with the passphrase from the secret; uploads with the runner's `aws` CLI
    to R2's S3 endpoint as `6h/<UTC yyyy-mm-ddTHHMM>Z.dump.gpg`, plus `daily/`, `weekly/`,
    `monthly/` on the matching runs; prints the copy's size and table count, never data.
  - `AGENTS.md`: a Backups paragraph (where, the schedule, the secrets' names, the login, how
    to run a copy now).
  **Done when:** a run by hand and the next scheduled run each put a copy in R2 under the right
  folders; the downloaded copy is unreadable without the passphrase; an `INSERT` through
  `backup_reader` is refused; deleting a fresh copy with the job's own key is refused; the copy's
  size is written in the log.

- [ ] **12c.2 A copy comes back, every row.** "Frank downloads the newest copy, one command
  restores it into a scratch database on the laptop, and every table holds what the live
  database held."
  - Code: `packages/shared/scripts/restore-backup.ts`
    (`npm run backup:restore --workspace=@scheduleads-app/shared -- <copy.dump.gpg> --into <name>`):
    the target must be a local database ending in `_dev` and must not be the one `DATABASE_URL`
    names, so the working dev database is never replaced; it is dropped and made fresh, the copy
    decrypted with `gpg` (which asks for the passphrase), restored with
    `pg_restore --no-owner --no-privileges`, and every table's row count printed. Finds
    `pg_restore` on `PATH` or in `PG_BIN` (on this laptop `C:\Program Files\PostgreSQL\18\bin`).
  - The drill: the newest copy restored into `scheduleads_restore_dev`, its counts compared with
    the live counts read through `backup_reader`.
  - `AGENTS.md`: the restore runbook, the three cases.
  **Done when:** the target guard's tests pass; the newest real copy restores with no error and
  every table's count matches the live database, or differs only by rows added after the copy's
  time, each written in the log; IA a la Orden's business, people and bookings are there.

## Files / areas

- `.github/workflows/database-backup.yml` (new; the repo has no workflows yet)
- `packages/shared/scripts/restore-backup.ts` (new), its target guard beside it with its test,
  `packages/shared/package.json` (`backup:restore`)
- `packages/shared/helpers/assert-local-dev-database.ts` (reused, unchanged)
- `AGENTS.md` (Backups, the restore runbook)
- `blueprint/build-plan.md`, `blueprint/project-plan.md`, `blueprint/context/project-overview.md`
  (the split: 12c is backups and restore, 13b is leaving and removal)
- Outside the repo, Frank's: Railway (the TCP proxy), Cloudflare (bucket, rules, token), GitHub
  (secrets), his password manager (the passphrase)

## Data / contracts

- **A copy**: `pg_dump --format=custom` of the whole live database, encrypted with GnuPG
  symmetric AES-256; object key `<folder>/<UTC yyyy-mm-ddTHHMM>Z.dump.gpg` (minutes, so two runs never share a name the lock would refuse to overwrite); folders `6h`, `daily`,
  `weekly`, `monthly`. The same copy may sit in up to four folders.
- **Which folders**: every run `6h/`; also `daily/` when the newest there is not from today
  (UTC), `monthly/` when the newest there is not from this month, and `weekly/` when the newest
  there is 7 days old or more. What the bucket holds decides, not the clock (F-439).
- **Expiry and lock**: per folder, 3, 14, 60 and 365 days; R2 lifecycle deletes, the lock refuses
  any earlier delete or overwrite.
- **`backup_reader`**: a login role with `pg_read_all_data` and `BYPASSRLS` (graphile-worker's four `_private_*` tables use row-level security, which `pg_dump` will not read around otherwise); no write, no DDL. Its password
  exists only in the `BACKUP_DATABASE_URL` secret; lost means rotated.
- **`backup:restore <copy> --into <name>`**: refuses (message, exit 1) a target that is not
  local, does not end in `_dev`, or is the `DATABASE_URL` database; prints the target first;
  prints `table: rows` for every table after.
- Secrets in GitHub: `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE`, `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. The passphrase also in Frank's Google Password
  Manager and the root `.env` (`BACKUP_PASSPHRASE`, for the restore; Frank, 2026-10-23): without
  it no copy can ever be opened.

## Testing

`npm run test --workspace=@scheduleads-app/shared`. One test per rule that would hurt if broken:

- 12c.2: the restore target guard refuses a non-local database, a name not ending in `_dev`, and
  the `DATABASE_URL` database, and accepts `scheduleads_restore_dev`.
- 12c.1 has no app logic; its checks are observed (the runs, the refused insert, the refused
  delete, the unreadable download) and written in the log.

## Decisions (made while planning, Frank's to overrule)

1. **Copies outside Railway, in R2** (Frank, 2026-10-23): Railway's backups need Pro and die
   with the disk; R2's free 10 GB holds about 40 copies of about 1 MB today with room for years.
2. **Stay on Hobby** (Frank, 2026-10-23): Pro's backups add nothing the outside copy lacks;
   upgrade when the WhatsApp app goes on Railway and the $20 credit covers both.
3. **A GitHub job runs it** (Frank, 2026-10-23), not the API's job runner (inside Railway, would
   need an S3 package and dies with the API) nor a Railway cron service (inside Railway).
4. **Every 6 hours, then daily, weekly, monthly** (Frank, 2026-10-23): hourly lost to GitHub's
   free minutes for little gain; at most 6 hours lost in a disaster.
5. **A public address with a read-only login** (Frank, 2026-10-23), not a Railway token through
   the tunnel: a leaked read-only login can read but never delete; a leaked Railway token could
   wipe the project.
6. **Encrypted with GnuPG**, already on GitHub's runners and in Git for Windows on the laptop, so
   nothing is installed; rejected: age (a new tool on both ends), no encryption (every client's
   customers in a file).
7. **Bucket lock rules** so a copy outlives a leaked key or a wrong click: the job's key can add
   copies but no key can remove one early.
8. **Expiry by folder in R2**, not code that deletes: nothing to break, nothing to run.
9. **The restore goes into a local scratch database**, never the working dev one and never live;
   replacing live is a runbook entry, done only on Frank's yes on the day.

## Amendments

- 2026-10-23, 12c.1: weekly copies kept 60 days, not 90 (Frank set 60 in R2 and kept it).
- 2026-10-23, 12c.1: `backup_reader` also has `BYPASSRLS`. The first run failed: graphile-worker's
  `_private_job_queues`, `_private_jobs`, `_private_known_crontabs` and `_private_tasks` have row-level
  security on, and `pg_dump` refuses to copy them past it. Reading only; an insert is still refused (`42501`).
- 2026-10-23, 12c.1: object names carry minutes and `Z` (`2026-10-23T1556Z.dump.gpg`): the lock refuses an
  overwrite, so two runs in one hour must never share a name.
- 2026-10-23, 12c.1: no temporary `push` trigger: `gh workflow run database-backup.yml --ref <branch>`
  runs the job from the feature branch, so it was removed before the step closed.
- 2026-10-23, 12c.1: one copy is 105 KB before locking and 24 KB locked (GnuPG compresses), not about
  1 MB: about 40 copies hold about 1 MB of R2.

## Notes for the AI

- Scheduled workflows run only from the default branch, so the schedule starts at the merge.
  12c.1 proves the job by hand: check whether `gh workflow run database-backup.yml --ref
  feature/12c-backups-and-restore` works before the file is on `main`; if not, a temporary `push`
  trigger on this branch and this file only, removed before `/complete`. The "next scheduled run"
  in 12c.1's Done when is then seen after the merge and written in the log.
- GitHub sends the failure email to whoever last changed the cron line; check Frank's Actions
  notification setting is on during his trip.
- The R2 token is Object Read & Write; the lock rules, not the token, are what refuse deletes.
- `pg_dump` must be version 18 or newer against Postgres 18; Ubuntu's own client is older.
- No secret value is ever printed: not in the workflow log, not in chat, not in the build log.
- Without a payment method GitHub stops workflows when the free minutes run out; at about 120 a
  month that is far off, but a run that never starts sends no email.
- Never stage `blueprint/ai-voice-proposal.md`.
