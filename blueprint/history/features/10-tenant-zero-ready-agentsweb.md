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

## Implementation walkthrough

Feature 10 was planned as four steps and finished as three: on 2026-10-10 Frank set the rule that
each feature is heavy or light, this one was marked light, and the spec's 10.3 and 10.4 were built
as one step with a single review at `/complete`.

### packages/booking-component: a package any site installs (10.1, 10.2)

Renamed `@frankdmosquera/booking-component` and built with `tsdown`, which bundles the five shared
helpers and the booking schema into `dist/index.js` and inlines the public route types into
`dist/index.d.ts`, so a site needs nothing from this repo. `react` and `react-dom` are peers
(`^19.0.0`, so Primo's 19.0.0 installs it: F-302), `hono` and `zod` its own dependencies.
The build's last step, `check-dist-imports.mjs`, reads every built file, triple-slash references
included, and fails on any import but `react`, `react-dom`, `hono` and `zod`, and on a missing
`"use client"` first line; it is a build step rather than a Vitest test because the package
declares no Node types. The build type-checks the package with its tests first, and
`prepublishOnly` rebuilds before any publish. The package is linked to the private repo,
`publish.npmrc` and the publish command are in `AGENTS.md`, and a dry run lists exactly the CSS,
the two `dist/` files and `package.json`. The first real publish waits until a site needs it from
GitHub (decision 5, amended): the `gh` device login for the packages scope failed twice. Instead a
throwaway folder outside both repos installed the `npm pack` file, type-checked strictly and
imported it in Node. The install note names a classic token with `read:packages`, the only kind
GitHub's npm registry accepts (F-303).

### packages/shared: a business from its setup file (10.3)

`client-setup-validation-schema.ts` describes a business the way the seed already did: who picks
the person, questions, the business's hours (reusing the business hours schema, with `resourceId`
added before parsing), people and places, services and who does what. It is strict, so an unknown
field is refused, and nothing in it has a default for a business.

`client-setup/apply-business-shape.ts` is the one function that brings a business to that shape,
moved out of the seed: questions only when the business has none, its hours row only when missing,
each person or place by name, their own hours, standby dates and worker texts only when missing,
each service by slug, and only the missing who-does-what ticks. It never updates or deletes a row.
It lives in a compiled folder (`./client-setup` export) so the seed and the command import the
same built code.

`client-setup/run-client-setup.ts` finds the business by slug and refuses one that does not exist:
a business and its owner's login only ever come from `/admin/client-setup`. It reads the
differences first (business hours, questions, each service's fields, each person's kind), compared
as JSON with sorted keys because Postgres stores jsonb keys in its own order, then applies the
shape inside one transaction. A dry run is the same apply rolled back, so it reports exactly what
an apply would add. `scripts/apply-client-setup.ts` is the command: it refuses any database but a
local `*_dev` one through `assertLocalDevDatabase`, loads the file, parses it, prints what it adds
and every difference kept, and writes only with `--apply`.

The seed keeps its own work (the dev logins, businesses, email and text details, pipeline stages,
the first person's login link) and its catch-ups for databases seeded before a setting existed
(holiday picks, who picks the person), and calls the shared function for the rest.

### AgentsWeb set up and a call booked (10.3)

AgentsWeb was made on `/admin/client-setup` with test addresses on the dev database, then
`client-setups/agentsweb.ts` was applied: a video call and a phone call of 30 minutes, every 30
minutes, Monday to Friday 8:00 to 18:00 (last start 17:30), 21 days ahead, America/Bogota, the
business assigning its one person. Every value comes from the agency site's Book a call card and
its base. It asks no questions, because the card asks only a name and an email or phone, which
the window asks itself, and its notice is 0 minutes, because the card sets none. `WIDGET_ORIGINS`
lists the agency site's dev server, `http://localhost:3000`.

### Settled after the steps

- Booking a call showed the window always asks for an address (required) and "What would you
  like done?", for every business. A call needs neither. Taken out of feature 10 as its own fix,
  next: about 25 files read the booking's address, emails, calendar events and worker texts
  among them.
- The rule that sizes the process (heavy or light per feature) was written into `AGENTS.md`, the
  workflow skills and the build log guide here, and into the workspace and other projects'
  instructions.

## Findings

### 10/F-298 [P3] closed - The package carries every shared validation schema into each site, not only the booking form's

**File:** packages/booking-component/booking-window/booking-form/read-booking-form.ts:5; packages/shared/zod-validation/index.ts; packages/shared/package.json
**Found:** 2026-10-09 by independent review of step 10.1 (scope: c786f7e..17264c3; lenses: quality, security, performance, tests)
**Why it matters:** read-booking-form.ts imports `createBookingValidationSchema`
from the `@scheduleads-app/shared/zod-validation` barrel, and shared's
package.json has no `"sideEffects": false`, so tsdown keeps every module the
barrel re-exports with its top-level `z.object(...)` calls. The built
dist/index.js (lines 314 to 516, about 11 kB of its 57 kB) holds the sign-in
code schema, the client setup schema, the Resend key format, the email sending
schema, the availability rule schemas and the text settings schema; the booking
form needs only the create-booking, contact, booking-link-id and textable phone
pieces (about 3 kB). The package's own package.json has no `sideEffects` either,
so a site's bundler cannot drop them: every visitor of every client site
downloads and runs about 8 kB of admin and dashboard validation it never uses.
Nothing secret is in it (validation rules and messages), so this is size and
tidiness, not exposure.
**Suggested fix:** Mark `packages/shared` side-effect free (`"sideEffects":
false` in its package.json, after checking none of its modules relies on an
import for its effect), or import the create-booking schema through a narrow
subpath. Then confirm `emailSendingKeyValidationSchema` and the text settings
schema are gone from dist/index.js and the 76 tests still pass.
**Resolution:** Fixed 2026-10-09 in 10.1's review fixes: tsdown.config.ts marks the shared package's built files free of side effects for the bundle (`treeshake.moduleSideEffects`, matching both slash kinds, since a first try during the build matched only `/` and changed nothing on Windows). dist/index.js went from 56.98 kB (13.49 kB gzipped) to 48.55 kB (11.18 kB); the shared regions left are tel-href, the email-address, contact, booking-link-id and create-booking schemas, textable-phone-number, local-date and add-days, each used by the window. On the preview page, Book on an empty form still shows each field's own error with the focus on Name. Closed 2026-10-09 by re-review of 10.1's fixes (scope: e9e21d0..7cad72a): the rebuilt dist/index.js is 48.55 kB (11.18 kB gzipped) and its only shared regions are tel-href, email-address, contact, booking-link-id, textable-phone-number, create-booking, local-date and add-days; no sign-in code, client setup, sending key, text settings or weekly hours schema is left. No shared source module has a top-level statement other than a declaration, and none calls .meta, .register or z.config, so marking shared's files side-effect free drops nothing the window needs; the bundle loads in Node (exports BookNowTrigger, BookingProvider, useBooking), the 76 tests pass and the frontend builds against it. The regex matches the resolved Windows path, as the drop in size shows.

### 10/F-299 [P3] closed - The allow-list became a build check, but the spec and tsdown.config.ts still name a test

**File:** packages/booking-component/tsdown.config.ts:4; blueprint/context/current-feature.md:7, 131-137, 205, 232
**Found:** 2026-10-09 by independent review of step 10.1 (scope: c786f7e..17264c3; lenses: quality, security, performance, tests)
**Why it matters:** Step 10.1 and Testing say "a test reads every file in
dist/" and "Package (Vitest): the new dist/ import allow-list test, plus
feature 9's 76", and Files / areas lists "a new test over dist/". What was
built is `check-dist-imports.mjs`, the last command of the package's build
(which `pretest` runs, so `npm test` still enforces it); the suite is 76 tests,
not 77. The spec was not amended to say so, and tsdown.config.ts:4 points the
reader to `dist-imports.test.ts`, a file that does not exist. The spec's
Status line also still reads "step 10.1's plan with him next" while 10.1 is
ticked. A later reader looking for the test, or counting 77, is sent the
wrong way.
**Suggested fix:** Amend step 10.1, Testing and Files / areas to the build
check (and why it is a build step rather than a Vitest test), update the
Status line, and change the comment in tsdown.config.ts to name
`check-dist-imports.mjs`.
**Resolution:** Fixed 2026-10-09: the spec records the change at 10.1 (the check is the build's last step; why a Vitest test would have needed Node's types; the type check and prepublishOnly), its Done when says "that check", Files / areas and Testing name check-dist-imports.mjs, and the Status line says 10.1 is built and reviewed. tsdown.config.ts's header now names check-dist-imports.mjs. The package's suite stays 76; the build log already marks the piece "changed" with the reason. Closed 2026-10-09 by re-review of 10.1's fixes (scope: e9e21d0..7cad72a): step 10.1 carries an accurate amendment (the build's last step, why not Vitest: tsconfig.json has types [] and includes the tests, pretest builds first, the use client check, prepublishOnly, the side-effect marking), Done when says that check, Files / areas and Testing name check-dist-imports.mjs, the Status line says built and reviewed, and tsdown.config.ts names check-dist-imports.mjs; no reference to dist-imports.test.ts or a 77th test remains.

### 10/F-300 [P3] closed - The dist import check reads only top-level .js and .d.ts files and skips triple-slash type references

**File:** packages/booking-component/check-dist-imports.mjs:11-20
**Found:** 2026-10-09 by independent review of step 10.1 (scope: c786f7e..17264c3; lenses: quality, security, performance, tests)
**Why it matters:** The check uses a non-recursive `readdirSync(dist)` filtered
by `/\.(js|d\.ts)$/`, and its patterns have no form for
`/// <reference types="..." />`. Run on a copy outside the repo, each of these
passed while carrying a forbidden import: `import "drizzle-orm"` in
`dist/sub/a.js`, the same in `dist/chunk.mjs`, and
`/// <reference types="node" />` in `index.d.ts`. Every other form tried
failed as it should (`export ... from`, minified `export*from"x"`, a side
effect import, default plus namespace import, a type `import("x")`, a lookalike
name such as `reactx`, a single-quoted directive). Today's output is two
top-level files with none of these, so nothing slips through now. A switch
to `.mjs` alone (tsdown's default when `platform` is `node`) would fail loudly,
since index.js would be missing; the silent gaps are a nested output file
(an `unbundle` build or a nested entry) and a triple-slash reference, which
the check exists to catch.
**Suggested fix:** Walk dist/ recursively, match `\.(c|m)?js$` and
`\.d\.(c|m)?ts$`, and add a pattern for `/// <reference types="...">`. Relative
specifiers (a split chunk importing `./x.js`) are reported as problems today;
allow those explicitly if code splitting is ever turned on.
**Resolution:** Fixed 2026-10-09: check-dist-imports.mjs reads every file under dist/ at any depth (`readdirSync` recursive) ending in .js, .mjs, .cjs, .d.ts, .d.mts or .d.cts, and also reads `/// <reference types|path=...>`. Shown with the reviewer's three cases planted in dist/: `sub/a.js` importing @scheduleads-app/shared, `chunk.mjs` re-exporting drizzle-orm and `extra.d.ts` referencing node each failed (exit 1, all three named); removed, the check passed with the real 2 files. Closed 2026-10-09 by re-review of 10.1's fixes (scope: e9e21d0..7cad72a): on a copy of the real dist/ outside the repo the check passed clean (2 files), then failed with exit 1 naming all four planted files: sub/deeper/a.js (drizzle-orm), sub/b.cjs (export* from shared, minified), sub/c.d.mts (reference types node) and d.mjs (require pg). Recursive readdirSync returns backslash-separated paths on Windows and join and the extension filter handle them (Node 26.7.0).

### 10/F-301 [P3] closed - Nothing builds the package before a publish, so npm publish ships whatever dist/ is on disk

**File:** packages/booking-component/package.json:19-24
**Found:** 2026-10-09 by independent review of step 10.1 (scope: c786f7e..17264c3; lenses: quality, security, performance, tests)
**Why it matters:** The package now has `publishConfig` and `files: ["dist",
"booking-component.css"]`, but no `prepublishOnly` or `prepack` script.
dist/ is gitignored, so `npm publish` (step 10.2) packs whatever the last
build on that machine left, without the type check or the dist import check;
`npm pack --dry-run` here packed the existing dist/ with no build run. A build
left from another branch, or a dist/ edited by hand, would be published and
installed by every site.
**Suggested fix:** Add `"prepublishOnly": "npm run build"`, so a publish always
rebuilds from the checked-out source and runs `check-dist-imports.mjs` first.
**Resolution:** Fixed 2026-10-09: the package's scripts gain `"prepublishOnly": "npm run build"`, so `npm publish` runs prebuild (shared, the backend's types), the type check, tsdown and the import check before anything is sent; a failing check stops the publish. Closed 2026-10-09 by re-review of 10.1's fixes (scope: e9e21d0..7cad72a): `npm run prepublishOnly`, both through --workspace from the root and from inside the package folder, ran prebuild (shared, the backend's build:types), the tsc type check, tsdown and check-dist-imports.mjs, exit 0; no .npmrc sets ignore-scripts.

### 10/F-302 [P2] closed - The install note says React 19, but the package refuses any React below 19.2.8, which is what Primo Painters runs

**File:** packages/booking-component/package.json:33-36 (and index.ts:11, AGENTS.md install line)
**Found:** 2026-10-09 by independent review of step 10.2 (scope: 8db88e6..bd39c2c; lenses: quality, security, performance, tests)
**Why it matters:** 10.2 documents the install as needing "react and react-dom 19", but the peer range is `^19.2.8`. The built `dist/index.js` imports only `createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState` and the JSX runtime, nothing newer than React 18. `primo-painters/package.json` pins `react` and `react-dom` to `19.0.0`; installing the packed `0.1.0` into a throwaway folder with those two versions fails with `npm error code ERESOLVE ... peer react@"^19.2.8" from @frankdmosquera/booking-component@0.1.0`. A tenant named in the plan cannot install it as documented without upgrading React or using `--legacy-peer-deps`. agency-site-app, face-and-body and the-latam-painters are on 19.2.8 and are unaffected.
**Suggested fix:** Before the first publish, widen the peers to `^19.0.0` (what the code actually needs), or keep `^19.2.8` and make the index.ts header and AGENTS.md say React 19.2.8 or later.
**Resolution:** Fixed 2026-10-09 in 10.2 review fixes: the peer range is react and react-dom ^19.0.0, so Primo Painters (react 19.0.0) can install it; the package 76 tests and the build check pass. Closed 2026-10-10 by independent review of feature 10 (scope: current, c786f7e..d9e4709; lenses: quality, security, performance, tests): packages/booking-component/package.json and the lockfile hold react and react-dom ^19.0.0, and the rebuilt dist/index.js imports only createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState and react/jsx-runtime, all in React 19.0; index.ts and AGENTS.md say React 19, which now matches.

### 10/F-303 [P3] closed - The install note says any GitHub token that can read packages, but GitHub Packages npm accepts only a classic token

**File:** packages/booking-component/index.ts:9-10 (and AGENTS.md install line)
**Found:** 2026-10-09 by independent review of step 10.2 (scope: 8db88e6..bd39c2c; lenses: quality, security, performance, tests)
**Why it matters:** The header says NODE_AUTH_TOKEN is "a GitHub token that can read packages", set in the shell and in Vercel. GitHub's npm registry page states "GitHub Packages only supports authentication using a personal access token (classic)." A fine-grained token, the kind GitHub now offers first, would fail the site's install on Vercel with an auth error at the agency site's item 12, with nothing in the note pointing at the cause. Locally the `gh auth token` OAuth token works, so the gap only shows on the host.
**Suggested fix:** Say "a classic personal access token with `read:packages`" for the host's build settings in both places.
**Resolution:** Fixed 2026-10-09: the package index.ts header and AGENTS.md now say a personal access token (classic) with read:packages, the only kind the GitHub npm registry takes. Closed 2026-10-10 by independent review of feature 10 (scope: current, c786f7e..d9e4709; lenses: quality, security, performance, tests): packages/booking-component/index.ts:9-10 and AGENTS.md:562 both name a personal access token (classic) with read:packages; the change is comments and docs only.

## Independent review

**Status:** passed
**Target commit:** d9e4709fb476ae02b7d303e59527ad93601cc0f2
**Base commit:** c786f7ec8290b31984cc12a8a7f3b3ed24daab57
**Base ref:** main
**Spec hash:** 916ad6e5b89d3c5b9593ee3e4ce58116333544917f10d92f239216d88fd06a3c
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-10-10T04:14:19Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-10T04:18:32Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `c786f7ec8290b31984cc12a8a7f3b3ed24daab57..d9e4709fb476ae02b7d303e59527ad93601cc0f2` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

### Commands

- `npm run test --workspace=@frankdmosquera/booking-component` (prebuild, tsc type check with tests, tsdown, check-dist-imports.mjs, then Vitest): pass, 76 tests; check reports dist/ imports only react, react-dom, hono, zod (2 files)
- `npm run test --workspace=@scheduleads-app/shared`: pass, 172 tests (includes run-client-setup.test.ts against local scheduleads_dev)
- `npm run test --workspace=backend`: pass, 887 tests in 78 files
- `npm run build --workspace=frontend`: pass
- `tsc -p packages/shared/tsconfig.json` (editor view, incl. scripts, client-setups and tests): fail, six errors, all in client-setup/run-client-setup.test.ts (F-305, F-306); seed-dev.ts, apply-client-setup.ts and agentsweb.ts are clean
- Type probe outside the repo against packages/shared/dist: `ClientSetupInputType["hours"]` accepts any value; a wrong `personChoice` is refused (F-305)

### Evidence

- Freshness: HEAD d9e4709 equals Target commit; merge-base of main and HEAD is c786f7e; current-feature.md SHA-256 matches; only review.md modified and the untracked personal ai-voice-proposal.md, which is outside the code scope.
- Setup command: runClientSetup refuses a missing business without making one, runs findDifferences before applyBusinessShape inside one transaction and rolls the dry run back by throwing; apply-client-setup.ts calls assertLocalDevDatabase before it loads the file or opens a connection. Tests cover a refused file, a missing business, a dry run writing nothing, an apply, a second apply adding nothing, and a hand-changed hours and service row kept and reported.
- Seed refactor: questions, hours, people, standby dates, worker texts, services and ticks now go through applyBusinessShape with the same only-if-missing rules; the holiday catch-up and the personChoice catch-up still read their rows before the shape is applied. One widening: the personChoice catch-up now updates every service of the business rather than only the seed-described ones, under the same all-still-business_assigns condition, which matches its own comment (decided for the whole business).
- AgentsWeb setup file: weekdays 1 to 5, 8:00 to 18:00 at a 30-minute step (last start 17:30), 21 days ahead and America/Bogota match agency-site-app/data/contactData.ts contactBookingData and siteConfig base colombia.
- Package: dist/index.d.ts exposes only BookingProvider, useBooking, BookNowTrigger and their prop types (no route types to inline); dist/index.js starts with "use client" and imports only react, react/jsx-runtime, hono/client and zod; files limits the publish to dist and the CSS; publish.npmrc and the install note read the token from NODE_AUTH_TOKEN, no secret in a committed file.
- F-302 and F-303 re-examined and closed (peer range ^19.0.0 with only React 19.0 APIs used; classic token named in index.ts and AGENTS.md).

### Findings

- F-304 [P2] open: the setup command does not list differences in a person's own hours, worker-text settings or hand-added ticks
- F-305 [P3] open: a setup file's hours are typed unknown, so the editor checks nothing in them
- F-306 [P3] open: run-client-setup.test.ts fails the shared package's editor typecheck with six errors
- F-302 and F-303 moved from fixed to closed

### Remaining risk

- `npm run db:seed --workspace=@scheduleads-app/shared` was not run (it writes the dev database); the seed refactor was reviewed by reading and by its typecheck only, and the builder's claim that it still builds both dev businesses was not re-proved here.
- `npm run client:setup` itself was not run; its guard call is covered by the existing assert-local-dev-database tests, not by a test of the command.
- The package install from outside the repo (10.2) and the AgentsWeb booking on the preview page (10.4) were not repeated; Check was not required.
- Nothing typechecks packages/shared's tests or scripts in a command, so F-306-style errors can recur unseen.
