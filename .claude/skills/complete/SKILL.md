---
name: complete
description: Complete a finished feature, fix, or rollback by running final gates, archiving its spec, updating plans, creating the work commit, and requesting approval before merging into main with a merge commit and pushing. Use for /complete or requests to finish, wrap up, merge, or close the current work item.
disable-model-invocation: true
---

# complete - log the finished work, make the work commit, and merge

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` using the dashboard activity
contract in `AGENTS.md`.

Where this sits in the workflow:

    /feature, /fix, or /rollback  ->  /implement  ->  [complete]  ->  next
    (the spec)                         (build it)      (commit + merge + log)

`/implement` built the feature, fix, or rollback on its branch, with a pushed
commit per step. This skill closes it out: it logs the work, makes the
work-level commit, merges into `main` with a merge commit, and pushes. Run it
only when the work is done,
reviewed, and the documented `Verify` command, or the fallback build and tests,
passes.

## Before you start

Read `blueprint/config.json`. A missing file means the built-in defaults apply.
If the file exists but is invalid, stop and point the user to `/doctor`.
Configuration can strengthen or shape the completion gates, but it never grants
permission to commit, merge, push, deploy, publish, or take destructive action.

Confirm the work is actually finished: `blueprint/context/current-feature.md`
holds a real spec, its steps are built on a branch, and `Verify`, or the fallback
build and tests, passes. Apply the configured regular quality gates below before
logging or committing. Step commits are normally already made and pushed by
`/implement`; any uncommitted step work left over is committed here. Don't
require the steps to be pre-committed.

Read `blueprint/context/review.md` when present. A missing file on an older
install means no independent review has been requested. A pending,
changes-requested, malformed, or stale record is always a blocker because the
user already initiated that gate, even when its configured policy is `manual`.

## Configured regular quality gates

Use `qualityGates.regular` for this work item:

- **Audit:** `manual` runs only when the user explicitly requests `/audit`;
  `when-sensitive` runs for authentication, authorization, payments, secrets,
  personal or user data, migrations, destructive operations, external side
  effects, security boundaries, or unusually broad changes; `always` runs for
  every work item.
- **Independent review:** `manual` runs only when the user explicitly requests
  `/audit independent current`; `when-sensitive` requires it for the same
  sensitive categories as Audit; `always` requires it for every work item. An
  independent review includes a full current audit, so it satisfies a selected
  Audit gate instead of repeating the audit in the builder session.
- **Check:** `manual` runs only when explicitly requested; `when-behavioral` runs
  when a done-when needs observed runtime behavior such as a click, request, CLI
  command, download, background job, or multi-screen flow; `always` runs for
  every work item.
- **Try guide:** `manual` runs only when explicitly requested;
  `when-user-facing` generates a guide when the change affects UI, navigation,
  copy, a public API or CLI, output, or another workflow a person directly uses;
  `always` generates one for every work item.

Apply automatic gates in this order: `/check`, review, then `/try`. When
independent review is selected, run `/audit independent current`, stop at its
handoff, and resume Complete only after a fresh reviewer writes a current
passing receipt. Otherwise run `/audit current` when Audit is selected.
Reuse adequate evidence produced during the current work item instead of
repeating it. A required gate that cannot run is a blocker. `/try` only generates
instructions for human review; never claim the user performed them. P0 and P1
finding blockers remain enforced regardless of these settings.

## Step 0 - final safety pass

Before logging or committing, run a short safety pass and report blockers only:

- active spec exists and the work is not being completed from `main` or `master`
- the branch name uses the configured feature, fix, or rollback prefix
- changed files are tied to the active spec, with no unrelated dirty work mixed
  in (dirty `blueprint/context/findings.md` and
  `blueprint/context/review.md` are expected review evidence)
- the exact `Verify` command from `AGENTS.md` passed in this session, when one is
  declared; otherwise the build passed, and tests passed when the project has a
  declared test command and the change touched logic
- any check required by `qualityGates.regular` has evidence, and there is a clear
  manual try path
- with `verification.logicTests: "required"`, logic changes have a configured
  runner and passing focused tests; otherwise completion is blocked and `/tests`
  is the next setup step
- with `verification.uiEvidence: "required"`, UI done-whens have direct browser
  evidence, including screenshots and relevant console and network checks
- any audit or try guide required by `qualityGates.regular` ran before completion
- a selected independent-review gate has a `passed` receipt whose target equals
  `HEAD`, whose base ref still produces the recorded merge base, whose exact
  spec SHA-256 still matches, whose reviewer adapter and selected model match
  the request, whose required Check result passed, whose receipt sections are
  non-empty, and whose target has no later changes except the review and
  findings files. Apply the same checks to any explicit receipt even when the
  configured policy is `manual`. Any mismatch is stale and blocks completion.
- when a passing independent receipt exists, the active spec is already
  `verified` and remains byte-for-byte unchanged through archival
- if workflow files changed, `.agents` and `.claude` stayed in sync where both
  adapters exist
- no P0 or P1 finding in `blueprint/context/findings.md` is `open` or `fixed`.
  `fixed` still blocks on purpose: the repair exists but no review has looked at
  it - run `/audit` to close it. The only waivers are `accepted` (the user's
  explicit decision in the current chat, reason recorded; never set it for
  them) or `invalid` (an `/audit` re-examination verdict with recorded
  evidence, or the user's explicit call). A missing ledger file means no
  findings.

Do not claim "passed", "verified", or "working" without naming the command,
route, screenshot, or output that proves it. Stop before Step 1 if required
evidence is missing.

After this safety pass succeeds, set the active spec's `**Status:**` to
`verified` before archiving it when no independent receipt exists. With a
passing independent receipt, it must already be `verified`; do not rewrite it
after review. Rerun the required final checks either way because `/complete`
owns the final safety pass.

## Step 1 - log the work

Check whether the spec is a feature, fix, or rollback. A fix is marked
`Type: Fix` and has no build-plan number. A rollback is marked `Type: Rollback`
and records the exact target feature, archive, commit, and parent.

- **Feature** - archive `blueprint/context/current-feature.md` to `blueprint/history/features/NN-name.md`
  (NN is the build-plan number), and check it off in `blueprint/build-plan.md`
  (and its parent item once all sub-items are checked). Then recompute the
  overview fingerprint using `/overview`'s checkbox-normalized hash contract and
  replace only the existing `blueprint:source-hash` value. Do not regenerate or
  rewrite the overview body. This keeps completion progress from looking like
  plan drift and migrates older exact-byte fingerprints.
- **Fix** - archive it to `blueprint/history/fixes/name.md`. A fix isn't a build-plan item, so
  there's nothing to check off.
- **Rollback** - archive it to
  `blueprint/history/rollbacks/YYYY-MM-DD-NN-name.md`, preserving the original
  completed feature archive. Create `blueprint/history/rollbacks/` first if an
  older Blueprint installation does not have it yet. Uncheck the exact target item in
  `blueprint/build-plan.md` and its parent when applicable, then append a concise
  note to the target line with the rollback date and archive path. Keep the
  feature number stable. If the user later decides the feature is permanently
  abandoned rather than pending rebuild, that roadmap decision is a separate
  plan edit.

**Write the walkthrough record.** Standard for every completion, alongside the
archived spec - never gated on the user asking for it separately. Append a
`## Implementation walkthrough` section to the archive file just written:
a short narrative pass through what was actually built, organized by file/area
(matching the style of an existing archive under `blueprint/history/features/`
when one exists), noting non-obvious decisions made during implementation.
Then render the full archive file (spec plus the walkthrough section just
appended) to a matching PDF in the same folder, next to the archive file (same
base name, `-walkthrough.pdf` suffix - for example
`blueprint/history/features/03-photo-upload-walkthrough.pdf`), using:

```text
node .claude/skills/complete/scripts/md-to-pdf.mjs <archive.md> <output.pdf> "<title>"
```

That script does its own markdown->HTML conversion and prints via a local
headless Chrome or Edge (set `CHROME_PATH` if neither is at its default
install location) - no new dependency to install. Read the PDF back after
generating it to confirm it rendered correctly before calling this step done.

**Archive resolved findings.** If `blueprint/context/findings.md` holds any
findings, append a `## Findings` section to the archive file just written with
every `closed`, `accepted`, or `invalid` entry at its final status (`accepted`
entries keep their recorded reason). Prefix each ID with the archive name for
global uniqueness: feature 12's `F-03` becomes `12/F-03`; fixes and rollbacks
use their archive filename as the prefix. An entry carried forward from earlier
work archives with the item that resolved it; its **Found** line preserves
where it came from. Only `closed`, `accepted`, and `invalid` entries are
resolved for archival. A `fixed` entry is not resolved at any severity: never
append it to the archive or remove it from the live ledger.

Then remove only the archived entries from the ledger. Entries with `open`,
`fixed`, or `unverified` status stay in the ledger with their IDs so they are
never silently dropped. A fixed P2/P3 finding does not block completion, but it
must remain verbatim for a later `/audit` re-review. When no `open`, `fixed`, or
`unverified` entries remain, reset the ledger to exactly this stub, and create it the
same way if the file is missing (an older install):

    # Findings

    > **Generated file.** The findings ledger: review findings raised by `/audit`
    > against the work in progress, each with a durable ID, severity (P0-P3), and
    > status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
    > moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
    > finding is `open` or `fixed`, then archives resolved findings with the work
    > and resets this file.

    _No findings recorded. `/audit` appends findings here when it finds them._

**Archive independent review.** When a current `passed` receipt exists, append
a `## Independent review` section to the archive file with the receipt fields,
commands, safe evidence references, findings, and remaining risk from
`blueprint/context/review.md`. Preserve the full target and base SHAs, spec
hash, base ref, builder adapter and model, requested reviewer and model, actual
reviewer adapter and model, Check result, fresh-session declaration, and review
time. Do not archive a stale, pending, changes-requested, or malformed record.

Then reset `blueprint/context/review.md` to exactly this stub, creating it when
an older installation does not have it:

    # Independent Review

    > **Generated file.** Holds the active independent-review request or latest
    > receipt for the current work item. `/audit independent current` prepares a
    > handoff against an approved checkpoint, a fresh reviewer session completes it,
    > and `/complete` refuses stale, pending, or changes-requested review state.

    _No independent review requested. Run `/audit independent current` to prepare one._

Keep every unresolved entry in the ledger. Do not replace it with the empty stub
while it still contains any open, fixed, or unverified finding. After archiving
resolved findings, replace `blueprint/context/current-feature.md` with
the canonical stub below. Do not paraphrase it or substitute an abbreviated "no
work" stub. Before committing, read the file and confirm it exactly matches:

    # Current Feature

    > **Generated file.** Holds the one feature, fix, or rollback being built right now. Run
    > `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
    > an ad-hoc fix. Use `/rollback <completed-feature>` to plan a safe reversal.
    > Build one thing at a time; `/complete` archives it under
    > `blueprint/history/` and resets this file.

    _Nothing in progress. Run `/feature`, `/fix`, or `/rollback` to start._

When no open, fixed, or unverified ledger entries remain, confirm
`blueprint/context/findings.md` exactly matches the canonical Findings stub
above. Otherwise, preserve the remaining entries without rewriting them.
Confirm `blueprint/context/review.md` exactly matches the canonical Independent
Review stub above.

Don't commit yet; the next step makes one work commit covering the code and these
documentation changes. The archive is the build history.

**Discard consumed prototypes.** If this feature built the look from `prototypes/`
- its Design reference pointed there and an early step ported `prototypes/theme.css`
into the app - delete the `prototypes/` folder now. The tokens live in the real
stylesheet and the HTML mockups were always throwaway; fold the deletion into this
feature's commit. Skip this if the feature didn't consume prototypes.

## Step 1b - publish the build log

Before the commit, not after. In `blueprint/context/project-log.html`: close
this feature's group off, with every step box ticked, all three gates passed,
the status pill moved to done, and a final timeline entry naming what shipped.
Flip the item to `done` in the roadmap view and update its three counts.
Republish to the URL in the project's `AGENTS.md`, passing it as `url`.

The republished file is part of this feature's commit in Step 2, so the repo
source and the live page never disagree. A commit that closes a feature while
the page still shows it in progress is the rule in `AGENTS.md` already broken.

## Step 2 - make the work commit

Stage everything on the branch (any uncommitted step work plus the Step 1 logging
changes and the Step 1b republished page) and make one conventional work commit
(for example `feat: <feature>`, `fix: <name>`, or `revert: roll back <feature>`).
`Verify`, or the fallback build and tests, must pass first.

## Step 3 - merge

The merge happens on the local machine, and GitHub receives it by push. GitHub
never merges on its own, so the laptop and GitHub stay a mirror.

1. Push the work branch so GitHub holds the Step 2 commit.
2. Ask one question that names every action: merge `<branch>` into `main`, tag
   it, and push `main` and the tag. Do nothing below without an explicit yes to
   that question in the current chat.
3. Switch to `main`. When it has an upstream, pull with `--ff-only` first; stop
   and report if it cannot fast-forward.
4. Merge with a merge commit, never a squash:
   `git merge --no-ff <branch> -m "<type>: <title>"`. Every step commit stays
   in `main`'s history; `git log --first-parent main` still reads as one line
   per work item.
5. For a feature, tag the merge `item-NN-done` with an annotated tag, NN being
   the build-plan number. Fixes and rollbacks are not tagged.
6. Push `main` and the tag. If the repo has no remote or upstream, say so
   loudly: the work then exists on this machine only.
7. Keep the branch. Never delete it.
8. Report a sync line for `main` and the work branch, comparing the local and
   remote commit for each (`git rev-parse <ref>` against `git ls-remote origin
   <ref>`), and say which side is ahead when they differ.

Then point the user at `/feature`, `/fix`, or `/rollback` for the next thing.

Finish with a concise **How to try it** note for the completed work. For a
rollback, explain how to confirm the removed behavior is gone and name one
unaffected regression path. If the
manual path is more than a couple of steps, tell the user to run `/try latest`;
that command can read the archived feature after `current-feature.md` is reset.

## Rules

- The work item is the unit of history: one merge commit on main per feature,
  fix, or rollback, with every step commit kept beneath it. Never squash, and
  never delete the branch.
- A rollback preserves the original feature archive and adds a separate rollback
  archive. Never rewrite history to make the feature look as if it never existed.
- Don't merge unfinished or failing work. The documented `Verify` command, or
  the fallback build and tests, must pass first.
- Never merge while a P0 or P1 finding is `open` or `fixed` in the ledger. The
  recorded ways past the gate without code are `accepted` (only by the user's
  explicit decision, with their reason) or `invalid` (only from re-examination
  evidence or the user's explicit call); both travel into the archive, never a
  silent drop.
- Never merge with a required or explicitly initiated independent review that
  is missing, pending, changes-requested, malformed, or stale. The user may
  explicitly cancel a manual review before completion, but the agent never
  resets or waives it on the user's behalf.
- Merging and pushing are the user's calls. The Step 3 question names the
  merge, the tag and the push together, so one explicit yes to it covers all
  three. Do not treat `/complete`, "looks good", or a yes to a question that did
  not name the push as permission to push.
- One item per completion. If a parent feature still has unchecked sub-features,
  leave the parent unchecked.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
