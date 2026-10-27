# Feature: A service shows its price

**From build-plan:** feature 25d

**Size:** light - one new optional field carried from Settings to where the customer sees it, plus one small window rule; no times, bookings or money is charged.

**Branch:** feature/25d-a-service-shows-its-price

**Status:** approved (Frank, Oct 27: "go on your own and finish it up")

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
