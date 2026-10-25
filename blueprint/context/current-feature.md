# Fix: Next.js security upgrade

**Type:** Fix

**Size:** light - one dependency moved to its patched release, no code change; proved by the
builds, the suites and a walk through the dashboard.

**Status:** verified

**Branch:** fix/next-security-upgrade

## The problem

On 2026-10-25 `npm audit --workspace=frontend` reported a critical advisory set against `next`
16.3.5, the version the live dashboard (app.booking-crm.com, on Vercel) runs: unauthenticated
remote code execution in the Image Optimization API when SVG files are used and in `use cache`
functions returning typed arrays (both up to 16.4.0), cache poisoning, request forgery in image
optimization, and a Server Actions denial of service. The frontend uses neither `next/image`,
`use cache` nor `next/og`, so the worst paths need parts it does not use, but the image
optimization endpoint answers on every Next.js site by default. Frank's yes to upgrade,
2026-10-25.

- `frontend/package.json`, `package-lock.json`

## The fix

Move `next` from 16.3.5 to 16.4.3, the first release past every advisory, and
`eslint-config-next` with it (they ship together). Same major version: no code change is
expected; if the build asks for one, it is made and named. Nothing else is upgraded here: the
other high warnings in the audit (zod, undici, body-parser, sharp, vite and others, across the
workspaces) are a separate point.

It must not break: the dashboard's pages, sign-in, the customer's booking page and its headers
(`next.config.ts`), and the booking window's build.

## Build steps

- [x] 1. **Next.js 16.4.3.** **Done when:** `npm audit --workspace=frontend` lists no `next`
  advisory; the frontend and backend build, lint and every suite pass; and on
  http://localhost:3400 sign-in, Leads, the Calendar, Settings (People and Services, one Save
  each) and a customer booking page at `/b/<token>` load with no console errors.

## Verify

Open app.booking-crm.com after the deploy: sign in, open Leads, the Calendar and Settings.
Vercel's build log shows Next.js 16.4.3.
