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
limit or end of the build plan. It creates one branch and one local main commit
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
4. offer or make the checkpoint commit
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

npm workspaces monorepo (`frontend`, `backend`, `packages/*`), no root-level
scripts - every command targets one workspace explicitly.

- Frontend dev server: `npm run dev --workspace=frontend` (http://localhost:3000)
- Backend dev server: `npm run dev --workspace=backend` (http://localhost:3001)
- Frontend build: `npm run build --workspace=frontend`
- Backend build: `npm run build --workspace=backend`
- Frontend start (serves the build): `npm run start --workspace=frontend`
- Backend start (runs `dist/`): `npm run start --workspace=backend`
- Frontend lint: `npm run lint --workspace=frontend`

Database, all from `packages/shared`, which owns the schema and the migration
ledger:

- Generate a migration from the schema: `npm run db:generate --workspace=@scheduleads-app/shared`
- Apply pending migrations: `npm run db:migrate --workspace=@scheduleads-app/shared`
- Browse the data: `npm run db:studio --workspace=@scheduleads-app/shared`

All three need `DATABASE_URL` and, locally, the Railway SSH tunnel on
127.0.0.1:5433. `drizzle.config.ts` loads the root `.env`. Never generate a
migration from `backend` or `frontend`: two workspaces generating against one
database is how a migration ledger forks.

No separate typecheck script: `next build` typechecks the frontend and the
backend build is `tsc`. `packages/shared` compiles to `dist/` and both apps
build it first through their own `predev` and `prebuild` hooks, so neither
consumes it as TypeScript source.

No unit test runner is configured, so no test gate applies. Run `/tests` to
add one and record the real test command here. There is no `Verify` command
and no GitHub check yet; `/ci` sets those up when wanted.

Browser testing is also opt-in. Run `/browser-tests` or `$browser-tests` to add
or normalize a browser harness and document its exact command as `Browser
tests`. Check and Continuous Mode can then reuse it without installing tooling
mid-feature.
