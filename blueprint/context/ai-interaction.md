# AI Interaction Guidelines

> **This blueprint is an overlay layer**, added on top of an already-scaffolded
> app. Never run a framework scaffolder (create-next-app, etc.) inside this
> directory. For a new project, scaffold the app first, then overlay these files.

## Communication

- Be concise and direct
- Explain non-obvious decisions briefly
- Ask before large refactors or architectural changes
- Don't add features not in the project spec
- Never delete files without clarification
- Rules stay in this project. Nothing gets written to workspace-level files or
  to memory unless told to.
- A question, a comment, or a paste is not an instruction. Answer in words.
  No editing until we agree. Reading and checking to answer well is fine;
  changing anything is not.
- One bite at a time. One change, then stop and wait. If it has smaller parts,
  same rule for each. Never execute the whole plan at once.
- Rules are hard stops, not permission requests. Never offer an option a rule
  already forbids. If a rule should change, say so and change the rule first.
- One question at the end, on its own line. If a second one ends up open
  before the first is answered, confirm which one the reply is for.
- Never guess what a "yes" means. It only counts when exactly one question is
  open. A reply may be answering the earlier question, not the latest, so
  confirm before acting.
- Parked is not dropped. When something gets set aside, keep it on a visible
  list and bring it back. Never let a, b, c quietly become just a.

## Output formatting

Format every response for fast scanning, in whatever tool renders it. The skills
point at this file for formatting, so tune this to taste and the change applies
everywhere.

- **Real markdown, not prose walls** - bold field labels, short lines, a blank line between blocks.
- **Enumerations are lists** - a sequence of steps, options, or findings is a numbered or bulleted list, never an inline `(1)... (2)... (3)...` run crammed into a paragraph.
- **Tables for matrices** - comparing things across the same fields (status per item, option tradeoffs) goes in a table, not stacked bullets.
- **Backticks for code things** - identifiers, paths, commands, filenames.
- **Lead with the answer** - state the result or the state first, supporting detail after.
- **Don't over-format** - no deep bullet nests or decorative headers on a two-line reply. Concise still wins.

## The published build log (Artifact)

Every project keeps a live build log published as an Artifact. It is not a
nice-to-have progress log.

Published at: https://claude.ai/artifact/R4QgeshVPpKB45BP67xQGF

`/overview` publishes it the first time and writes the URL on that line. Every
later republish passes that URL as `url`, so the link never changes.

**Frank reads three places: the code, the Artifact, and the chat.** He does
*not* read the files under `blueprint/`. Anything he needs in order to follow
the work or make a decision has to reach him through one of those three. A
decision, risk, trade-off, or open question that lives only in
`current-feature.md` or a history archive **has not been communicated to him.**
Writing it in the spec is bookkeeping; putting it on the page or in the chat is
telling him.

**Chat is where the work happens. The Artifact is how he prepares for it.**
Chat is the more important channel - decisions get made there. But he opens the
page *first* and reads overall status off it in seconds: what is done, what is
running, what is blocked. Rebuilding that picture by scrolling the transcript
takes several times longer. He runs two or three projects at once and bounces
between them, so the page is how he *reloads* a project after being away.

**A stale page is therefore worse than a missing update.** He does not merely
lack news - he arrives already holding a *wrong model* of where things stand,
and plans from it.

### The rule, enforced by coupling rather than memory

**No commit that closes a build step without publishing the Artifact in the
same turn.** The publish is the last tool call before the commit; the chat
message reporting the step describes what is *already* live.

Order, every time:

1. the step's own check passes
2. tick the box in `current-feature.md`
3. add the entry at the top of that feature's timeline and republish
4. offer/make the checkpoint commit
5. *only then* report the step in chat

This is deliberately mechanical. Stating it more emphatically has already
failed: it was written into project docs *and* into agent memory, and was still
missed twice in one session on 2026-09-08 - both times caught by Frank opening
the link rather than by the agent. Coupled to the commit it becomes checkable:
about to commit without having published means the rule is already broken.

### Markers

Four markers, each a glyph **and** a colour, with a key in the sidebar. The
glyph sits **inside** the timeline dot, so the page reads without relying on
colour at all.

| Marker | Colour | `data-kind` | Means |
| --- | --- | --- | --- |
| `!` | red | `decision` | **Blocked on Frank.** Work stops until he answers |
| `?` | amber | `question` | Open question. The build continues |
| `✓` | green | `done`, `decided`, `change` | Done, or a decision he approved |
| `↻` | violet | `fix` | A real fault found and repaired |

Render them from `data-kind` via `.dot::before` so entry markup never carries a
glyph and new entries get theirs automatically. **Do not use a teal or blue
accent for fixes** - it is indistinguishable from green at dot size and is
usually already the link colour.

**A page that is complete but not scannable has failed at its job.** Status must
be legible at a glance - step rails, counts, markers, a status pill - not buried
in prose. Prose carries the *why*; the glance layer carries *where things stand*.

### Shape and storage

One group per topic, switched client-side, listed in a sidebar: two standing
groups (**The project** and **Roadmap**) plus **one group per feature**, created
the moment that feature becomes current. Inside a feature group: status header
and step rail, the build log newest entry first, then goal, build steps, scope,
contracts and notes.

**Specs are presented in the artifact, not just in chat** - status pill, branch,
`0 of N steps`, the step rail, a green `decided` entry recording each decision
*and why the rejected option was rejected*, then Goal, Build steps each with a
`Done when` gate, Scope in/out, Contracts.

Keep the page source tracked in the repo at
`blueprint/context/project-log.html` and republish it **passing the existing
artifact URL as `url`**, so the link never changes. Publishing a path the
conversation has not published, without `url`, creates a *separate* artifact and
orphans the real one.

## Workflow

The loop we use for every feature. The spec for the feature being built lives in
@blueprint/context/current-feature.md.

Run `/feature` (or `/fix` for a bug or change that isn't a planned feature) to
write the spec, `/implement` to build it on a branch, and `/complete` to log it
and merge. The numbered loop below is what those skills follow.

After the first successful `/overview`, Blueprint offers a reviewed local commit
for the initial workflow setup and plans before Feature 1. It shows the exact
candidate diff and asks first. It skips local-only installations and stops
rather than mixing app source or unrelated work into the baseline. When setup
work is on a dedicated branch, the same approval can finalize the local baseline
and fast-forward it into the unchanged default branch. It never pushes.

The skills are the structured path, not a requirement. You can also just describe
a feature, fix, or change in chat at any time and we'll build it the same way; the
rules below still apply (small steps, a reviewable diff, the conventions in
`coding-standards.md`). Project instructions tell the agent to read these files
when the work needs them instead of carrying them through every unrelated turn.
Use the skills when you want the repeatable loop and the logging; prompt directly
when you just want something done.

1. **Spec** - Optionally run `/brief` first for a read-only preview of the next
   feature (scope, dependencies, size); it writes nothing. Then run `/feature`
   (no number = the next unchecked item in `build-plan.md`) to generate
   @blueprint/context/current-feature.md, then review it together before any code.
2. **Branch** - Create a new branch for the feature/fix.
3. **Implement** - Build one small step from the spec at a time, not the whole
   feature as one undifferentiated change.
4. **Review** - By default, implement and verify each small step, then show one
   feature-level review packet with the complete diff and done-when evidence.
   Set `workflow.stepReview` to `every` when I should approve each step before
   the next one begins. After the final packet, `/implement` always offers a
   read-only walkthrough of the finished code, regardless of review cadence or
   checkpoint settings.
5. **Test** - Verify the done-when with evidence. If `AGENTS.md` declares a
   `Verify` command, run that exact command as the final automated gate. It wraps
   only the checks the project actually has. If no Verify command exists, run the
   documented build command and the test command when configured. A step that
   adds logic must ship a passing test when the test gate is on. When `AGENTS.md`
   declares `Browser tests`, stable browser behavior can include focused harness
   coverage, while remaining UI and integration claims ride on direct browser,
   screenshot, API, and build evidence. Run `/tests` or `/browser-tests`
   explicitly rather than adding a missing runner mid-feature. See the Testing
   section of `coding-standards.md` for the gates.
   Run `/ci` separately when you want one Verify command and matching automatic
   GitHub checks; CI setup is not part of this feature loop.
6. **Try manually (optional)** - Run `/try` when you want a human walkthrough:
   what to start, where to go, what to click or run, what to expect, and what
   would count as wrong. `/check` proves behavior from the agent side; `/try`
   gives you the manual review path.
7. **Audit (optional)** - Run `/audit` when you want a read-only code quality pass
   before closing a feature or after a larger automated run. It checks for
   duplication, dead code, missing tests for logic, standards drift, and
   maintainability risks. Run `/audit independent current` when a selected fresh
   reviewer should inspect an approved checkpoint and leave a staleness-checked
   receipt. Regular and Continuous independent review default to
   `when-sensitive`, so sensitive or unusually broad work selects this gate
   automatically while ordinary small features do not. A `manual` gate policy
   disables automatic selection, but the explicit command remains available.
   `review.independentExecution` defaults to an automatic isolated reviewer when
   the adapter supports it; set it to `manual` for the fresh-session handoff.
   Automatic review runs after final Verify, required Check, and verified spec,
   before the final packet and `/complete`. Fixes still happen through
   `/implement` or `/fix`. The automatic path starts a generic child through the
   current runtime and instructs it from the project-local Audit skill and review
   contract. It never depends on a global role, skill, prompt, or TraversyFlow.
   The request records requested execution and the receipt records actual
   execution, including an explicit manual fallback when automatic review is not
   available.
8. **Iterate** - If it doesn't work or needs changes, re-prompt or hand-edit and
   re-test; repeat until it works, before moving on.
9. **Checkpoint (optional)** - checkpoint commits are disabled by default. When
   enabled with per-step review, `/implement` offers continue, commit a
   checkpoint, walk me through it, or stop here after an approved step. The
   checkpoints are optional rollback points; `/complete` still makes the real
   feature-level commit. Verify, or the fallback checks, must pass first. When
   implementation is done, end with a compact review packet: changed files,
   checks run, manual try path, risks, and next action. The per-step walkthrough
   is part of the Guided checkpoint prompt. The final code walkthrough is always
   available and is separate from the manual product-review path produced by
   `/try`.

`workflow.stepReview: "every"` restores per-step approval pauses but does not
enable checkpoint prompts by itself. The previous workflow uses
`stepReview: "every"` together with `checkpointCommits: "enabled"`.
10. **Safety + log** - `/complete` first checks the active spec, branch, changed
   files, Verify or fallback check evidence, manual try path, and adapter sync when
   workflow files changed. Then it archives the spec to `blueprint/history/features/NN-name.md` (or
   `blueprint/history/fixes/`), checks the feature off in `blueprint/build-plan.md`, and
   resets `blueprint/context/current-feature.md` and
   `blueprint/context/review.md` to their stubs.
11. **Feature commit** - `/complete` stages everything on the branch (step work
   plus the logging changes) into one conventional feature commit.
12. **Merge** - `/complete` asks one question naming the merge, the tag and the
    push. On a yes it merges the branch into main locally with a merge commit
    (`--no-ff`, never a squash), tags a feature `item-NN-done`, pushes main and
    the tag, and keeps the branch. Every step commit stays in main's history.
13. **Release prep (optional)** - run `/release render` or `/release vercel`
    after a completed feature or milestone when you want local provider config,
    env var review, build/start checks, and a smoke-test path. `/release` must
    stop before deploy, remote service creation, remote env changes, push, or
    publish unless the user gives a separate yes in the current chat.

**Resuming after a context clear.** Progress lives in files, not the chat:
`current-feature.md` holds the spec with each step checked off as it's done, and git
holds the code (branch, commits, working tree). A fresh `/implement` or
`$implement` run loads `current-feature.md` on demand and continues from the
first unchecked step, so no separate save or load command is needed.

Do NOT commit without permission or until Verify, or the fallback build and tests,
passes. If a required check fails, fix the issue first.

Autopilot exists only as an explicit opt-in command: `/autopilot` or
`$autopilot`. Do not suggest it as the default next action. It combines
`/feature` or `/fix` with `/implement` in one bounded pass. The normal workflow
stops for human approval of the spec before implementation; an explicit
Autopilot request continues through that review point without pausing after each
passing implementation step. It may create checkpoint commits on the feature or
fix branch after passing steps. It stops before `/complete`, merge, push, deploy,
publish, destructive actions, or hiding failing checks.

Continuous Mode also exists only as an explicit opt-in command: `/continuous`
or `$continuous`. Do not suggest it as the default next action. Its explicit
invocation authorizes the local per-feature lifecycle defined by that skill:
configured checkpoint commits, one local merge commit and tag per completed
feature, kept branches, and repetition through the
configured limit or end of the build plan. It never authorizes push, deploy,
publish, send, remote changes, destructive actions, finding waivers, or product
decisions.

## Git cycle

Per feature, in this order:

The laptop does all the work and GitHub receives it. GitHub never merges or
changes anything on its own, so the two stay a mirror.

1. **New branch** off `main` per feature, using the prefixes in
   `blueprint/config.json`. Steps are commits on it, never branches.
2. **One commit per build step, pushed right after.** Requires
   `workflow.checkpointCommits: "enabled"` and the once-per-item yes that
   `/implement` asks for.
3. **Merge into `main` locally with a merge commit**, never a squash, then tag
   and push `main`. `/complete` does this on one explicit yes.
4. **The next feature starts from a fresh branch** off the updated `main`.
5. **Keep the merged branch.** Never delete a branch, on this or any project.

On a second machine, pull before starting. That is the only time GitHub gives
anything back.

**Every project has a GitHub remote.** `/implement` stops before the first
step when `git remote get-url origin` fails. Squash merges were dropped on
2026-09-24: feature 1 was squashed, so its steps live only on its branch, now
pushed as `feature/multi-tenant-auth-with-the-org-fix`.

## Commits

- Ask before committing, except for checkpoint and feature-lifecycle commits
  explicitly authorized by `/autopilot` or `/continuous`
- The initial Overview baseline also requires explicit approval and uses
  `chore: establish Blueprint project baseline`
- Use conventional commit messages (feat:, fix:, chore:, etc.)
- Keep commits focused (one feature/fix per commit)
- Never put "Generated with Claude" or any AI attribution in commit messages

## When Stuck

- If something isn't working after 2-3 attempts, stop and explain the issue
- Don't keep trying random fixes
- Ask for clarification if requirements are unclear

## Code Changes

- Make minimal changes to accomplish the task
- Don't refactor unrelated code unless asked
- Don't add "nice to have" features
- Preserve existing patterns in the codebase
- For visual or replication features (recreating a design, matching a mockup),
  work from a reference image stored in `blueprint/reference/`, not a prose
  description. Ask for the image if it's missing; building a visual target from
  words alone yields an approximation that costs rework.

## Code Review

Review AI-generated code periodically, especially for:

- Security (auth checks, input validation)
- Performance (unnecessary re-renders, N+1 queries)
- Logic errors (edge cases)
- Patterns (matches existing codebase?)
