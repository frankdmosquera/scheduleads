# Fix: npm audit warnings

**Type:** Fix

**Size:** light - `npm audit fix` moves packages to their patched releases inside the ranges
`package.json` already allows, no code change; proved by the builds, the suites and a walk
through the dashboard.

**Status:** verified

**Branch:** fix/npm-audit-warnings

## The problem

After the Next.js fix (2026-10-25), `npm audit` still lists 16 warnings, 7 high and 9 moderate.
Three reach the live app: `zod` 4.6.5 (high: memory exhaustion validating oversized constrained
collections; the API validates every request with it), `hono` 4.13.8 (moderate: `serveStatic`
decodes the path twice; the API does not use `serveStatic`) and `fast-uri` (moderate, inside
`ajv` under `@hookform/resolvers` in the dashboard). The rest are laptop tools only: the
`shadcn` CLI and what it pulls in (`@modelcontextprotocol/sdk`, `body-parser`, `undici` 7,
`ip-address`), the test runner (`vitest`, `@vitest/mocker`, `vite`, `jsdom`'s `undici` 8) and
`source-map-js` in the build. Frank's yes, 2026-10-26.

- `package-lock.json`

## The fix

Run `npm audit fix` without `--force`: every warning but one has a patched release inside the
caret range already in `package.json`, so only the lockfile moves. No new package, no major
version.

Left on purpose: `drizzle-kit` and the old `esbuild` inside `@esbuild-kit` (one moderate
warning chain). npm's only offer is to move `drizzle-kit` from 0.31 back to 0.18, an old
release; the advisory is about esbuild's dev server reading responses for any website, and
drizzle-kit never runs that server.

It must not break: the API and its validation, sign-in, the dashboard's pages, the customer's
booking page, the booking window's build, and the test runs.

## Build steps

- [x] 1. **npm audit fix.** **Done when:** `npm audit` lists only the drizzle-kit chain; every
  suite (shared, backend, booking component), both builds, the booking component build, lint and
  the format check pass; and on http://localhost:3400 sign-in, Leads, the Calendar, Settings
  (People and Services, one Save each) and a customer booking page at `/b/<token>` load with no
  console errors.

## Verify

Open app.booking-crm.com after the deploy: sign in, open Leads, the Calendar and Settings, and
book once from a booking page.
