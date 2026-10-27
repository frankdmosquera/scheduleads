# Feature: A service shows its price

**From build-plan:** feature 25d

**Size:** light - one new optional field carried from Settings to where the customer sees it, plus one small window rule; no times, bookings or money is charged.

**Branch:** feature/25d-a-service-shows-its-price

**Status:** verified

## Goal

A customer booking Carbon Peel on Face and Body's site sees "$150" next to "45 min", on the
service card, on the screen where they type their details, on the done screen and in their
confirmation email. Each business sets its own prices, or none: a service with no price shows
no price, exactly as today. Face and Body's 37 prices come from her own site.

While here, one window rule Frank decided on Oct 27, after trying Cal.com's: a tap on the dark
area outside the window closes it, on every screen, as the X and Escape do. The cost, accepted as
Cal.com accepts it: a stray tap while typing the details closes the window too.

## In scope

- **The business's currency**, one per business (`organization.currency`, an ISO 4217 code such as
  `CAD`, `USD`, `COP`), picked by the owner at the top of Settings > Services ("Prices in"), from
  every currency the browser knows (`Intl.supportedValuesOf("currency")`), named in the page's
  language. No default: a business with none shows no prices anywhere.
- **A price per service**: an amount (`priceCents`, the smallest unit, so 150.00 is 15000) and
  "starts from" (`priceFrom`). Both optional; "starts from" needs an amount. Set on the service's
  card in Settings > Services (an amount box and a "Starts from" tick), where the card is
  read-only for a login that may not change the business, as every field there is. The Services
  list row shows the price beside the length.
- **The setup file**: a top-level `currency` and, per service, `price` (in whole or decimal
  units: `150`, `12.5`) and `priceFrom: true`. A price with no currency is refused when the file is
  checked. Applying it fills what is missing and changes nothing already set, as today: the
  currency when the business has none, a price on a service made now, and a price on an existing
  service that has none. A different currency or price already saved is listed, never applied.
- **The public service list** answers each service's `price` as
  `{ cents, from, currency } | null` (null when the service has no amount or the business no
  currency). Older windows ignore it.
- **The booking window** (package 0.2.3) shows the price on the service card, beside the length
  on the service and details screens, and on the done screen, formatted in the window's language
  with the currency's narrow symbol and no ".00" on a whole amount ("$150", "From $150",
  "Desde $ 45.000").
- **The customer's confirmation email** gets a Price line under the service when the service has
  one.
- **The outside tap** (above).
- **Face and Body's prices** in `client-setups/face-and-body.ts`: `currency: "CAD"` and the 37
  prices from her site's `data/servicesData.ts` (with its `priceFrom`). Applying it to the live app
  and installing 0.2.3 in her site are Frank's yes on the day (step 25d.1's last part).

## Out of scope

- The logo, a colour theme and a picture per service: feature 25e.
- Charging, deposits, taxes, discounts or a total: feature 16 (Quotes) and later.
- A price on the owner's own emails (the "New booking" notice), reminders, texts, the dashboard's
  Calendar and booking cards. Only what Frank named.
- Freezing the price on a booking: the email reads the service's price when it is sent, which is
  the moment the booking is made.

## Build loop

Light: one step, built straight through after Frank's yes (given Oct 27), with its tests, the
build log, a commit and a push to the feature branch. Its review is at `/complete`, where the
merge is Frank's yes. Applying the setup file to the live app and the new package in Face and
Body's site touch real data and her production site, so each waits for Frank's yes on the day.

## Build steps

- [x] **25d.1 A service shows its price** - the migration (`organization.currency`,
  `booking_link.priceCents` and `priceFrom` with their checks), the shared schemas, Settings >
  Services (currency picker, the price on each card and row), the public list's `price`, the
  window (card, service and details screens, done screen, the outside tap) at 0.2.3, the
  confirmation email's Price line, the setup file's `currency`/`price`/`priceFrom` with
  fill-only-what-is-missing, and Face and Body's 37 prices in her setup file.
  **Done when:** on the laptop, Riverbend Clinic (dev) with `CAD` and a price on one treatment
  shows it in Settings and in the window's card, details and done screens, and its confirmation
  email (rendered in the test) carries the Price line; a service without a price shows none; the
  setup command's dry run of Face and Body's file on the local database lists the currency and
  37 prices to add; a tap outside the window closes it, and a tap inside it does not; the shared, backend and booking component tests, both builds, the
  frontend lint and `format:check` pass.

## Files / areas

- `packages/shared/db/auth-tables/organization-table.ts`, `packages/shared/db/booking-tables/booking-link-table.ts`, a new migration from `db:generate`
- `packages/shared/zod-validation/booking-links-validation-schemas/service-validation-schema.ts` (+ a currency schema), `.../admin-validation-schemas/client-setup-validation-schema.ts`
- `packages/shared/client-setup/apply-business-shape.ts`, `run-client-setup.ts` (the listed differences), `packages/shared/client-setups/face-and-body.ts`
- `backend/lib/settings/find-services-settings.ts`, a new `save-services-currency.ts`, `backend/routes/settings-routes.ts`, `backend/routes/public-booking-links-routes.ts` (and the list's finder)
- `backend/emails/booking-confirmation.tsx`, `booking-email-facts-type.ts`, `email-words.ts`, `backend/lib/email/find-booking-email-context.ts`
- `frontend/components/settings/services-screen.tsx`, `service-form.tsx`, their words, `frontend/lib/api-client/settings/`
- `packages/booking-component/`: `api-client/booking-api-types.ts`, a price formatter, `service-list-screen.tsx`, `month-layout/*`, `booking-window.tsx` (outside tap), its words, `package.json` 0.2.3

## Data / contracts

- `organization.currency text null`, check `currency ~ '^[A-Z]{3}$'`; the API also checks it is a
  code `Intl` knows.
- `booking_link.priceCents integer null` (check `>= 0`), `booking_link.priceFrom boolean not null
  default false` (check `priceFrom = false or priceCents is not null`).
- Settings service body gains `priceCents: int 0..100,000,000 | null` and `priceFrom: boolean`;
  `priceFrom: true` without an amount is refused with the field's message.
- `PUT /settings/services/currency` `{ currency: string | null }`, change-business permission,
  answers `{ currency }`. Setting it to null hides every price but keeps them.
- Public service: `price: { cents: number; from: boolean; currency: string } | null`.

## Testing

- Shared: the service and setup schemas (a price needs a currency; "starts from" needs an amount;
  an unknown currency is refused); the setup apply fills a missing currency and price and leaves a
  saved one, and the dry run lists a different one.
- Backend: Settings saves and answers a price and the currency, refuses "starts from" alone; the
  public list answers the price, and null without a currency; the confirmation email has the
  Price line only when there is a price.
- Booking component: the formatter (whole and decimal, "From", English and Spanish, COP); the
  card and the done screen show the price, and none without one; a tap on the backdrop closes the
  window and a tap inside it does not.

## Notes for the AI

- Read `blueprint/context/coding-standards.md` before changing code; one export per backend file;
  types end in `Type`.
- Every price shown goes through the one formatter in the package, and the email through the same
  rule on the backend (`Intl.NumberFormat`, `currencyDisplay: "narrowSymbol"`, no fraction digits
  on a whole amount), so the window and the email never disagree.
- Her site's `servicesData.ts` is the source of her prices; three priced at consultation are not
  among her 37 services and stay off.

## Implementation walkthrough

**The data (packages/shared/db, migration 0035_service_price).** `organization.currency` (an ISO 4217 code, checked `^[A-Z]{3}$`), `booking_link.priceCents` (hundredths, so 15000 is 150, never negative) and `booking_link.priceFrom` (false by default, true only with an amount). All three are additive, so the migration is safe while older code still runs.

**The rules (packages/shared/zod-validation).** `currency-validation-schema.ts` accepts only codes the runtime's `Intl` knows. The service body gains `priceCents` and `priceFrom`, both optional, so a form from before prices leaves the saved price alone (F-552); "Starts from" without an amount is refused. The setup file gains `currency`, `price` (written as on a price list, 150 or 12.5, at most 2 decimals) and `priceFrom: true`; a price without the file's currency is refused. Every new message has its Spanish.

**One formatter (packages/shared/helpers/format-price.ts).** The window and the email both write prices through it: the currency's narrow symbol, no ".00" on a whole amount, and Spanish as the currency's own country writes it ("$ 45.000" for pesos), since plain "es" is Spain's and puts the symbol last.

**Settings (frontend).** `services-currency-picker.tsx` is "Prices in" at the top of Services: every currency the browser knows, named in the dashboard's language, saved on pick, none by default. `service-price-field.tsx` is the price box with "Starts from" on each card, closed with the reason until a currency is picked. The list row shows the price beside the length.

**The API (backend).** `PUT /settings/services/currency` (change-business permission). The Services read answers the currency and each price. The public routes answer `price: { cents, from, currency } | null` through `public-price-of.ts`, null without a currency, so a price never shows without one; the business's currency is not answered on its own.

**The window (packages/booking-component, 0.2.3).** `price-text.ts` writes "$150" or "From $150"; the service card shows "45 min · $150", and the rail beside every later screen a tag and the price. A tap on the dark area closes the window, as on Cal.com, only when the press both starts and ends there, so selecting text inside never closes it.

**The email.** The customer's confirmation has a Price line under What when the service has one, read when the email goes.

**The setup file.** Fills a missing currency and a missing price, on a new or an existing service, and lists a different one already saved, never changing it. Face and Body's file holds CAD and her 37 prices from her site's `servicesData.ts`.

**Proof.** Shared 216 tests, backend 1108, booking window 103; both builds, the lint and the format check. On the laptop her file's dry run listed "the currency, CAD, 37 prices", and her local site showed the prices and closed on a tap outside.

## Findings

### 25d/F-552 [P2] closed - A Services page opened before the deploy wiped a service's price on its next save

**File:** packages/shared/zod-validation/booking-links-validation-schemas/service-validation-schema.ts:57-59; backend/lib/settings/save-service.ts (`.set(service)`)
**Found:** 2026-10-27 by independent review (fresh subagent; scope: 725c801..041d67c)
**Why it matters:** `priceCents` defaulted to null when a body left it out, and the save writes the whole parsed body, so a tab from before prices, saving any change, set the price back to none without a word.
**Suggested fix:** Make both price fields optional in the API schema and leave them out of the save when not sent.
**Resolution:** fixed 2026-10-27: both are `.optional()`; a body without them keeps the saved price (settings-routes.test.ts "saves the business's currency and a service's price").
Closed 2026-10-27 by independent re-review (fresh subagent, 041d67c..905a626): drizzle-orm's mapUpdateSet drops undefined keys, so an older body leaves the price alone, and an insert without them gets the column defaults; the new route test passes.

### 25d/F-554 [P3] closed - The currency picker was locked while a service card was open

**File:** frontend/components/settings/services-screen.tsx (the picker's canEdit)
**Found:** 2026-10-27 by independent review (fresh subagent; scope: 725c801..041d67c)
**Why it matters:** The price box says to pick the currency at the top, but the picker was disabled while any card was open, so the owner had to cancel the card and lose what she typed.
**Suggested fix:** Drop the `open === null` condition.
**Resolution:** fixed 2026-10-27: the picker waits only for a save running.
Closed 2026-10-27 by independent re-review (fresh subagent, 041d67c..905a626): the picker's canEdit is `settings.canEdit && !saving`, and the open card reads the live currency.

### 25d/F-555 [P3] closed - The Starts from error was not tied to the field for screen readers

**File:** frontend/components/settings/service-price-field.tsx:49
**Found:** 2026-10-27 by independent review (fresh subagent; scope: 725c801..041d67c)
**Why it matters:** With only the Starts from error, `aria-describedby` pointed at the hint, which was not rendered.
**Suggested fix:** Point it at the error whenever either error shows.
**Resolution:** fixed 2026-10-27.
Closed 2026-10-27 by independent re-review (fresh subagent, 041d67c..905a626): the price box points at the error whenever either error shows.

### 25d/F-556 [P3] closed - A press on the dark area dragged onto the window closed it

**File:** packages/booking-component/booking-window/booking-window.tsx (onPointerDown, onClick)
**Found:** 2026-10-27 by independent review (fresh subagent; scope: 725c801..041d67c)
**Why it matters:** The click of a press that starts outside and ends on the window lands on the dialog itself, so it read as a tap outside.
**Suggested fix:** Also require the release on the dark area.
**Resolution:** fixed 2026-10-27: onPointerUp clears the press when released on the window; booking-window.test.ts covers both drags.
Closed 2026-10-27 by independent re-review (fresh subagent, 041d67c..905a626): onPointerUp clears the press released on the window; the new test fails without it and passes now.

## Independent review

### Receipt

- **Status:** passed
- **Target:** 905a626 (the fixes; first round 041d67c)
- **Base:** 725c801 (merge base with `main`)
- **Spec SHA-256:** c010c49505ac281f5ac645c69d9e0ff541dd2b22e66c9f8ae5f935ce5e7a037d (after its status line was set to verified)
- **Builder:** claude, claude-opus-5-5
- **Reviewer:** claude, claude-opus-5-5, a fresh subagent each round (automatic, `review.independentExecution`)
- **Check:** not required (light feature; the window was seen working in her local site)
- **Reviewed:** 2026-10-27

### Commands

Round 1 (725c801..041d67c) and round 2 (041d67c..905a626): `npm run test --workspace=@scheduleads-app/shared` (216 passed), `npm run test --workspace=backend` (1108 passed), `npm run test --workspace=@frankdmosquera/booking-component` (103 passed), `npm run build --workspace=@frankdmosquera/booking-component`, `npm run build --workspace=frontend`, `npm run lint --workspace=frontend`.

### Findings

Round 1 passed with F-552 (P2) and F-553 to F-556 (P3); F-552, F-554, F-555 and F-556 were fixed in 905a626 and closed in round 2. F-553 (deploy order) and F-557 (P3, found in round 2: a hand-made call can get a 500) are carried.

### Remaining risk

Migration 0035 is additive and was checked safe for the old code, so it goes on the live database before the deploy. The minutes when Vercel is live before Railway refuse service saves (F-553).
