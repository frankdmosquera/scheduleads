# Feature: Tenant zero ready: AgentsWeb

**From build-plan:** feature 10

**Branch:** `feature/10-tenant-zero-ready-agentsweb`

**Size:** light, decided 2026-10-10: settings, packaging and one small command; the rest of
the feature runs as one step, reviewed once at `/complete` (`AGENTS.md`, "Each feature is heavy
or light").

**Status:** verified 2026-10-10: every step built (10.3 and 10.4 as one); backend 887, shared 172 and booking component 76 tests pass, the frontend builds.

## Goal

The agency's own business, AgentsWeb, can take real bookings through
Scheduleads, and any website, in any repo, can install the booking window built
in feature 9 as one shared package. When this feature is done, the agency
business exists with its services, hours and questions, the package is
published privately and proved to install outside this repo, and a real call is
booked into AgentsWeb through that window on the laptop.

Wiring the agency site's own pages (installing the package, its Book a call
card opening the window) is the agency site's own item 12, in
`agency-site-app`, built in a session opened there. The first production deploy
is its own item, 10b.

## Decisions

Settled with Frank on 2026-10-09, while planning this feature.

1. **Every site installs the booking window as one shared package** (the
   library way, like `zod`), built into the site's own files when the site is
   built. Never a widget, an embed, an iframe or a script loaded on a visit:
   the only thing fetched on demand is data (free times, the booking).
   Rejected: a copy pasted into each site (a fix pasted into every site again)
   and any third-party style embed (slow, and the reason Frank wants his own).
   The look stays each site's: its colours, font and corners are its own
   `--sa-*` tokens (feature 9), and the logo, name, phone, services and
   questions come from the CRM while the customer books. Colours set from the
   CRM are Settings, feature 12 (feature 9's design review).
2. **A business is set up from a setup file, run once by a command**, until
   Settings (feature 12) exists. The file describes the business's services,
   people, hours and questions in the shape the dev seed already uses; the
   command writes what is missing and never changes or deletes what is there.
   Rejected: building part of Settings before this feature (a large piece of
   feature 12 pulled forward, holding the agency back). This is the build
   plan's "decide here" for item 10.
3. **Feature 10 ends on the laptop; the first deploy is its own item, 10b.**
   Railway and Vercel are provisioned but nothing has gone out for real use,
   and the agency site's own launch waits on texts and QuickBooks. Rejected:
   deploying inside this feature (a live API nobody can use yet, and Railway
   and real data deserve their own reviewed item).
4. **Split by repo.** This feature does everything Scheduleads owns. The
   agency site's item 12 does the site side, in its own repo, with its own
   branch, reviews and build log; its plan line "real free times behind our
   booking window" changes there to the shared window (decision 1).
   Rejected: one feature reaching across both repos from here.
5. **The package is published to GitHub Packages, privately**, under the
   account's scope, `@frankdmosquera/booking-component`: GitHub Packages
   requires the scope to be the owner's name, every repo here is already on
   that account, and it keeps the package private. The standard way for a
   private package from a monorepo. Rejected: a git dependency (npm cannot
   install one folder of a repo), a tarball copied into each site (the paste
   way again), and the public npm registry (private code). Each site installs
   it with a read token from the environment; its `.npmrc` names the
   variable, never the token. Amended 2026-10-09 at step 10.2 (Frank): the
   first publish waits until a site needs to install from GitHub (the agency
   site's item 12, or 10b at the latest). Granting `gh` the packages
   permission through the device login failed twice, and the point of 10.2,
   that the package installs with nothing from this repo, is proved by a
   packed file instead.
6. **The published package carries everything it needs.** Today it reads five
   small helpers and the booking schema from `@scheduleads-app/shared` and its
   route types from `backend/app-type`, neither of which leaves this repo. The
   build bundles that code into the package's own JavaScript and its route
   types into its own declarations, using `tsdown`, the standard bundler for a
   TypeScript library (a dev dependency: installed only on Frank's yes at step
   10.1). Amended 2026-10-09 before 10.1: the spec first named `tsup`, whose
   own npm page now says it is no longer maintained and points to `tsdown`,
   its successor (0.23.0, September 2026). Rejected: publishing `@scheduleads-app/shared` as well (it carries
   the database schema and Drizzle, which no website should install) and
   copying the helpers into the package by hand (two copies that drift).

## In scope

- The plans: item 10 rewritten to these decisions, item 10b (the first deploy)
  added, the overview's lines for both and its fingerprint refreshed.
- The package renamed, bundled so it needs nothing from this repo, published
  privately, and proved to install and typecheck from a folder outside it.
- The setup file's schema and the command that applies it, sharing the dev
  seed's code for describing a business, so there is one way to bring a
  business to its described shape.
- AgentsWeb set up on the local database: made through the existing client
  setup screen, then its setup file applied.
- `WIDGET_ORIGINS` allowing the agency site's local address, so item 12 there
  can call the API from its dev server.

## Out of scope

- Any change in `agency-site-app`, including its plan: its item 12, in a
  session opened there.
- Deploying anything, Railway or Vercel, and running the command against a
  live database: item 10b.
- Settings screens, and the owner changing anything the file set: feature 12.
- A visit (Frank going to a business in a city): the agency site's own flow;
  this feature books calls only.
- Text messages for AgentsWeb: it has no Twilio number, so no text settings.

## Build loop

`workflow.stepReview` is `every` and `checkpointCommits` is `enabled`.

**After the green light, nothing stops until the review.** Each step's plan
gets Frank's yes just before it is built. From that yes the step runs straight
through: build, tests and checks, tick the box, the build log entry, commit and
push to `feature/10-tenant-zero-ready-agentsweb`, `/audit` scoped to the step,
the independent review. The planned stop is after the review, where the
findings are talked through. Earlier stops only for: the agreed plan proving
wrong, a line only Frank crosses (a package install, publishing the package,
Railway or real data, `main`, a merge, a force push, deleting anything), or
blocking findings left unfixed. Steps 10.1 and 10.2 each hold one such line,
named in the step.

## Build steps

- [x] **10.1 The package needs nothing from this repo.**
  Plans: build-plan item 10 rewritten to decisions 1 to 4 ("Tenant zero ready:
  AgentsWeb"), item 10b added after it ("First deploy": the API and the
  dashboard out on Railway and Vercel, the first-deploy checks F-176, F-179,
  `X-Real-IP` and `NODE_ENV=production`, the setup file applied to the live
  database, timed with the agency site's launch), the overview's item lines and
  tenants line updated and its fingerprint recomputed.
  Package: renamed `@frankdmosquera/booking-component` (the preview page's
  import follows); `tsdown` installed as its dev dependency on Frank's yes;
  its build bundles the shared helpers and the booking schema into `dist/`
  and inlines `PublicAppType`'s declarations into `dist/index.d.ts`, keeping
  `"use client"` at the top of the client entry; `react` and `react-dom` stay
  peer dependencies, `hono` and `zod` become its runtime dependencies,
  `@scheduleads-app/shared` and `backend` build-time only. `private` comes off,
  `publishConfig` names the GitHub Packages registry, version `0.1.0`.
  A test reads every file in `dist/` and fails on any import outside an
  allow-list: `react`, `react-dom`, `hono` and `zod` (and their subpaths), so a
  database or Drizzle type dragged in by the route types fails it too. If the
  route types cannot be carried without such an import, the step stops and
  says so before going on.
  Amended at build (2026-10-09): the allow-list check is the build's last
  step, `check-dist-imports.mjs`, not a Vitest test. A Vitest test reading
  files needs Node's type definitions, which this browser package does not
  declare; as a build step a leak can never be built, and the tests build
  first. It reads every built file at any depth, triple-slash references
  included, and checks the "use client" first line. The build type-checks the
  package with its tests first (the old `tsc` build was its only check), and
  `prepublishOnly` rebuilds before any publish. Shared's files are marked
  free of side effects for the bundle, so schemas the window never uses are
  left out.
  **Done when:** the package builds; that check passes and is shown able to
  fail (an import put back); the package's 76 tests pass; the frontend builds
  and the booking preview page still opens the window on clinic-dev; suites
  pass.

- [x] **10.2 Ready to publish, and installed from outside this repo.**
  `npm publish` of `0.1.0` to GitHub Packages, on Frank's yes at that moment
  (publishing; the `gh` token needs the `write:packages` scope, which Frank
  grants with `gh auth refresh -s write:packages` if it is missing). Then, in a
  throwaway folder outside both repos, on Frank's yes: an `.npmrc` pointing the
  scope at GitHub Packages with the token from the environment, an install of
  the package with React, and a TypeScript file that imports
  `BookingProvider`, `useBooking` and `BookNowTrigger` and the CSS path, which
  typechecks with no reference to this repo. The folder is deleted after.
  How a site installs it (the `.npmrc` line, the token as an environment
  variable, the CSS import, the `--sa-*` tokens, wrapping the layout in
  `BookingProvider`) goes into the package's `index.ts` header and the
  Commands in `AGENTS.md`, beside the publish command, so the agency site's
  session finds it.
  Amended at build (2026-10-09, Frank): no publish in this step. The
  device login that grants `gh` the packages permission failed twice, so the
  throwaway folder installs the package from a file made by `npm pack`, which
  is exactly what a publish would send. The package is linked to the private
  repo (`repository`), `publish.npmrc` and the publish command are ready, and
  a dry run of the publish lists the four files it would send. The first real
  publish is done when a site first needs it from GitHub.
  **Done when:** the publish dry run lists only the CSS, `dist/index.js`,
  `dist/index.d.ts` and `package.json`; the throwaway install from the packed
  file, its strict typecheck and a Node import pass, with output recorded;
  `AGENTS.md` names the publish and install commands.

- [x] **10.3 The setup file and its command, AgentsWeb set up, and a real call booked.**
  Amended 2026-10-10 (Frank, the feature is light): the spec's 10.3 and 10.4 are built as
  this one step, reviewed at `/complete`. The shared function lives in
  `packages/shared/client-setup/` (compiled, so the seed and the command import the same
  code); a dry run runs the apply and rolls it back, so it reports exactly what an apply would
  add. AgentsWeb asks no booking questions: the card asks only a name and an email or phone,
  which the window asks itself. Its notice is 0 minutes (the card sets none).
  Found while booking: the window always asks for an address and "What would you like done?",
  which a call does not need (raised with Frank).
  Shared: a setup file's schema (Zod) in the seed's existing business shape:
  the business's slug, time zone, weekly hours, horizon, questions, people,
  services (name, duration, buffers, description, layout, who picks, step) and
  who does what, each field required where the seed's is, with no defaults
  invented for a business. The seed's code that brings a business to its
  described shape moves into one function both the seed and the command call,
  so their rules cannot drift.
  The command, `npm run client:setup --workspace=@scheduleads-app/shared --
  <file>`: reads and checks the file, finds the business by slug (made first
  by the client setup screen; a missing business is refused, never made), and
  prints what it would add. Nothing is written without `--apply`. It adds only
  what is missing, never changes or deletes an existing row, and lists every
  difference between the file and the database so a hand edit is seen, not
  overwritten. Everything is written in one transaction. It refuses any
  database that is not local and `*_dev`, through the same guard as the seed
  (`assert-local-dev-database.ts`); opening it to the live database is item
  10b.
  **Done when:** tests on throwaway businesses show a refused file, a missing
  business refused, a dry run writing nothing, an apply making every row, a
  second apply changing nothing, a hand-changed row kept and reported, and a
  non-local database refused; the dev seed still builds both dev businesses;
  suites pass.

- [x] **10.4 Merged into 10.3 (2026-10-10).**
  AgentsWeb made on the local database through the existing client setup
  screen (`/admin/client-setup`), its owner's login and email details as that
  screen asks. Its setup file in the repo, with every value read from the
  agency site's own data and listed in this step's plan for Frank's yes:
  the services its Book a call card offers (a video call and a phone call),
  their length from the card's step, the weekdays and first and last start
  times, how far ahead, the time zone of Frank's current base, Frank as the one
  person, the business assigning him, and the questions the card asks. No text
  settings. The command applied. The root `.env` and `.env.example` list the
  agency site's local address in `WIDGET_ORIGINS`.
  **Done when:** the second apply reports nothing to add; the public routes
  answer AgentsWeb's services, questions and times in its time zone; on the
  booking preview page for AgentsWeb a call is booked, and the booking, the
  contact and the lead with its answers are in the database; a preflight from
  the agency site's local address is allowed and one from another is not;
  suites pass.

## Files / areas

- `blueprint/build-plan.md`, `blueprint/context/project-overview.md` (10.1).
- `packages/booking-component/package.json`, a new `tsdown.config.ts`, its
  `index.ts` header, a new `check-dist-imports.mjs`; `frontend/package.json` and the
  booking preview page's imports (the rename).
- `packages/shared/scripts/seed-dev.ts`, a new shared function for applying a
  business's shape, a new `packages/shared/scripts/apply-client-setup.ts`, the
  setup file schema under `packages/shared/zod-validation/`, a folder for setup
  files (`packages/shared/client-setups/`), `packages/shared/package.json`
  (the script), and their tests.
- `AGENTS.md` (Commands), `.env.example`.

## Data / contracts

- Package: `@frankdmosquera/booking-component@0.1.0` on GitHub Packages,
  private. Exports unchanged from feature 9: `BookingProvider({ apiUrl, slug,
  children })`, `useBooking()`, `BookNowTrigger`, and
  `./booking-component.css`. Peer: `react`, `react-dom` 19. Its `dist/`
  imports only `react`, `react-dom`, `hono` and `zod`.
- Setup file: a TypeScript module default-exporting one object checked by the
  setup schema; it holds no secret and no customer data. The business it names
  must already exist.
- Command result: a list of rows to add and differences found, then "applied"
  or "dry run, nothing written"; exit code non-zero on a refused file,
  database or business.
- `WIDGET_ORIGINS`: comma-separated origins, as the public CORS middleware
  reads it today.

## Testing

- Package: the build's `dist/` import check (amended at 10.1), plus feature 9's 76 Vitest tests.
- Shared (Vitest, local `scheduleads_dev`): the setup schema and the command's
  rules on throwaway businesses, removed after, refusing any non-local
  database.
- Backend: unchanged suites rerun every step.
- The install outside the repo (10.2) and the booking on the preview page
  (10.4) are checked by hand, with their output and screenshots in the step's
  log; no browser test harness exists.

## Notes for the AI

- Never edit `agency-site-app` from this feature. What its session needs is
  written in `AGENTS.md` and the package's `index.ts` header.
- The token for GitHub Packages never goes into a committed file, a log or the
  chat; `.npmrc` reads it from the environment.
- AgentsWeb's values come from the agency site's data, read at 10.4; never
  invent one. Nothing in the setup file is a default for other businesses.
- The seed and the command share one function; the seed keeps creating the
  dev logins and businesses, the command never creates a business or a login.

## Open questions

None. Decisions 1 to 4 were settled with Frank on 2026-10-09; 5 and 6 are the
standard way for 1 and are named here so the choice is visible.
