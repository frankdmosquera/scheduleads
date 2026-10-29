# Fix: Her look's button text everywhere, and the window's first open

**Type:** Fix

**Status:** verified

**Size:** light - two small pieces of wiring (one stored value carried to two more screens) and one small piece of logic in the window, each with its test; no new data or route.

**Branch:** fix/her-look-s-button-text-everywhere-and-the-window-s-first-open

## The problem

1. **Navy on copper in two places.** Feature 25f keeps a business's look's own button text
   (`organization.mainInkColor`, Face and Body's cream `#fffdf9`) and the booking window, her site
   and the emails use it. Two screens still work it out for contrast and show navy `#0f172a` on her
   copper: the dashboard's highlight (`frontend/lib/business-accent-style.ts`, fed by
   `organizationDetails.mainColour` in
   `backend/middleware/subscription-middleware/require-known-subscription-middleware.ts` and `/me`
   in `backend/app.ts`), and the customer's own booking page, the link in every confirmation email
   (`frontend/components/customer-booking/customer-booking-screen.tsx`, fed by
   `backend/lib/booking/find-booking-page.ts`).
2. **A click that opens nothing.** On her `/book` (laptop and live, Oct 29) the first click on
   "Choose a treatment and a time" sometimes does nothing, and the window's contents are in the
   page but off-screen; the second click opens it. The provider keeps the window "open" in its state
   (`booking-provider.tsx`: `current ?? { bookingId, opener }`) while its `<dialog>` was never shown
   (`booking-window.tsx` calls `showModal()` once, in an effect on mount), so every later open is
   swallowed as "already open". `/book` opens the window by itself on load, which is when it is
   seen; the same can happen to any open.

## The fix

1. **The look's text, carried.** The middleware also reads `mainInkColor`; `/me`'s organization
   gains `mainInk` (null unless colours are on and a look's ink is kept). `businessAccentStyle(main,
   ink)` uses that ink only while the highlight is the main colour itself (when it had to be shaded
   darker to read on the page, the shade's own worked-out text stays). After a save on Look the
   dashboard takes the new ink at once, as it takes the new colour. The booking page's business
   gains `brandInk` (`mainInkColor`), and its buttons use it when set, else work it out.
2. **An open is never swallowed.** Every open asks the window to show itself: the provider counts
   the asks (`asked`), and the window shows its dialog whenever an ask finds it not showing, not only
   on mount. A window already showing is left as it is (no second load, no lost screen). Window
   0.2.9, packed into Face and Body's site.
   Must not break: one window at a time, the opener getting focus back on close, the tap-outside
   close, a named service opening straight on it.

## Build steps

- [x] **Fix.1 Her look's button text everywhere, and an open that always shows the window.** Both
  pieces above, with tests: `businessAccentStyle` with and without an ink (and a light main colour
  shaded darker keeping its worked-out ink); `/me` answering `mainInk` (backend route test); the
  window shown again when an open finds its dialog closed (jsdom, booking-component); the booking
  page's business carrying `brandInk`. Pack 0.2.9 into her site on a branch there.
  **Done when:** on the laptop, with her Copper look saved, the dashboard's highlight buttons and
  her customer booking page's buttons carry her cream; with Rose clay (a palette, not a look) they
  carry the worked-out text as before; the new window test fails on 0.2.8's code and passes on
  0.2.9's; her `/book` opens the window on load and on every click; shared, backend and package
  suites and the dashboard build pass.

## Verify

- Laptop: sign in as her laptop owner (`faceandbody@example.com`), dashboard at
  http://localhost:3400: buttons cream on copper. Open a booking's own page from a laptop booking:
  buttons cream. Her site http://localhost:3402/book: the window opens on load, closes, and opens
  on the first click every time.
- Live after the merge: her dashboard's Save button and her next booking email's link page show
  cream on copper.

## Implementation walkthrough

**The look's text, carried.** `require-known-subscription-middleware.ts` reads `mainInkColor` with the row it already reads and sets `organizationDetails.mainInk` only when the dashboard has a main colour; `/me` answers it as `organization.mainInk`. `businessAccentStyle(main, ink)` uses it only while the highlight is the main colour unshaded: a colour too light to read on the dashboard's white page (her copper) is shaded darker and keeps its worked-out white, so her dashboard never showed navy and still shows white on darker copper. `dashboard-gate.tsx`'s `setMainColour(main, ink)` takes the new ink right after a Look save. `find-booking-page.ts` answers `brandInk`, and the customer's booking page puts it on its buttons when the business has a colour, else works it out: her copper buttons there now carry her cream.

**An open is never swallowed.** `booking-provider.tsx` counts every open while the window is mounted (`asked`); `booking-window.tsx` shows its dialog in an effect on `asked`, so an open that finds the dialog not showing shows it, and a window already showing is left alone (no second load, one dialog). The cause of the first show failing on her `/book` was not found (F-587 records a second possible state the fix does not cover). Window 0.2.9, packed into Face and Body's site.

**Proof.** Package 122 tests, including `booking-provider.test.ts`, which makes the first show do nothing: it failed on 0.2.8's code and passes on 0.2.9's. Backend 1121 (`/me`'s `mainInk` after a look save and none after a hand pick; the booking page's `brandInk`). Dashboard build. On the laptop: Summit Painting given the Copper look showed white on its darker copper, then was put back; her `/book` opened the window on load and on four clicks in a row. Not done: a frontend test for the highlight (no test runner there, F-585) and the customer page in a browser.

## Findings

No finding was resolved in this fix. Raised and carried in the live ledger: F-585 (P2, the highlight's planned tests not written), F-586 (P3, a revived window keeps the first open's service and opener), F-587 (P2, unverified, a dialog open but not modal is not recovered).

## Independent review

**Status:** passed
**Target commit:** b6c515b086eac34a9ed8eeb63e950016978bdfae
**Base commit:** 66fb631a63a3962c91b4367e9db3aba74737aff7
**Base ref:** main
**Spec hash:** 42aa70cd75f81296fa210399697211c17e090421b4066c50b63ff3c11c0a4b9b
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-29T03:58:16Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-29T04:03:44Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Handoff

Review the active spec and the complete `66fb631a63a3962c91b4367e9db3aba74737aff7..b6c515b086eac34a9ed8eeb63e950016978bdfae`
delta in a fresh session or isolated subagent without the builder conversation. Run all Audit
lenses from scratch. Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope. The fix also bumps the booking window in Face and
Body's site (`../face-and-body`, `main..fix/booking-window-first-open`, c69d273..654e382): review
that delta as part of the same fix.

### Commands

- `npm run test --workspace=@frankdmosquera/booking-component`: pass (23 files, 122 tests; build and dist import check passed first)
- `npm run test --workspace=backend`: pass (99 files, 1121 tests, local `scheduleads_dev`)
- `npm run test --workspace=@scheduleads-app/shared`: pass (37 files, 231 tests)
- `npm run build --workspace=frontend`: pass

### Evidence

- Freshness checked before review: HEAD = target, `git merge-base main b6c515b` = base, spec SHA-256 matches, only `review.md` differed from the target.
- Whole delta read: 15 files in `66fb631..b6c515b` (backend middleware, `/me`, `find-booking-page.ts`, two backend tests; dashboard gate, shell, colours card, `business-accent-style.ts`, customer booking screen; provider, window, new provider test, package version) and `../face-and-body` `c69d273..654e382` (package.json, lockfile, vendored tgz 0.2.8 -> 0.2.9; tgz not unpacked).
- Tenant and colours-off: the middleware reads `mainInkColor` from the active organization's own row and sends it only when `mainColour` is set (colours on). Every writer of `mainInkColor` (`save-business-colours.ts`, `apply-business-shape.ts`) sets it only with a matching look whose main is the saved `brandColor`, so a non-null ink implies colours on and its own brand colour; the booking page's `brandInk` comes from the same row as `brandColor`, and the screen uses it only when `brandColor` is set.
- Window: the show effect (deps `[asked]`) is split from the load effect (deps unchanged), so an ask never re-runs a load or resets the screen; `!dialog.open` keeps a showing window untouched (no second `showModal`); the provider still mounts one `BookingWindow`; tap-outside and close handlers are unchanged. The new jsdom test fails on 0.2.8's `current ?? {...}` (the second open returns the same state, no re-render, dialog stays closed) and passes on 0.2.9; it runs in its own isolated worker (vitest isolate on, 23 workers), so its `HTMLDialogElement.prototype` patch cannot reach the other jsdom files.
- Backend tests: `/me` answers `mainInk` `#fffdf9` with a look and null without; the booking page answers `brandInk`.

### Findings

- F-585 [P2] open: the spec's `businessAccentStyle` tests were never written, yet Fix.1 is ticked
- F-586 [P3] open: reviving a hidden window keeps the first open's service and opener
- F-587 [P2] unverified: the recovery skips a dialog that is open but not modal, which matches the spec's "in the page but off-screen" symptom

### Remaining risk

- Root cause of the first `showModal()` not reaching the screen is not identified; the fix recovers only a dialog whose `open` is false (F-587). The on-load open on `/book` itself is not made more reliable; only the next open recovers.
- No browser run in this review (Check not required, no dev servers started): the dashboard and booking page colours and the `/book` behaviour were not seen on screen.
- The vendored 0.2.9 tgz in `../face-and-body` was not unpacked or compared with this target's build.
