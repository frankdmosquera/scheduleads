# Feature: A client's whole site follows its Look colours

**From build-plan:** feature 25f

**Size:** light - one small piece of logic (three colours become a site's shades) plus wiring in one site; no stored data, no new route, no money or security rule.

**Status:** verified

**Branch:** feature/25f-a-client-s-whole-site-follows-its-look-colours (cut from `chore/face-and-body-photos`, so Face and Body's 37 new photos ride on it)

## Goal

A business recolours its whole website from Booking CRM's Settings > Look, with no rebuild and no
limit. The booking package gives any site its business's saved colours; the site re-reads them
every minute, its pages stay static, and its own shades are worked out from the three. A business
that saved none keeps the site's own colours. Every site built from now on carries it; Face and
Body is the first.

## In scope

- **Booking package** (`packages/booking-component`, this repo): two new exports for a site's
  server code.
  - `fetchSiteColours(apiUrl, slug, init?)`: reads the business's `theme` from the existing public
    route `GET /public/:slug/booking-links`; `init` is passed to `fetch` so the site sets its own
    caching (Next's `{ next: { revalidate: 60 } }`). Any failure (network, time limit, non-200,
    missing or malformed `theme`) answers `null`, never throws: a site must always draw.
  - `siteColourTokens(theme)`: the theme as generic CSS custom properties every site maps onto its
    own tokens: `--site-main`, `--site-main-ink` (text on the main colour), `--site-main-text` (a
    shade of the main colour that reads at 4.5 on the background), `--site-bg`, `--site-text`.
    A `null` theme or one with no colour answers `{}`. Uses the same `readableOn` / `textColorOn`
    helpers the window's `theme-style.ts` already uses, so the site and the window agree.
  - The `index.ts` header says how a site wires it (layout, revalidate, the CSS mapping).
  - Package version bumped and packed into Face and Body with `pack:site`.
- **Face and Body's site** (`../face-and-body`, its own branch `chore/site-follows-look-colours`):
  - `app/layout.tsx` (server) calls `fetchSiteColours(BOOKING_API_URL, BOOKING_SLUG, ...)` with a
    one-minute revalidate and sets `siteColourTokens(...)` on `<html>`, plus `data-site-colours`
    when there are any.
  - `app/globals.css`: under `:root[data-site-colours]` her tokens follow the `--site-*` ones:
    copper and its hover, soft, tint, ink and text shades from `--site-main`; cream, surface, sand,
    line, placeholder from `--site-bg` mixed with `--site-text`; ink, muted, faint, dark and
    on-dark from `--site-text` and `--site-bg` (`color-mix`, as the window's own tokens are mixed).
  - The Copper / Gold / Espresso preview goes: `LookSwitch.tsx`, its boot script in the layout and
    the `data-look` blocks in `globals.css`. `DesignPicker` (layout options) stays: out of scope.
- **Face and Body's live photos**: the 37 photos already on ImageKit and in her setup file are
  written to her live business through the tunnel Frank opens.

- **Amended Oct 29, after Frank saw the laptop site (step 25f.1 reopened):** rebuilding every
  shade from three colours changed her hand-picked ones (sand, borders, soft copper) and put a
  navy button text that was never hers. So: her three hand-made looks (copper, gold, espresso)
  stay in her stylesheet shade for shade; when her saved main colour is one of theirs, her site
  shows that look exactly and sets no `--site-*` token; any other colour is worked out as before.
  The text on the main colour is chosen from the site's own light and dark
  (`siteColourTokens(theme, { light, dark })`), never a colour of the package's. Window 0.2.7.
  Her looks are not yet palettes on her Look page: she picks one by typing its main colour
  (copper `#c0704f`, gold `#8f6f3a`, espresso `#2b2522`), named in the report.

## Out of scope

- Fonts, corners, logo or photos on the site from the CRM.
- A site's dark mode.
- Any change to the Look page, the window, the emails or the API.
- Other client sites (IA a la Orden next time it is touched; new sites get it when built).
- A separate dashboard for clients who buy a site alone (Frank: a different story).

## Build loop

Light: one step. After Frank's yes on this plan the step runs straight through: build, its check,
tick, build log, commit and push both repos' branches, report. No step review; the independent
review comes at `/complete`. Merging either repo is Frank's call.

## Build steps

- [x] **25f.1 Her whole site follows her Look colours.** (reopened and rebuilt Oct 29, see the amendment) Read Next 16's caching guide in
  `../face-and-body/node_modules/next/dist/docs/` first and use what it says for a fetch revalidated
  every minute (the site has `cacheComponents` off unless its config says otherwise). Add the two
  package exports with tests, bump the version, pack into her site, wire her layout and CSS, remove
  the preview switch. Write the live photos once Frank opens the tunnel.
  **Done when:** on the laptop (API 3401, her site 3402, dashboard 3400), saving gold colours for
  Face and Body on Settings > Look recolours her whole site within a minute with no rebuild;
  turning her colours off shows her copper; with the API stopped her site still draws in copper;
  `npm run build` in her site passes and lists her pages as static, not dynamic; the package's
  tests and build pass; her live booking window shows 37 different photos.

- [x] **25f.2 Her looks as one-click choices, and the window wearing them exactly** (added Oct 29,
  Frank's yes). A business's own looks (name, main, background, text and the ink its site puts on
  the main colour; at most six, names unique) live in `organization.looks` (jsonb, migration 0039),
  set from its setup file while it has none. Settings > Look shows them first ("Your website's
  looks"); Save sends the look's name, and the API keeps that look's ink in
  `organization.mainInkColor` only when all three colours are the look's own, clearing it on any
  other save. The public theme's `mainInk` is that ink, else worked out; the window (0.2.8) and
  every email button use it. Face and Body: copper, gold, espresso, sage, each with her cream.
  Out of this step, named: the dashboard's highlight and the customer's booking page still work
  their button text out. Live needs migration 0039 and her setup file applied, at merge.
  **Done when:** her laptop window's buttons carry her cream on copper; the Look page shows her
  looks and a pick fills the three colours; a look's ink is kept only for its own colours (route
  test); backend, shared and package suites and the dashboard build pass.

## Files / areas

- `packages/booking-component/api-client/fetch-site-colours.ts` (new), its test
- `packages/booking-component/site-colours/site-colour-tokens.ts` (new), its test
- `packages/booking-component/site-colours.ts` (new entry, `@frankdmosquera/booking-component/site-colours`,
  never "use client": changed in 25f.1 from the planned `index.ts` exports, which are all client),
  `tsdown.config.ts`, `check-dist-imports.mjs`, `package.json` (0.2.6, the new export)
- `../face-and-body/app/layout.tsx`, `app/globals.css`, `components/theme/LookSwitch.tsx` (deleted),
  `vendor/` and `package.json` (the packed window)

## Data / contracts

- Source: the public route's existing `business.theme`, `{ main, mainInk, background, text }`, hex
  strings or null each; the whole `theme` is `null` when the business has not turned its colours on
  (`coloursOn`). No new route, field or migration.
- `fetchSiteColours(apiUrl: string, slug: string, init?: RequestInit): Promise<SiteThemeType | null>`.
- `siteColourTokens(theme: SiteThemeType | null): Record<\`--site-${string}\`, string>`; only the
  tokens it can fill are returned (no background saved: no `--site-bg`), and the site's CSS keeps
  its own value for any token that is missing.
- Rendering: colours come only from the API's hex values, validated as `#rrggbb` before they reach
  a `style` attribute; anything else is dropped.

## Testing

- Package unit tests (Vitest, beside the code): no theme gives `{}`; a full theme gives all five
  tokens; `--site-main-text` reads at 4.5 or better on the background; a value that is not
  `#rrggbb` is dropped; `fetchSiteColours` answers `null` on a non-200, a thrown fetch and a body
  without `theme`.
- The Done-when check above, by hand on the laptop, with screenshots.

## Notes for the AI

- Her site's Next.js is 16: read its own docs before writing the fetch (workspace rule).
- `fetch`'s `next` option is not in the DOM `RequestInit` type; the site passes it, the package
  only forwards `init`.
- The live photo write: `DATABASE_URL=<the commented 5433 line> LIVE_OK=1 node set-photos.cjs
  imagekit` from the session scratchpad, after Frank opens the tunnel.
- Stage exact paths only; `.env.example` is Frank's own uncommitted edit.

## Implementation walkthrough

**What the spec's top lines miss (F-584).** The spec was written for 25f.1 alone ("no stored data, no new route, no migration, no change to the Look page, window, emails or API"). Step 25f.2, added on Frank's yes the same day, changed all of those: read this walkthrough and the 25f.2 step as the record.

**25f.1 Her whole site follows her Look colours.** The booking package (`packages/booking-component`) gained a second entry, `@frankdmosquera/booking-component/site-colours`, never marked "use client" (the main entry is, so a server layout could not have called it): `fetchSiteColours(apiUrl, slug, init)` reads the business's `theme` from the existing public booking-links route and answers null on any failure, and `siteColourTokens(theme, { light, dark })` turns it into `--site-main`, `--site-main-ink`, `--site-main-text`, `--site-bg` and `--site-text`, dropping anything that is not `#rrggbb` and taking the text on the main colour from the site's own light or dark. `tsdown.config.ts` builds both entries and puts the banner on `index` only; `check-dist-imports.mjs` accepts the chunk the two share and fails if `site-colours.js` is ever marked client. Face and Body's `app/layout.tsx` reads the theme with `{ next: { revalidate: 60 } }` (Next 16 without Cache Components: pages stay static, refreshed at most once a minute on the next visit). Her three hand-made looks stay in `app/globals.css` shade for shade and are picked by their main colour (`data-look`); any other colour sets the tokens and `data-site-colours="main bg text"`, and her CSS works her shades out of the ones saved. Her Copper / Gold / Espresso preview switch (`LookSwitch.tsx`) is gone. The first build worked every shade out of three colours even for her own copper; Frank saw her shades drift and a navy button text, and the step was rebuilt the same day.

**25f.2 Her looks as one-click choices.** Migration 0039 adds `organization.looks` (jsonb, default `[]`; name, main, background, text and ink, at most six, names unique, `business-looks-validation-schema.ts`) and `organization.mainInkColor` (checked `#rrggbb`). The setup file's `look.looks` fills them while the business has none, and keeps the worn look's ink while none is kept. Settings > Look shows "Your website's looks" above the palettes (`colours-card.tsx`); Save sends the look's name, and `save-business-colours.ts` keeps that look's ink only when the name and all three colours are the business's own, in a transaction with the row locked, clearing it on any other save. `publicThemeOf` answers that ink as `mainInk`, else works it out; the window (0.2.8, `theme-style.ts`) and every email button (`email-button.tsx` and seven templates, through `brandInk`) use it. Face and Body's looks: Copper, Gold, Espresso and Sage, each with her cream `#fffdf9`.

**Also on this branch.** Face and Body's 37 services each got their own free Pexels photo, matched to the treatment, put in ImageKit at 800 px and written to her live business through the tunnel (port 5434: a dead tunnel held 5433) on Oct 29, before the merge.

**Proof.** Shared 231 tests, backend 1121, package 121; the dashboard's build; her site's build (every page static, revalidate 1m) and lint. On the laptop: her built site went gold 52 seconds after gold was saved and back to copper 62 seconds after her colours went off, and stayed up in copper with the API stopped; saved gold showed all nine of her gold shades exactly; a sage no look used was worked out with her cream on the buttons; her window's Next button is copper with her cream; the Look page showed her four looks and Sage filled its three colours. Live: 37 services, 37 different photos.

**Reviewed.** One independent review of the whole feature, both repos (fresh subagent): passed, F-583 and F-584 (both P3) carried. Named for later: the dashboard's highlight and the customer's booking page still work their button text out; the first click on /book does nothing until the page is ready; a business picks its site's built-in design choices (heroes, sections) from its dashboard (build plan, Named).

## Findings

No finding was resolved in this feature. Raised and carried in the live ledger: F-583 (P3, a setup file's looks and ink untested, ink matched against the file's looks), F-584 (P3, the spec's top lines describe 25f.1 only).

## Independent review

**Status:** passed
**Target commit:** 246c5dada82a6e63368d73178348918a83ac3c89
**Base commit:** 846d93e9a792abfbbda7b2742f0148e3c6f38168
**Base ref:** main
**Spec hash:** 6c70c99ea3d529f4e4b00b20f5b536c9a5379e7d7be94f09cc21cc39e24db0cd
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-29T03:40:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-29T02:56:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `846d93e9a792abfbbda7b2742f0148e3c6f38168..246c5dada82a6e63368d73178348918a83ac3c89`
delta in a fresh session or isolated subagent without the builder conversation. Run all Audit
lenses from scratch. Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope. The feature also changed Face and Body's site in
its own repo (`../face-and-body`, `main..chore/site-follows-look-colours`, 36d4079..9199d7b):
review that delta as part of the same feature.

### Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (37 files, 231 tests, Spanish message suite included)
- `npm run test --workspace=backend`: pass (1121 tests, local scheduleads_dev only)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (22 files, 121 tests; builds dist and runs check-dist-imports first)
- `npm run build --workspace=frontend`: pass (typed client accepts the new `look` field; 19 static pages)

### Evidence

- HEAD = 246c5dada82a6e63368d73178348918a83ac3c89; merge-base(main, HEAD) = 846d93e9a792abfbbda7b2742f0148e3c6f38168; spec SHA-256 matches; only review.md and findings.md differ from the target.
- Whole delta read: backend (save-business-colours, settings route, public theme and route, find-look-settings, email button and seven templates, pass-on-reply), shared (organization table, migration 0039 and journal, looks/colours schemas, setup schema and apply-business-shape, Spanish messages, Face and Body setup file), frontend (colours card, look screen, api client, words), booking package (site-colours entry, fetchSiteColours, siteColourTokens, theme-style ink, tsdown banner, check-dist-imports, version 0.2.8).
- face-and-body 36d4079..9199d7b read: app/layout.tsx, app/globals.css, DesignPicker comment, LookSwitch removed, package.json/lockfile point at the 0.2.8 tgz (tgz itself not unpacked).
- Security: the save route is behind organization, subscription, booking-module and CHANGE_BUSINESS middleware and takes organizationId from the session; the ink is only ever copied from the business's own stored looks when name and all three colours match exactly, inside a transaction with `select ... for update`, and the column has a `^#[0-9a-f]{6}$` CHECK, so a client cannot store an arbitrary ink. The public route returns only the computed theme (`looks` and the raw column are not exposed). On the site, `style` gets only `siteColourTokens` output (hex-validated), `data-site-colours` and `data-look` only fixed words.
- Migration 0039: constant-default jsonb ADD COLUMN, nullable text column, CHECK passes on existing NULLs; no rewrite of the (small) organization table.
- Performance: fetchSiteColours reuses the public booking-links read (10-second time limit from the shared client) once a minute per site through Next's revalidate; no new hot-path work in the API.

### Findings

- F-583 (P3, open), F-584 (P3, open)

### Remaining risk

- Face and Body's own `next build` (pages static, not dynamic, with the async layout) was not rerun here: this reviewer may not write to that repo. The builder's Done-when names it.
- The site's colour change within a minute, the API-down fallback and the dashboard's look buttons were not exercised in a browser; Check was not required.
- The site reads the whole public booking-links payload to get four colours; fine at one read a minute, unmeasured.
