# Feature: A client site installs the booking window without a token

**From build-plan:** feature 25c

**Size:** light - packaging and wiring across three repos, with one small piece of logic (the
command's three refusals).

**Branch:** `feature/25c-a-client-site-installs-the-booking-window-without-a-token`

**Status:** verified

## Goal

A client site gets the booking window from a file in its own repo, not from GitHub Packages, so
its Vercel project needs no `NODE_AUTH_TOKEN` and nothing is public. One command in Booking CRM
builds the window, packs it into one file and installs that file into a site. Face and Body and
IA a la Orden move over. Why: every new client site needed Frank's GitHub token in Vercel (Face
and Body's first deploy failed on it, Oct 26).

Decided by Frank, Oct 27: option B, a packed copy committed into each site. Option A, public npm,
lost: it needs an npmjs account and puts the code and its name in public.

## In scope

- **The package** (`packages/booking-component/package.json`): `"private": true`, so no
  `npm publish` can ever send it anywhere, public npm included; `prepack` runs the whole build
  with its checks, so every packed file is a fresh, checked build; `publishConfig` and
  `prepublishOnly` go, and `publish.npmrc` is deleted. Version `0.2.2`: the package's own
  `package.json` changes, so the packed file is not the published 0.2.1.
- **The command**, `npm run pack:site --workspace=@frankdmosquera/booking-component -- <site folder>`
  (`packages/booking-component/pack-into-site.mjs`, beside `check-dist-imports.mjs`). The folder
  is read from where the command was typed (`INIT_CWD`), so `../face-and-body` works from the
  repo root. It:
  1. refuses a folder whose `package.json` does not list `@frankdmosquera/booking-component`
     (never drops a file into the wrong repo);
  2. runs `npm pack`, which builds first (`prepack`);
  3. refuses when the site's `vendor/` already holds this version's file with different bytes
     ("bump the version"): one version is always one build. The same bytes is a no-op;
  4. copies the file to `<site>/vendor/frankdmosquera-booking-component-<version>.tgz`, deletes
     the older `frankdmosquera-booking-component-*.tgz` files there, and runs
     `npm install ./vendor/<file>` in the site, which writes
     `"file:vendor/<file>"` into its `package.json` and lockfile;
  5. prints what changed and that the site's commit is the site's own. It never commits or
     pushes anywhere.
- **Face and Body** (`face-and-body`, branch `chore/booking-window-from-a-file` off its clean
  `main`): the command run on it, its `.npmrc` deleted (it held only the GitHub Packages lines),
  its `AGENTS.md` install lines (213 to 216) rewritten for the file, one commit, pushed, so
  Vercel builds a preview of it.
- **IA a la Orden** (`agency-site-app`): the same move. Its folder sits on its own open feature
  `feature/12c-our-own-cards-on-real-times` (its spec waiting on Frank, 10 commits not pushed),
  so where this commit goes is the one open question below. It moves from 0.2.0 to 0.2.2, so
  ialaorden.com also gets 0.2.1's "check your spam" line on the booked screen, in Spanish.
- **Docs here**: `AGENTS.md` Commands (the publish lines and the `gh ... write:packages` note
  become the pack command; how a site installs it), the header of
  `packages/booking-component/index.ts` (installing from the file, no `.npmrc`, no token).
- The root `package-lock.json` records 0.2.2 (closes F-530, which had it at 0.2.0).

## Out of scope

- Merging either site's branch into its `main` (a production deploy): Frank's yes, each, after
  this feature's review.
- Removing `NODE_AUTH_TOKEN` from the two Vercel projects, and revoking the classic token with
  `read:packages`: Frank's, after each site's merge; a redeploy then proves the site builds
  without it. Listed as the handover in the step report.
- Deleting the versions already on GitHub Packages: they harm nothing; deleting is Frank's call.
- Any change to the window itself.

## Build loop

One step, light. After Frank's yes on this plan, 25c.1 runs straight through: build, tests and
checks, tick the box, the build log, commit and push here and on Face and Body's branch. No step
review; the independent review comes at `/complete`. The only stops: a line only Frank crosses
(a merge, a Vercel setting, `main`), or the plan turning out wrong.

## Build steps

- [x] **25c.1 Sites install the window from a file in their own repo.** The package changes, the
  command and its tests, Face and Body moved, IA a la Orden moved (where the open question says),
  the docs.
  **Done when:**
  - Booking component tests pass, with new ones for the command's three rules: a folder without
    the window in its `package.json` refused; the same version with different bytes refused; the
    same bytes left alone and older files removed.
  - Booking component build passes; `npm publish --workspace=@frankdmosquera/booking-component
    --dry-run` refuses (private).
  - In each site, with `NODE_AUTH_TOKEN` unset and an empty npm cache
    (`npm ci --cache <empty folder>`), the install succeeds,
    `node_modules/@frankdmosquera/booking-component/package.json` says 0.2.2, and
    `npm run build` passes.
  - Face and Body's pushed branch gets a Vercel preview build that is Ready, with no `.npmrc` in
    the repo.
  - **Amended Oct 27, while building:** Face and Body's Vercel previews have never been Ready:
    `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` and `NODE_AUTH_TOKEN` are Production only, so every
    preview stops at `next build` (its feature 11 preview `3b278ea` too). The preview of
    `8c9a68f` ran with no token and installed the window, then stopped on ImageKit: that is the
    Vercel proof here. A Ready build comes with the production deploy after the merge.

## Files / areas

- `packages/booking-component/package.json`, `pack-into-site.mjs` (new) and its test,
  `publish.npmrc` (deleted), `index.ts` (header only)
- `AGENTS.md` (Commands: the booking component lines)
- `package-lock.json` (root)
- `face-and-body`: `vendor/` (new), `package.json`, `package-lock.json`, `.npmrc` (deleted),
  `AGENTS.md`
- `agency-site-app`: the same five

## Data / contracts

- File name: npm pack's own, `frankdmosquera-booking-component-<version>.tgz`, in `vendor/` at
  the site's root, committed. Only the newest one stays.
- A site's dependency: `"@frankdmosquera/booking-component": "file:vendor/<file>"`. Its lockfile
  holds the file's integrity, so Vercel's install fails loudly if the file and the lock disagree.
- What a site imports is unchanged: `BookingProvider`, `BookNowTrigger` and
  `@frankdmosquera/booking-component/booking-component.css`.

## Testing

- `npm run test --workspace=@frankdmosquera/booking-component`, with the new tests on the
  command's decision (folder check, same version check, cleanup), kept apart from the parts that
  run npm so they test without a network.
- The clean-install and build checks in each site are run by hand and written in the step's log.

## Notes for the AI

- `npm` on Windows is `npm.cmd`: start it through a shell from the script.
- A Vercel preview's state: `gh api repos/frankdmosquera/face-and-body/commits/<sha>/status`.
- Stage exact paths only, in every repo.
- Never push `agency-site-app`'s branch: its 10 unpushed commits are another session's work.

## Open questions

- **Where IA a la Orden's move is committed.** (A, recommended) on its open branch
  `feature/12c-our-own-cards-on-real-times`, as the workspace rule says small chores ride on the
  open feature branch: one commit, not pushed (its other commits are not ours), so it goes online
  when that branch merges. (B) wait until its 12c is merged, then its own
  `chore/booking-window-from-a-file` branch. Either way its Vercel proof comes after this step.
