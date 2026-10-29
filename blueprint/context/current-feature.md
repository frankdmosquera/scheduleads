# Feature: A client's whole site follows its Look colours

**From build-plan:** feature 25f

**Size:** light - one small piece of logic (three colours become a site's shades) plus wiring in one site; no stored data, no new route, no money or security rule.

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
