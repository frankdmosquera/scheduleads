# Coding Standards

Conventions for this monorepo: a Next.js 16 frontend, a Hono API, and
`packages/shared` between them. npm workspaces, npm as the package manager.

## TypeScript

- Strict mode enabled
- No `any` types - use proper typing or `unknown`
- Define interfaces for all props, API responses, and data models
- Use type inference where obvious, explicit types where helpful

## React

- Functional components only (no class components)
- Use hooks for state and side effects
- Keep components focused - one job per component
- Extract reusable logic into custom hooks

## Next.js

- Server components by default
- Only use `'use client'` when needed (interactivity, hooks, browser APIs)
- All data comes from the Hono API. No Next API routes and no database access
  from `frontend`. Webhooks, OAuth callbacks and uploads are routes in
  `backend`, not in Next
- A Server Action is a thin proxy to the API, used only when a call must not
  come from the browser (a secret, a rate limit)
- A `"use server"` module may only export async functions. A constant
  exported beside an action breaks the build
- Dynamic routes for item/collection pages

## File Organization

No `src/` directory. The scaffolder passes `--no-src-dir`, so everything sits at
the project root. In a monorepo these paths are relative to `frontend/`. The
backend has none either (Frank, 2026-09-26): `server.ts`, `lib/` and
`middleware/` sit straight in `backend/`, and its `tsconfig.json` excludes
`dist` and the tests so nothing else compiles.

- Components: `components/[feature]/ComponentName.tsx`
- Pages: `app/[route]/page.tsx`
- Server Actions: `actions/[feature].ts`
- Types: no `types/` folder. A type lives in the file that uses it and is
  exported from there; a type both apps need lives in `packages/shared`
- Lib/Utils: `lib/[utility].ts`
- Import alias: `@/*` resolves to the project root, so `@/lib/utils`, not
  `@/src/lib/utils`

`packages/shared` holds what both sides need: the Drizzle schema and
migrations, the Zod schemas, the API contract (the Hono `AppType`) and the
crypto. It compiles to `dist/` and its subpath exports point there, not at
source. The two workspaces disagree about extensions - the backend's NodeNext
resolution wants `./file.js` where the frontend's bundler wants none - and
building the package sidesteps that instead of forcing one of them to bend.
Both apps build it first through their own `predev` and `prebuild` hooks, so
neither ever consumes it as TypeScript. Do not add an export that points at
`src/`; it breaks both builds. Import from the package rather than redeclaring
a shape on either side.

## Naming

- Components: PascalCase (`ItemCard.tsx`)
- Files: Match component name or kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase ending in `Type`, and always exported
  (`SubscriptionLimitsType`, `RefusalType`), so an import shows it is a type. A name
  that already ends in `Type` keeps it (`LoginCodeType`, the Hono `AppType`).
  The one exception is a library interface we augment, such as Hono's
  `ContextVariableMap`, which only works under its own name
- Names say what a thing is. Do not copy abbreviations from library docs
  (`const ac = createAccessControl(...)` is `accessControl` here), and no bare
  `api` in `frontend`: that word is the backend. The frontend's side is
  `lib/api-client.ts`
- The thing you import carries the full meaning, however long the name gets,
  and its file is named after it. Zod schemas end in `ValidationSchema` and are
  one object per form (`signInEmailValidationSchema` in
  `sign-in-email-validation-schema.ts`). Frank reads the import and knows what
  it is without opening anything
- `packages/shared/src` is organised by kind, then area, then one file per
  export: `zod-validation/auth/sign-in-email-validation-schema.ts`. Each kind
  folder is one import (`@scheduleads-app/shared/zod-validation`, through its
  `index.ts`). The Drizzle tables are `db/drizzle-schema.ts`
- `backend` follows the same rule (Frank, 2026-09-26): kind, then area,
  then one file per export. Every middleware is named as one
  (`requireOrganizationMiddleware`) and lives in
  `middleware/<area>-middleware/<name>.ts`, so a folder seen on its own
  still says it holds middleware; plain functions live in
  `lib/<area>/<name>.ts`. A type sits in the file of the function that
  produces it. Frank navigates by folder and file name, not by scrolling
- A name says what it means, with no guessing: an area folder names what is
  in it before it is opened, and the functions inside use the same words.
  `auth` (who is signed in, and for which business), `bookable-hours` (when
  customers can book online; "availability" was dropped because it leaves
  open "available for what"), `errors` (what the API sends back when it
  says no). A folder named after a single thing inside it
  (`organization/`, `refusal/`) says nothing and is not used. The database
  keeps its own names (`availability_rule`): renaming a table costs a
  migration. Today's areas: `lib/auth`, `lib/bookable-hours`, `lib/errors`,
  `middleware/auth-middleware`, `middleware/dashboard-middleware`,
  `middleware/subscription-middleware`
- Helpers: one used across several areas goes in a shared `helpers/`
  folder; one used in a single place stays beside the code that uses it
- `frontend` is judged case by case: a piece with real logic gets its own
  file, a component that is mostly markup and CSS stays whole, however long

## Styling

- Tailwind CSS for all styling
- Tailwind v4: CSS-first config (`@theme` in `globals.css`), no `tailwind.config.js`
- Use shadcn/ui components where applicable
- shadcn here is v4 on Base UI (`@base-ui/react`, style `base-nova`), not
  Radix. Older shadcn docs and snippets assume Radix internals and data
  attributes; read the installed component before copying one in
- No inline styles
- Light by default, dark through an explicit `data-theme="dark"` on `<html>`.
  No `prefers-color-scheme` and no third "system" state: the owner picks and
  the choice sticks. This follows the mockups in `prototypes/`, and
  `frontend/app/globals.css` explains it at the top

## Database

- Use Drizzle for all database operations. Schema lives in one file, not spread
  across call sites.
- Generate migrations with `drizzle-kit generate`, apply with `drizzle-kit migrate`.
  Do not use `push` against anything but a local scratch database.
- Check the generated SQL before committing a migration. Drizzle will happily
  generate a destructive one.
- Never edit a migration that has already been applied anywhere real. Write a
  new one.

## Data Fetching

- The dashboard is an app behind a login, not a public site: nothing in it
  needs SEO. Data is fetched in the browser, from client components, through
  the Hono client typed by the `AppType` in `packages/shared`, and React Query
  owns caching and refetching once it arrives. A Server Action proxy is used
  only when a call must stay off the browser
- No data fetching in server components, and no Next caching features
  (`"use cache"`, `revalidate`, `force-static`, `fetch` cache options). Next
  only serves the page shell. A server-side fetch can be run once at
  `next build` and baked into the page, which is the static-site trap
- React Query settings, decided 2026-09-23 before it is installed:
  - Leads, clients and bookings keep `staleTime: 0` (the default): cached
    data shows instantly and a check starts at the same moment, on every
    screen open and tab focus. Show a small "updating…" indicator from
    `isFetching` so a change a moment later reads as a refresh, not a fault
  - Those lists also poll every 60 s, only while visible. New rows get a
    brief highlight; a list that turns out busy gets a "N new, show" bar
  - Settings and hours never go stale (`staleTime: Infinity`) and refetch
    only when invalidated after a save
  - Every save invalidates what it changed. An open form keeps its own copy
    and is never overwritten by a refresh
  - The business id is part of every query key, and the whole cache is
    cleared on sign-out and on business switch
  - Raise `staleTime` only if request volume becomes a real problem. Live
    push (server-sent events) only when a real need appears
- Every signed-in API response carries `Cache-Control: no-store`, so no
  browser or proxy keeps one business's data. New dashboard routes mount the
  same `dashboardNoStoreMiddleware` as `/me`
  (`backend/middleware/dashboard-middleware/dashboard-no-store-middleware.ts`)
- Validate with the Zod schemas in `packages/shared` at both ends: the form
  before it sends, the route before it touches the database
- Every app table is organization-scoped and the scope is a security boundary.
  `organizationId` is derived server-side from the Better Auth session, never
  read from anything a client sends
- Whether the booking widget calls the API from the browser or proxies through
  the host site's Server Action is open until Phase 3 (`project-plan.md`,
  open question 5)

## Error Handling

- API routes answer with the right status and a JSON body: 400 for a Zod
  failure, 401 or 403 for session and role
- Server Actions catch and return the `{ success, data, error }` shape
- Display user-friendly error messages via toast
- A failed calendar check never reports "free". The booking fails safely with
  a "temporarily unavailable" message and the business is told to reconnect

## Testing

The blueprint installs no test runner; testing is opt-in at the project level,
because the overlay can't know your stack. Adding unit testing is an explicit
setup task the AI can do through the normal workflow, either as a build-plan item
or with `/tests`. The setup should choose the stack-native runner, wire the
scripts or commands, add a small example test, and update the Commands section
of `AGENTS.md`.

When `AGENTS.md` declares a `Verify` command, treat it as the umbrella automated
gate. It combines only the checks this project actually has, in this order when
available: typecheck, tests, then build. The command does not enable an absent
test runner or replace focused evidence. It gives local work and optional CI one
exact command to run. `/ci` owns Verify and CI setup. `/tests` adds the real test
command to Verify when it already exists, but never creates CI only because
testing was configured.

**The opt-in switch is one signal: a `test` command in the Commands section of
`AGENTS.md`.** Declare one and **tests become a gate for logic-bearing steps**,
not an optional extra; leave it out and the loop verifies logic with the evidence
it already uses (run it, a screenshot, the build). Adding the runner is itself a
deliberate step, never a silent mid-step install. This is the single definition
of the switch; the skills and `ai-interaction.md` only point back here.

- **What to test (the scope rule):** pure logic where a wrong answer is possible -
  parsers, formatters, validators, id/slug builders, server actions. These have
  assertable inputs and outputs and real edge cases (empty, missing, malformed).
- **What not to test:** UI components and integration-level surfaces (render or
  export routes, anything driving a real browser or external service). Verify those
  with a screenshot and the build, not brittle unit tests.
- **The gate (when a runner is configured):** a build step that adds in-scope logic
  must ship a passing test in the same reviewable diff. The project's test command
  must be green before the step is approved, before any checkpoint commit, and
  before `/complete` merges. UI and integration-only steps are exempt and ride on
  screenshot plus build evidence.
- **When it's named:** the `/feature` spec's Testing section predicts the coverage,
  `/implement` writes the test with the step, and if a step surfaces logic the spec
  didn't foresee, add a focused test then.
- An empty suite should fail, not pass, so "no tests ran" never looks like "passed".
- Test files live next to source files (for example `feature.test.ts`).
- Run them via the project's test command (see Commands in `AGENTS.md`), not a
  hardcoded tool name.

Stack binding (swap for yours): a TypeScript app uses Vitest, `vi.mock()` for
external dependencies (the database, auth, third party APIs), and `vi.useFakeTimers()` for
time-dependent logic; a Python app would use pytest; a Go app `go test`.

## Browser Verification

For UI and integration behavior, prefer real browser evidence over reading the
code and assuming it works.

- Browser automation is separately opt-in through `/browser-tests`. That setup
  reuses a compatible runner or prefers Playwright for supported projects, then
  documents the exact command as `Browser tests` in `AGENTS.md`.
- When `Browser tests` is declared, add focused coverage for stable behavioral
  done-whens when it is proportionate, and run the documented command during
  `/check`. Do not assume it proves visual fidelity, real authenticated-profile
  behavior, browser chrome, or another claim the test does not observe.
- If no Browser tests command is declared, do not add a runner silently in the
  middle of an unrelated feature. Use the available dev server, browser
  screenshots, build output, API output, or manual evidence instead.
- Browser tests are not part of the default Verify command or CI unless the user
  separately chooses that slower gate.
- Browser evidence is especially important for flows that click, type, submit,
  navigate, download files, render complex layouts, or depend on client-side
  state.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible
- Formatting is Prettier, configured once in the repo's `.prettierrc` (100
  character lines, double quotes, semicolons, ES5 trailing commas). Frank's
  VS Code formats on save with it, so hand edits follow the same file. A
  block deliberately arranged by hand gets `// prettier-ignore` on the line
  above it rather than being fought on every save

## Comments

Write code that explains itself; comment only what the code cannot say. The
test is not length, it is whether a reader could recover the sentence from the
code alone. A comment restating the code is noise however short; a paragraph
carrying a decision, a refused alternative or a trap is worth its space.

This project deliberately keeps the reasoning next to the thing decided: the
comment sits at the line it explains. What is not wanted is narration of
obvious code, or a long block at the top that explains lines far below it.

- **Put a comment where it belongs, not at the top.** Frank reads code top to
  bottom and wants the explanation beside the line it explains: directly above
  it for anything longer than a few words, or at the end of the line
  (`if (!row) { // the business was deleted`) for a short note. A long block at
  the top of a file or function that explains lines far below it is the style
  to avoid; move each part next to its line instead.
- Comment the **why**, not the **what**. Delete any comment that restates the code.
- A file-level comment stays short: a few lines on why the module exists. The
  option that was rejected and the trap it avoids go beside the line they are
  about. A comment announcing each region of a file, or narrating the next
  three obvious lines, is not wanted.
- When a decision rests on how a dependency actually behaves, cite the file and
  line you read it in. "Read off better-auth 1.7.5 `routes.mjs:103`" is worth
  more than the same claim unsourced, and it tells the next upgrade what to
  re-check.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.

## Forms

Use shadcn components for form UI: Input, Label, Select, Button.

Do NOT use shadcn's Form / FormField wrapper, even though the shadcn docs still
show it. Wire forms with react-hook-form directly, following react-hook-form's
current controller API.

Why: shadcn's form layer has not caught up with react-hook-form's current API.
Mixing them produces a form that renders but does not work.

Verified in real projects on 2026-09-09. Re-check before assuming it still
holds. This rule describes a third party that has not caught up yet, not a
permanent truth.

## Backend (Hono on Railway)

- The backend owns all data access. The frontend never talks to Postgres
  directly.
- Drizzle schema and migrations live in `packages/shared` and run through
  `drizzle-kit` from `packages/shared` only, never from `backend` or
  `frontend` (see Commands in `AGENTS.md`). Two workspaces generating against
  one database is how a migration ledger forks. The frontend imports the
  types, never the connection.
- Validate request bodies with zod at the route boundary, before any database
  call.
- Long running work does not belong in a request handler. Split it into a
  separate worker so a slow job cannot hold the API hostage.
- Two places a file can go, decided per file rather than per project. Most apps
  end up using both. If a browser fetches it directly, a photo or an avatar or
  anything with a public URL, it goes to object storage. If only the server ever
  reads it, a generated PDF, an export, a cache, it goes to the platform volume
  under `STORAGE_DIR`. That is a local folder in development and a mounted
  volume in production, so the same code works in both.
- Ask what a person may do, never what their business role is. A route or
  screen that depends on a business role calls Better Auth's organization
  `hasPermission` (for example `{ member: ["delete"] }`) and never compares
  `role === "owner"`. The roles and what they grant are defined once, in
  `customStatements` and the `newRole` blocks in `backend/lib/auth/auth-server.ts`.
  This keeps Better Auth's dynamic access control (roles a business defines
  for itself) a clean switch to turn on later: a hard-coded role name would
  silently ignore every custom role.
  The one exception is the platform admin, `user.role === "admin"` (see
  `allowUserToCreateOrganization`). That is Frank's role above every
  business, it belongs to the `admin` plugin, and dynamic roles never
  apply to it.
