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
Hono. No extra dependency, no codegen. It is not wired yet and that is
deliberate - feature 1's only frontend-to-backend traffic goes through the
Better Auth client, which is already typed. It arrives at item 2 with the first
real route, and must be **proved** there by breaking a route on purpose and
confirming the frontend stops compiling. The first repo declared `AppType` and
never consumed it once; do not inherit that claim unproven.

**Environment variables.** One gitignored `.env` at the repo root in
development, because both `backend` and `packages/shared` read it. In
production there is no `.env` anywhere: Railway and Vercel inject their own.
The frontend gets exactly one variable, `NEXT_PUBLIC_API_URL`, which is public
by definition. Never put a secret in a `NEXT_PUBLIC_*` name, and never add a
`backend/.env` - nothing loads it.

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
- **One branch per feature**, off `main`. Steps are commits on it, never
  branches. Small chores go on whichever feature branch is open.
- **One commit per step, pushed straight after.** The step number goes in the
  message: `feat: 2.3 availability rules api`. `/implement` asks once per
  feature whether it may; the yes covers that branch only.
- **Merging is Frank's call, every time.** `/complete` merges locally with a
  merge commit (`--no-ff`), never a squash, tags `item-NN-done`, and pushes
  `main` and the tag, all on one explicit yes. The branch is kept.
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

## The published build log (Artifact)

**Published at: https://claude.ai/artifact/R4QgeshVPpKB45BP67xQGF**

Source: `blueprint/context/project-log.html`, tracked in the repo. The Artifact
is that file published. It does not update itself and nothing regenerates it.
Editing the file and republishing it to that URL is the only thing that moves
it.

Frank reads three places: the code, this page, and the chat. He does not read
the files under `blueprint/`. A decision, risk or open question that lives only
in `current-feature.md` has not been communicated to him. He opens the page
first and reads status off it in seconds, so a stale page is worse than a
missing update: he arrives holding a wrong model and plans from it.

**The rule.** No build step is reported in chat, and no commit closes one, until
the page is republished in the same turn. Order, every time:

1. the step's own check passes
2. tick the box in `blueprint/context/current-feature.md`
3. add the entry at the top of that feature's timeline in
   `project-log.html` and republish, passing the URL above as `url`
4. commit the step and push it (see Git above)
5. only then report the step in chat

`/feature` publishes the feature's group when it writes a spec, including each
decision and why the rejected option was rejected. `/implement` publishes at
every step. `/complete` publishes before the final commit.

**The roadmap has to stand alone.** Someone reading only the Roadmap view, and
opening nothing else, should know what is being built and what each step of it
actually does. A step title is not that: "1.2 Better Auth on the Hono backend"
names a thing without saying anything about it. So the item being built carries
its steps inline on the roadmap, each one a `<details>` that opens into the same
plan the chat got - what it does and why, its concrete pieces, and its
`Done when`. Collapsed it stays a list you can scan; the current step is left
`open`.

**One item, one place.** There is no separate page per feature. Everything about
the item being built lives in its own row on the roadmap, as collapsed
`<details>` drawers under its title: **Steps** (open, the numbered steps with
their plans and outcomes), **Why this item exists**, **Decisions**,
**Contracts**, **Log**, **Notes**. Closed, the row is one line in a list of 28.
Open, it is the whole record without leaving the page.

The page therefore has two views and two buttons: **Roadmap**, which is home and
what loads, and **The project**, the eight planning answers. It used to have a
third view per feature, which meant the same steps were maintained in two places
and silently drifted. Never reintroduce that. If something seems to belong in
two places, one of them links to the other rather than restating it.

**Plan first, then plan against reality.** A step is published with its plan
before the work starts: what it does and why, its concrete pieces, its
`Done when`. When it closes, that plan is **not rewritten to match what
happened** - rewriting it hides the only interesting part. Each planned piece
instead gets marked with what became of it, and the reason when it is not
`kept`:

| Mark | Means |
|---|---|
| `kept` | done as planned |
| `changed` | done differently, with why |
| `added` | not planned, with what forced it |
| `dropped` | planned and abandoned, with why |

A short verdict row carries the counts, so a reader sees the size of the drift
before reading any of it.

**And it says what bit.** Listing what got built reads like a plan that went
perfectly, and none of them do. A closing step records the wrong assumption, the
trap inherited from an older repo, the check that proved nothing, the spec
instruction that turned out wrong. Short, with the reason, no drama and no
padding. Keep these separate from the piece-level marks above: the marks say
what changed, this says what it cost to find out. These are the part worth
reading back in six months, and they are written whether or not anyone asks.

**And it shows the code.** Decided by Frank, 2026-09-25: the project is big
and he wants full control, so every closing step carries a closed drawer,
**What changed in the code**, holding one closed drawer per changed file. The
real code, as it reads in the editor, never a summary line: a new file is
shown whole; a changed file shows the old block, then the new one, with a few
lines around them. Real line numbers from the file. New lines get a thin green
bar on the left and removed lines a thin red one; no `+` or `-` signs, because
he reads code, not diffs. Coloured by Prism, loaded by the page from `cdnjs`,
with the token colours and `#121314` background of VS Code's **Dark 2026**,
the theme Frank uses, so the page and his editor match. Ends with a link to the
step's commit on GitHub for the full diff.

Only the project's own code goes in the drawer: what sits in `frontend/`,
`backend/` and `packages/shared/`, tests included, and the SQL of a migration.
Never `node_modules`, `package-lock.json`, `dist/`, Drizzle's snapshot JSON or
anything else generated. A changed dependency is one line naming the package,
not the manifest.

**One numbering, everywhere.** Roadmap item N owns steps N.1 to N.k, so a step
number always says which item it belongs to. Never number a feature's steps from
1, and never put a bare count beside a numbered list: "2 done" next to items
numbered 1, 2, 3 reads as "item 2 is done". Name the items instead, as in
"Done 0a, 0b / Building 1 / To go 2 through 26".

Republish by passing that URL as `url`. Publishing the path without it creates a
separate artifact and orphans the real one.

Fuller conventions, markers and page shape live in
`blueprint/context/ai-interaction.md`. This section is duplicated here on
purpose: the `feature` and `implement` skills both instruct the agent not to
read that file, which is how the page went stale three times. Everything above
has to survive without it.

## Dashboard activity

This is **not** the build log above, and nothing in this project renders it. It
is one line of machine state for a host that may display the running command.
Writing it never substitutes for publishing the Artifact.

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
keeps it to code: docs, the build log page, the Blueprint skills and generated
files are never reformatted.

- Frontend dev server: `npm run dev --workspace=frontend` (http://localhost:3000)
- Backend dev server: `npm run dev --workspace=backend` (http://localhost:3001)
- Frontend build: `npm run build --workspace=frontend`
- Backend build: `npm run build --workspace=backend`
- Frontend start (serves the build): `npm run start --workspace=frontend`
- Backend start (runs `dist/`): `npm run start --workspace=backend`
- Frontend lint: `npm run lint --workspace=frontend`

The frontend must get port 3000. The API trusts only that origin, and when
another app already holds 3000, Next moves to 3001 without asking, collides
with the API, and the sign-in page ends up sending its auth calls to itself.
Starting the frontend also rebuilds `packages/shared`, which restarts the
API's watcher, and that restart is the moment the port can be lost. Check that
the frontend reports 3000 before signing in.

Database, all from `packages/shared`, which owns the schema and the migration
ledger:

- Generate a migration from the schema: `npm run db:generate --workspace=@scheduleads-app/shared`
- Apply pending migrations: `npm run db:migrate --workspace=@scheduleads-app/shared`
- Seed the two development accounts: `npm run db:seed --workspace=@scheduleads-app/shared`
- Browse the data: `npm run db:studio --workspace=@scheduleads-app/shared`

Development runs against a local PostgreSQL 18, the same major version as
Railway, in a database named `scheduleads_dev` on 127.0.0.1:5432, and `.env`
points `DATABASE_URL` there. `db:migrate` builds a fresh one and `db:seed`
makes it usable: it creates `admin@example.com`, the platform admin, and
`owner@example.com`, an ordinary owner, each owning one business. Signup is
closed, so without the seed a new database has no way in. Login codes print in
the API's console. The seed refuses any database that is not on this machine
or whose name does not end in `_dev`.

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
consumes it as TypeScript source.

Unit tests run on Vitest, a dev dependency of the workspace that holds the
code under test. Test files sit beside the code as `*.test.ts` and are
excluded from `tsc`, so they never reach `dist/`. The test gate applies: a
step that adds logic adds its tests, and every step reruns them.

- Shared package tests: `npm run test --workspace=@scheduleads-app/shared`
- Shared package tests, rerunning on save: `npm run test:watch --workspace=@scheduleads-app/shared`

The backend gets the same `test` and `test:watch` scripts, and Vitest as a dev
dependency, in step 2.2 with its first test, so no workspace ever carries a
test command that finds nothing to run.

There is no `Verify` command and no GitHub check yet; `/ci` sets those up when
wanted.

Browser testing is also opt-in. Run `/browser-tests` or `$browser-tests` to add
or normalize a browser harness and document its exact command as `Browser
tests`. Check and Continuous Mode can then reuse it without installing tooling
mid-feature.
