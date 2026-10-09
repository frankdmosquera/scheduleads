# AGENTS.md

Instructions for AI coding agents working in this project. This is the cross-tool
entry point: Codex, OpenCode, Cursor, GitHub Copilot, Gemini CLI, Aider, Zed,
Windsurf, and others read `AGENTS.md`. Claude Code reads `CLAUDE.md`, which imports
this file, so there is a single source of truth.

## What this is

Scheduleads is the agency's own booking module: a component dropped into
every site the agency builds, one API behind it, and a small login where the
business sees its leads and bookings and changes its hours. Customers book on
the business's own site under the business's brand and never see the product's
name. Four tenants, in order: the agency's own site, the Face and Body clinic,
The Latam Painters, Primo Painters. Booking ships inside the agency's $240/mo
plan; self-serve signup is Phase 6. The plans under `blueprint/` hold the
detail.

A monorepo: a Next.js frontend and a Hono API deployed separately, with Postgres
behind the API through Drizzle. Two deploy units, two sets of environment
variables, and shared types in `packages/shared`. Chosen when the app needs a
backend you own and can put long running work into.

This project is built with the **AI Blueprint**, a workflow layer, not an
app skeleton. To start a new project, scaffold the app first in an empty folder
(create-next-app, Vite, etc.), then overlay these files on top. Never run a
framework scaffolder inside a directory that already holds the blueprint files
(`AGENTS.md`, `CLAUDE.md`, `.agents/`, `.claude/`, `blueprint/`); it fails
because the directory isn't empty.

The workflow is defined by the local skills and context files below.

## Settled architecture

**Decided by Frank, 2026-09-19. Do not reopen these without him raising them
first.** They are written here, in the file every session and every tool loads,
precisely so nobody has to explain them again. If you think one is wrong, say
so and give the reason; do not quietly build against a different shape.

**One repo, two deploy units, permanently.** This is a monorepo, never a
monolith and never a source of extraction:

```
scheduleads-app/          one git repo, one branch, one push
  frontend/               Vercel builds this      -> the app
  backend/                Railway builds this     -> the API
  packages/shared/        both compile it in
```

Each platform is pointed at one folder through its **Root Directory** setting
and ignores everything else. Both folders stay in the repo for good: they are
the addresses the platforms build from, not development scaffolding. Deployed,
the two are completely isolated apps on separate machines with separate URLs.
Together in source, separate in production. Nothing is ever moved out.

**Better Auth runs on the backend, not inside Next.** The session lives on the
service that owns the data, so every authenticated route reads it directly.
`better-auth` is a `backend` dependency; the frontend gets the same package
later for `createAuthClient` only, which is a typed fetch wrapper. The secret
and the database never reach Vercel.

The load-bearing reason, so it is not relitigated on style: item 8 needs a
background job runner for reminders, follow-ups and Google token refresh, and
the build plan notes nothing else creates one. Vercel is serverless and has no
persistent process, so an API living inside Next could not host it. Splitting
later would cost a migration; splitting now costs one subdomain.

**Type safety front to back is Hono RPC**, not tRPC: the backend exports
`AppType`, the frontend uses `hc<AppType>` from `hono/client`, which ships with
Hono. No extra dependency, no codegen. Wired in step 2.5 (2026-09-27) and
**proved** there: a renamed route and a renamed field each made
`npm run build --workspace=frontend` fail with a type error, and it passed
again once restored. The backend writes the routes' declarations
(`build:types`, run by the frontend's `predev` and `prebuild`, because Vercel
builds only the frontend), and `frontend/lib/api-client/` builds two clients
from one `AppType` (`dashboard-api-client.ts` sends the login cookie,
`public-api-client.ts` never does), with one file per call beside them. The
first repo declared `AppType` and never consumed it once; every new route is
called through these clients, never a bare `fetch`.

**Environment variables.** One gitignored `.env` at the repo root in
development, because both `backend` and `packages/shared` read it. In
production there is no `.env` anywhere: Railway and Vercel inject their own.
The frontend gets exactly one variable, `NEXT_PUBLIC_API_URL`, which is public
by definition. Never put a secret in a `NEXT_PUBLIC_*` name, and never add a
`backend/.env` - nothing loads it.

## The client decides everything

**Decided by Frank, 2026-09-28 (project plan decision 30), for the whole app,
and restated on 2026-10-07 because it kept being asked again.** Every choice
that depends on the business is the business's own setting: its hours, closed
days, which messages go out, when a reminder goes (half an hour before, two
hours, the evening before), where replies land, and anything like them. The
product builds the choice and offers every reasonable option; it never fixes
one rule for everyone and nothing is on by default. A feature that adds a
behaviour adds it as a setting, set per business at client setup until the
Settings screen (feature 12) exists.

Never ask Frank to pick one fixed rule for all businesses, and never ask him
for a real client's first value while planning: both are already answered
here. Plan the setting, write the plan, and move on.

## Read these when relevant

- `blueprint/config.json` - deterministic project workflow settings
- `blueprint/context/project-overview.md` - the project's source of truth
- `blueprint/context/coding-standards.md` - read before changing code
- `blueprint/context/ai-interaction.md` - read when running the Blueprint workflow
- `blueprint/context/current-feature.md` - the one feature, fix, or rollback being built right now

Reuse relevant context already loaded in the session. Claude Code imports only
this file; its Blueprint skills load the other files on demand.

## Project configuration

`blueprint/config.json` is the user-owned workflow policy for this project. Each
skill reads it directly and carries the rules it needs, so the options are not
restated here. A missing file means built-in defaults. An invalid one stops
mutating commands and points to `/doctor`.

Configuration tunes review strictness, local branch names, and automated-mode
limits. It never grants permission to commit, merge, push, deploy, publish,
send, delete data, waive a failing check, or accept a finding. Those boundaries
are not configurable.

## Workflow

### A review after every step, not only at the end

**Decided by Frank, 2026-09-24.** This overrides the Blueprint default, where
the audit and the independent review run once per work item at `/complete`.

After each build step (N.1, N.2, ...) passes its own `Done when`, and before
the next step starts:

1. Run `/audit` scoped to that step's changes.
2. Run the independent review on the same changes.
3. Blocking findings (P0/P1) are fixed, or Frank explicitly accepts them with a
   reason, before the next step begins. P2/P3 are counted, recorded and carried.
4. If a review shows a spec or plan file is wrong, correct it now, before the
   next step builds on it.

`/complete` still runs its own final review, but over steps that were each
already reviewed, so it is a short integration check rather than one review of
a whole feature at once.

Why: item 1 had six steps and one review at the end. Reviewing a feature that
size in one go was slow and painful, and faults found late had been built on
for several steps.

This is `workflow.stepReview: "every"` in `blueprint/config.json`, and
`/implement` carries it out. A small project sets `"feature"` instead and
reviews once per feature.

### A spec is approved one step at a time

**Decided by Frank, 2026-09-25.** This overrides the Blueprint default, where
the whole spec is approved once before any step is built.

1. Before the first step, Frank sees the whole feature once, as one picture
   of what each step is for and how the steps feed each other. That is the
   only whole-feature pass. It is not a yes to every line of the spec.
2. Each step's plan (what it does, its pieces, its `Done when`) is gone
   through with him and gets its own yes just before it is built.
3. If a later step shows an earlier one was wrong, the spec and that step
   are amended then, before anything else builds on it.

Why: a yes to a whole spec meant approving pages he had not been through,
and going over six steps at once is the "too many things at a time" that
loses him. Every yes should be on something he has seen.

### After the green light, nothing stops until the review

**Decided by Frank, 2026-09-26.** His time goes into the plan. Once a step's
plan (both parts) has his yes, the step runs straight through: build, tests
and checks, tick the box, publish the page, commit and push to the feature
branch, `/audit`, independent review. The one planned stop is after the
review, where its findings are talked through.

Only three things stop a step earlier:

1. **The agreed plan turns out wrong** while building, and the choice changes
   what gets built (the spec and step are amended with him, then work
   resumes).
2. **A line only he crosses**: installing a package, touching Railway or real
   data, `main`, a merge, a force push, deleting anything.
3. **Blocking review findings** (P0/P1): fixed by default; leaving one unfixed
   is his call.

Everything else is decided without asking and named in the step report, so
nothing is decided silently. Never ask for a yes on something not built yet
(on 2026-09-26 a commit yes asked before 2.4 existed read as if something had
already been built).

### How to present reviews and steps

**Decided by Frank, 2026-09-25.** Applies to audits, reviews, walkthroughs, and
every build step (planning it, reporting it, going through its findings). One
point at a time, every reply in this shape:

1. **Where we are**, one line: the feature and its state, and which point is open.
2. **The point**, told as a plain story from the business ("does the booking
   show on Primo's phone?"), not as architecture.
3. **One small diagram** for that point. Often it is the only part read.
4. **Two or three short lines.** No long prose.
5. **What's left**: a short table of the open points only. Settled points drop
   off the table but are still tracked and applied.
6. **One yes or no question.**

Words: issues are `#N`, features "feature N" (never "item N", which means the
same thing), steps "step N.M". Never a bare number. Never ask again about
something already agreed. A note for a later feature is said as "only a note
for later, we stay on feature N".

Why: long answers and several points at once lost Frank; one contained point,
a little graph and what's left is what he can decide on.

### Git: the laptop does the work, GitHub mirrors it

**Decided by Frank, 2026-09-24.** Written here because the same rules used to
live only in `ai-interaction.md`, which `/feature` and `/implement` are told
not to read. That is how this repo went a week with no GitHub remote at all.

- **GitHub is the main copy.** The repo is `frankdmosquera/scheduleads`. On
  any machine, pull before starting. A missing remote or unpushed commits get
  said out loud at the start of a session.
- **One branch per feature**, off `main`, named for the feature so the branch
  alone says which one is open: `feature/08c-the-worker-s-text`, its build-plan
  number first.
  Steps are commits on it, never branches. Small chores go on whichever
  feature branch is open.
- **One commit per step, pushed straight after.** The step number goes in the
  message: `feat: 2.3 availability rules api`. **Standing yes, Frank,
  2026-09-26:** a step that passes its checks is committed and pushed to its
  feature branch without asking, and so is the commit of review fixes he has
  agreed to. Nothing stops between the build and the independent review; the
  stop is after the review, where the findings are talked through. The yes
  covers feature branches only, never `main`, a merge, a force push or a
  deleted branch, each of which still needs its own yes.
- **Merging is Frank's call, every time.** `/complete` merges locally with a
  merge commit (`--no-ff`), never a squash, tags `item-NN-done`, and pushes
  `main` and the tag, all on one explicit yes, then deletes the branch.
- **Every step and merge ends with a sync line** comparing the local and GitHub
  commit, so "it's pushed" is checked, never assumed.

Feature 1 predates this and was squashed. Its steps are not in `main`; they are
on `feature/multi-tenant-auth-with-the-org-fix`, which is pushed and kept.

Build one feature, fix, or rollback at a time, behind review gates. Each step's instructions
are plain markdown skills any capable agent can read and follow. The workflow is
exposed through tool-specific adapters:

- Codex: `.agents/skills/<skill>/SKILL.md`
- Claude Code: `.claude/skills/<skill>/SKILL.md`
- GitHub Copilot: `AGENTS.md` plus `.agents/skills/<skill>/SKILL.md`
- OpenCode: `AGENTS.md` plus the compatible `.agents/skills/` or
  `.claude/skills/` tree already installed for the selected tools

Unused adapters can be removed. Codex, GitHub Copilot, and OpenCode can share
`.agents/`. OpenCode can also reuse `.claude/` when Claude Code is selected.
Codex-only, Copilot-only, or OpenCode-only projects can delete `CLAUDE.md` and
`.claude/`. Claude Code-only projects can delete `.agents/`, but should keep
`AGENTS.md` because `CLAUDE.md` imports it. Do not duplicate the same Blueprint
skills under `.opencode/skills/`; OpenCode already discovers the compatible
trees.

When changing shared workflow behavior, update the matching skill in both
adapter folders so Codex, Claude Code, GitHub Copilot, and OpenCode stay aligned.

Core skills:

- `onboard` - tune commands, standards, visibility, ignore rules, and tool adapters after overlaying the Blueprint onto a freshly scaffolded or early project
- `discovery` - optional deep, multi-turn planning conversation that drafts the two user-owned plans only after review and approval; direct plan writing remains fully supported
- `doctor` - Blueprint health check for setup, adapters, plans, overview freshness, dashboard state, and workflow drift; it may offer to reset only malformed generated dashboard state after approval
- `adopt` - bootstrap the Blueprint into an existing brownfield app with shipped features
- `overview` - distill the two planning docs into
  `blueprint/context/project-overview.md`, then offer a reviewed initial planning
  baseline commit before Feature 1
- `brief` - read-only briefing on an upcoming build-plan feature (scope, dependencies, size) before you spec it
- `feature` - turn a build-plan item into a spec, or propose a reviewed plan addition for a genuinely new feature
- `debug` - reproduce and isolate a failure without editing code, then hand the evidence to `fix` or `implement`
- `fix` - document an ad-hoc bug or change into `blueprint/context/current-feature.md`
- `tests` - add or normalize unit testing and turn on the test gate
- `browser-tests` - explicitly add or normalize a repeatable browser test harness and document its command
- `ci` - explicitly set up one project-specific Verify command and matching automatic GitHub checks
- `implement` - build the current spec one small, reviewed step at a time
- `check` - prove the current spec against the running app
- `try` - read-only manual review guide: where to go, what to click, what to expect
- `audit` - branch-aware or full-project review across all concerns or a focused quality, security, performance, or tests lens; `audit independent current` prepares an immutable checkpoint for a fresh reviewer session or configured isolated reviewer child; records findings in `blueprint/context/findings.md` and independent receipts in `blueprint/context/review.md`, where blocking findings or stale review state stop `complete`
- `rollback` - plan a safe reversal of a completed feature from its archive and exact git commit, with later-dependency review before code changes
- `complete` - run the final safety pass, log features, fixes, or rollbacks under `blueprint/history/`, then merge with approval
- `release` - optional Render or Vercel deployment readiness, local config, env review, and smoke-test planning
- `prototype` - optional, pre-build static mockups to lock the look
- `status` - read-only progress summary, workflow drift warning, and suggested next action

In Codex, invoke these as skills (`$onboard`, `$discovery`, `$overview`, `$feature`,
`$implement`, and so on) or ask naturally, such as "run the overview." In Claude
Code, use the slash commands (`/onboard`, `/discovery`, `/overview`, `/feature`,
and so on). In OpenCode or other tools without a dedicated invocation syntax,
ask the agent to run the matching skill or follow its `SKILL.md` manually. The
conventions in `blueprint/context/` apply however a step is invoked. `/discovery`
is never required: users may write detailed plans directly or develop them
through any conversation before running `/overview`.

Optional explicit-only skill: `autopilot` combines `feature` or `fix` with
`implement` in one bounded pass when directly invoked, including the configured
regular quality gates. The normal workflow stops for human approval of the spec
before implementation; Autopilot continues through that review point. It may
create checkpoint commits on the feature or fix branch after passing steps and
repair confirmed P0/P1 findings when its audit gate runs. It stops before
`/complete`, merge, push, deploy, or destructive actions.

Optional explicit-only skill: `continuous` can resume or select the next planned
feature and repeat the complete local feature lifecycle through the configured
limit or end of the build plan. It creates one branch and one local merge commit
per feature, applies the Continuous quality gates, archives and merges serially,
and stops on decisions or failed safety gates. It never pushes, deploys,
publishes, sends, or performs destructive actions.

Deployment is also explicit. `/release` can prepare local Render or Vercel config
and run readiness checks, but it must stop before deploy, remote service changes,
push, or publish unless the user gives a separate yes in the current chat.

## The build log

**It lives in the buildlogs app**, in `ai-web-agency/buildlogs`, folder
`buildlogs/logs/scheduleads/`. Frank reads it at http://localhost:3100 on the
laptop and online on his phone. How to write it, what a step looks like and
when to save it are in `buildlogs/logs/README.md`: read that before writing any entry. Every step uses its piece shape
(since 2026-10-09): pieces N.M.k holding plan, what happened, findings and
code together, then Part 2 Testing. Decided by Frank, 2026-09-29: the single-page `project-log.html`
and its Artifact are retired, because publishing it meant reading the whole
1.3 MB page first, about 400k tokens every session.

Frank reads three places: the code, the build log and the chat. He does not
read the files under `blueprint/`, so a decision, risk or open question that
lives only in `current-feature.md` has not been communicated to him.

**The rule.** No build step is reported in chat until its log entry is written.
Order, every time:

1. the step's own check passes
2. tick the box in `blueprint/context/current-feature.md`
3. write the step's entry in `buildlogs/logs/scheduleads/` (its file, its state
   in `roadmap.json`, the feature's Log), then commit that folder to buildlogs'
   `main`, as the guide says; it is pushed about once a day, never per step
   (Frank, 2026-10-09), or whenever he asks to see it online
4. commit the step here and push it (see Git above)
5. only then report the step in chat

`/feature` writes the feature's entry when it writes a spec, `/implement` at
every step, `/complete` before the final commit.

## Dashboard activity

This is **not** the build log above, and nothing in this project renders it. It
is one line of machine state for a host that may display the running command.
Writing it never substitutes for writing the build log entry.

The dashboard can show the active or most recent substantial Blueprint command
from `blueprint/.state/run.json`. This file is generated local state, ignored by
Git, and never part of a feature commit.

Commands with meaningful progress or a durable handoff should write it when the
state directory exists: `onboard`, `adopt`, `discovery`, `overview`, `feature`,
`fix`, `rollback`, `implement`, `debug`, `check`, `audit`, `tests`,
`browser-tests`, `ci`, `prototype`, `autopilot`, `continuous`, `complete`, and
`release`. Short orientation commands such as `brief`, `try`, `status`, and
`doctor` do not need activity state. Doctor's optional approved reset removes
malformed activity instead of recording another run.

Writing the initial activity record is the first action of a tracked command,
before project inspection, preflight, or other tool calls. This one generated
state write does not authorize product changes or bypass any safety check.

Never create or edit `run.json` directly. From the project root, use the first
helper that exists:

```text
node .agents/skills/doctor/scripts/run-state.mjs <action> <options>
node .claude/skills/doctor/scripts/run-state.mjs <action> <options>
```

Start with `start --command <skill> --summary <truthful-summary> --boundary
<boundary>`. Use `update` at meaningful milestones or for a blocker, with
`--status blocked` and `--resume <exact-command>` when recovery is needed. End
with `finish --status ready|completed --summary <truthful-summary>`. The helper
validates every field before atomically replacing the generated file. If it is
missing or fails, report the activity warning and continue the workflow without
writing a manual fallback.

The helper writes this schema:

```json
{
  "schemaVersion": 1,
  "command": "continuous",
  "status": "running",
  "summary": "Completing the remaining build plan",
  "detail": "Implementing feature 3.",
  "boundary": "local-only",
  "startedAt": "<ISO-8601 timestamp>",
  "updatedAt": "<ISO-8601 timestamp>",
  "resumeCommand": "/continuous resume",
  "progress": { "current": 2, "total": 5, "label": "features" },
  "feature": { "id": "3", "title": "Export reports" }
}
```

`status` must be `running`, `blocked`, `ready`, or `completed`. Use `ready` when
the command reached its intended review handoff, such as Autopilot waiting for
review before `/complete`. Use `blocked` with the exact recovery command when
work can resume. `boundary` must be `read-only`, `reviewed`, or `local-only`.
The progress, feature, detail, boundary, and resume fields are optional. Never
put secrets, raw logs, prompts, or user content in this file. Activity tracking
must not change a command's approval boundaries or turn a reporting failure into
a workflow failure.

## Automatic verification

Automatic GitHub checks are a separate explicit setup. `/onboard` and `/adopt`
only report existing checks and point to `/ci` or `$ci` when none exist. Running
`/ci` inspects the real project and defines one `Verify` command from checks that
already exist. Use this order when available: typecheck, tests, then build. Never
invent a test runner or another check just to fill the command.

For JavaScript and TypeScript projects, prefer a package script such as `verify`
and use the detected package manager. For other stacks, use the native task
runner or exact combined command. Record the exact command under Commands below.

The optional `.github/workflows/verify.yml` must run that same command for pull
requests and pushes to the default branch. Preserve existing workflows, use the
project's real runtime and install command, and grant only `contents: read` by
default. This setup does not add local git hooks, coverage, browser tests,
security scans, or version matrices. Those remain later project choices.

GitHub branch protection or a ruleset can require the check after the repository
is pushed, but that is a separate remote setting. Missing automatic GitHub
checks do not make the Blueprint unusable.

## Commands

npm workspaces monorepo (`frontend`, `backend`, `packages/*`). Every app
command targets one workspace explicitly. The only root-level scripts are the
formatter, which covers the whole repo:

- Format every code file: `npm run format`
- Check formatting without changing anything: `npm run format:check`

Prettier is a root dev dependency, configured in `.prettierrc`. `.prettierignore`
keeps it to code: docs, the Blueprint skills and generated files are never
reformatted.

- Frontend dev server: `npm run dev --workspace=frontend` (http://localhost:3400)
- Backend dev server: `npm run dev --workspace=backend` (http://localhost:3401)
- Frontend build: `npm run build --workspace=frontend`
- Backend build: `npm run build --workspace=backend`
- Frontend start (serves the build): `npm run start --workspace=frontend`
- Backend start (runs `dist/`): `npm run start --workspace=backend`
- Frontend lint: `npm run lint --workspace=frontend`

**Scheduleads owns 3400 (frontend) and 3401 (API), and nothing else.**
Decided by Frank, 2026-10-03. His other projects run on 3000/3001 and are
never stopped, never asked about, for any check. The frontend is pinned with
`-p 3400`, so if 3400 is taken it fails loudly instead of drifting onto the
API's port. If one is taken, check what holds it: a leftover scheduleads
process is stopped, anything else is reported and left running. The ports
move together, everywhere at once: `git grep -n -E "340[01]"` lists every
place in the repo, and outside it `PORT`, `BETTER_AUTH_URL` and `APP_ORIGIN`
in the root `.env`, plus `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if
that file exists. Google's OAuth client lists
`http://localhost:3401/calendar/callback` as its redirect.

Database, all from `packages/shared`, which owns the schema and the migration
ledger:

- Generate a migration from the schema: `npm run db:generate --workspace=@scheduleads-app/shared`
- Apply pending migrations: `npm run db:migrate --workspace=@scheduleads-app/shared`
- Seed the two development accounts: `npm run db:seed --workspace=@scheduleads-app/shared`
- Browse the data: `npm run db:studio --workspace=@scheduleads-app/shared`

Development runs against a local PostgreSQL 18, the same major version as
Railway, in a database named `scheduleads_dev` on 127.0.0.1:5432, and `.env`
points `DATABASE_URL` there. `db:migrate` builds a fresh one and `db:seed`
makes it usable: it creates `admin@example.com`, the platform admin, owning
Summit Painting (dev) (`painting-dev`, shaped like Primo), and
`owner@example.com`, an ordinary owner, owning Riverbend Clinic (dev)
(`clinic-dev`, shaped like Face and Body: six practitioners, five rooms, ten
treatments). The full cast is in `packages/shared/scripts/seed-dev.ts`. Signup is
closed, so without the seed a new database has no way in. Login codes print in
the API's console. The seed refuses any database that is not on this machine
or whose name does not end in `_dev`.

- Print a login's busy times from their connected calendar: `npm run calendar:check --workspace=backend -- <login email> [days]`

It reads the real calendar through the saved connection, 7 days by default and
at most 31, in the business's time zone, and prints no tokens. It refuses the
same databases the seed does. That guard lives in one place,
`packages/shared/helpers/assert-local-dev-database.ts`, used by the seed, the
database tests and this command.

Railway is reached only on purpose: open the tunnel with
`railway connect Postgres --tunnel-only --port 5433`, leave it running, and
switch the Railway `DATABASE_URL` line in `.env` back on. The tunnel also
listens on localhost, which is why the seed checks the database name as well
as the host.

`drizzle.config.ts` loads the root `.env`. `db:generate` needs no database.
Never generate a migration from `backend` or `frontend`: two workspaces
generating against one database is how a migration ledger forks.

No separate typecheck script: `next build` typechecks the frontend and the
backend build is `tsc`. `packages/shared` compiles to `dist/` and both apps
build it first through their own `predev` and `prebuild` hooks, so neither
consumes it as TypeScript source. The frontend's hooks also run
`npm run build:types --workspace=backend`, which writes the API's route types
for the typed client, so a type error anywhere `backend/app.ts` reaches stops
`npm run dev --workspace=frontend` and the frontend build too. Then they
compile `packages/booking-component` (the booking window client sites
embed, feature 9), which reads only the public routes' type, `PublicAppType`.

- Booking component build: `npm run build --workspace=@scheduleads-app/booking-component`

Unit tests run on Vitest, a dev dependency of the workspace that holds the
code under test. Test files sit beside the code as `*.test.ts` and are
excluded from `tsc`, so they never reach `dist/`. The test gate applies: a
step that adds logic adds its tests, and every step reruns them.

- Shared package tests: `npm run test --workspace=@scheduleads-app/shared`
- Shared package tests, rerunning on save: `npm run test:watch --workspace=@scheduleads-app/shared`
- Backend tests: `npm run test --workspace=backend`
- Backend tests, rerunning on save: `npm run test:watch --workspace=backend`
- Booking component tests: `npm run test --workspace=@scheduleads-app/booking-component`

Both backend commands rebuild `packages/shared` first (their `pre` scripts),
because the route tests load its code, not only its types. Since step 2.4 the
backend tests also need the local Postgres running with `db:migrate` and
`db:seed` done: the public route tests call the real app against the seeded
`scheduleads_dev`, add their own rows and remove them, and refuse any database
that is not local and `*_dev`. With Postgres stopped they fail; they never skip.

The frontend has no test script yet; it gets one with its first test, so no
workspace ever carries a test command that finds nothing to run.

There is no `Verify` command and no GitHub check yet; `/ci` sets those up when
wanted.

Browser testing is also opt-in. Run `/browser-tests` or `$browser-tests` to add
or normalize a browser harness and document its exact command as `Browser
tests`. Check and Continuous Mode can then reuse it without installing tooling
mid-feature.
