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
