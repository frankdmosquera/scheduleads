# Independent Review

**Status:** passed
**Target commit:** ab4bdd156df06fce1551bf71a11df3c9deb5363a
**Base commit:** a0f2f86cc726bde3005eaf1b816b44ec039068ec
**Base ref:** main
**Spec hash:** 9c39247536326306e6c715945ba018adec5dca3682c2467b8eb0deaa3ad68d14
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-27T19:26:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-27T19:30:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Commands

- `npm run test --workspace=@frankdmosquera/booking-component`: pass (build first, then 19 files, 101 tests)
- `npm run build --workspace=@frankdmosquera/booking-component`: pass (dist/ imports only react, react-dom, hono, zod)
- `npm run format:check`: pass
- `npm publish --workspace=@frankdmosquera/booking-component --dry-run`: pass (npm skips the workspace as private; nothing sent)
- `npm run pack:site --workspace=@frankdmosquera/booking-component` against throwaway folders in the scratchpad (refusal paths only, deleted afterwards): pass (no argument, a folder without the window, and a different build under 0.2.2 each exit 1 with their message; nothing written)

## Evidence

- Freshness: `HEAD` is ab4bdd1, `git merge-base main HEAD` is a0f2f86, the spec's SHA-256 matches, and the only dirty paths are `blueprint/context/review.md` and the owner's excluded `.env.example`.
- The dry run's packed integrity (`sha512-leS73...uIR/eEU+MmIbg==`) equals the committed `vendor/frankdmosquera-booking-component-0.2.2.tgz` in face-and-body (8c9a68f) and agency-site-app (a1b73d0), which are byte-identical (sha256 ba3c305b...), and equals both sites' lockfile `integrity`: the build is reproducible and HEAD's build is what the sites hold.
- face-and-body 8c9a68f: `.npmrc` deleted, `package.json` and lockfile on `file:vendor/...-0.2.2.tgz` with no GitHub Packages URL, AGENTS.md install lines rewritten. agency-site-app: the same in a1b73d0 plus the AGENTS.md line in 15c714d, no `.npmrc`.
- `packages/booking-component/package.json` is `private`, has `prepack: npm run build`, no `publishConfig` or `prepublishOnly`; `publish.npmrc` is gone and no tracked file outside the spec and plans still names it, `NODE_AUTH_TOKEN` or GitHub Packages.
- Root `package-lock.json` records the workspace at 0.2.2, which repairs the lag F-530 describes (left `open` in the ledger for the builder to mark).
- `pack-into-site.mjs` imports a `.ts` file through Node's type stripping; `.node-version` pins Node 26, where that is on by default. Shell commands interpolate only the temp folder (quoted) and the package's own version.
- The decision is unit tested for the spec's three rules (folder refused for missing, unrelated and invalid package.json; same version with different bytes refused; same bytes left alone and only older packed files removed).

## Findings

- F-548 [P3] open: pack:site refuses a folder that does not use the window only after a full build and pack
- F-549 [P3] open: older packed files are deleted before the site's npm install has succeeded

## Remaining risk

- The success path of `pack:site` (copy, cleanup, `npm install` in a site) was not run by this reviewer, to avoid a package install; it rests on the unit tests and on the two site commits whose files and lockfiles match HEAD's build.
- The spec's clean-install proofs in each site (`npm ci` with an empty cache and no token, then `npm run build`) and the Vercel preview were not rerun here; the site repos were read only.
- In agency-site-app the move (`.npmrc`, `package.json`, lockfile, `vendor/`) landed inside another session's commit a1b73d0, `feat: 12c ...`, not in its own commit, so it cannot be reverted apart from that 12c work, and it goes online only when that branch merges.
- Removing `NODE_AUTH_TOKEN` from both Vercel projects, revoking the token, and a Ready production build remain Frank's, after each site's merge.
