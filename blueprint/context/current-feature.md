# Feature: Spanish booking

**From build-plan:** feature 12i

**Size:** heavy - three separate risks with real logic: the window's words, dates and form
errors in two languages; a booking that carries its language through the API, the database and
every customer email; and the redirect after booking, a new contract every site builds on.

**Branch:** feature/12i-spanish-booking

**Status:** verified

## Goal

IA a la Orden's site, ialaorden.com, is in Spanish, and Booking CRM only speaks English: the
window, its dates, the emails and the customer's cancel and move page. After 12i, a site that says
"Spanish" gets a booking window in Spanish, and that customer's confirmation, move and cancel emails
and their own booking page are in Spanish too. A business with an English and a Spanish site answers
each customer in the language they booked in. And a site can send the visitor to its own thank-you
page once the booking is made (Frank, 2026-10-23: "it has to redirect to our thank you page"), so
ialaorden.com can go live on the window (its item 12).

## In scope

- **Two languages, English and Spanish.** Spanish is written in "usted", as ialaorden.com is.
- **The window's language is the site's choice**: a `language` prop on `BookingProvider`,
  `"en"` or `"es"`; left out, English, exactly as today.
- **Everything the window says**: its words, the day, month and time-zone names, the times the API
  writes (`when`), the form's error words, the problem screens and the Book now trigger's default.
- **A booking keeps the language its window used**, stored on the booking; a booking made without
  one (the owner's, or an older window) takes the business's language.
- **The customer's emails and page follow the booking's language**: the confirmation, moved and
  cancelled emails, and the cancel and move page behind the email's link.
- **The business's language, a setting** (decision 30): used for the owner's three booking
  notifications and for a booking with no language of its own. Set in Settings, on the Booking form
  page, and by the client setup file. Every business that exists today is English.
- **After booking, the site decides**: an `afterBooking` prop, `"stay"` (the window's own "You're
  booked" screen, today's behaviour and the default) or `{ redirectTo }`, which sends the visitor to
  the site's page; and an `onBooked` callback that tells the site a booking was made, with nothing
  about the customer.
- **Published as version 0.2.0** of `@frankdmosquera/booking-component`, on Frank's yes.

## Out of scope

- The dashboard in Spanish, the owner's Google calendar event text, and text messages (no texts are
  included in Latin America; US and Canada texts stay English). Each is a later item if needed.
- A third language. The shape takes one more by adding its words; nothing here is built for it.
- The redirect as a dashboard setting, for a business with no code of its own: item 24, the hosted
  booking page (agreed with the website session, 2026-10-23).
- ialaorden.com's own changes (passing `language="es"`, its `/gracias` page): its item 12, in
  `agency-site-app`.
- Service names: they are the business's data, renamed in Settings.

## Build loop

Heavy, so each step has its own plan yes, then runs straight through: build, its tests and
checks, tick the box, the build log, commit and push to `feature/12i-spanish-booking`, `/audit`
scoped to the step, then an independent review. The one planned stop is after the review, where its
findings are talked through (AGENTS.md, "After the green light, nothing stops until the review").
P0 and P1 findings are fixed before the next step; P2 and P3 are recorded and carried. Publishing
0.2.0 is Frank's separate yes at the end of 12i.3.

## Build steps

- [x] **12i.1 The window speaks Spanish, and can send the visitor on.** "On the laptop, a page
  that says Spanish opens the window in Spanish, from the services to the confirmation, and a page
  that names a thank-you page lands there after Book."
  - 12i.1.1 Words in one place per language: an English and a Spanish word list in the package, one
    entry per thing the window says, so a missing Spanish word is a type error, never a blank.
  - 12i.1.2 `language` on `BookingProvider`, handed to every screen; the day, month and zone names
    formatted for it (`en-CA` as today, `es-419` for Spanish).
  - 12i.1.3 The API writes `when` in the asked language: the free times route takes a `language`
    query value and the booking route a `language` body field, both `"en"` or `"es"`, left out
    meaning English; anything else is refused with the route's usual 400.
  - 12i.1.4 The form's errors in the window's language: the window reads which field failed and
    shows its own words for it, never the shared schema's English message.
  - 12i.1.5 `afterBooking` and `onBooked`, below under Data / contracts.
  **Done when:** the package tests show every screen's words in both languages, the dates and zone
  in Spanish, a form error in Spanish, `onBooked` called once with no customer fields, and a
  redirect to the site's address; the backend tests show `when` in Spanish for `language=es` and a
  400 for any other value; and on the laptop a Spanish test page shows the window in Spanish end to
  end and lands on a thank-you page after a booking.

- [x] **12i.2 The times on a phone.** Added by Frank on 2026-10-24 ("I'm not quite happy with the
  design... how to scroll the times"). "On a phone, picking a time feels quick even with 40 times in
  a day." Calendly's way: below phone width the window fills the screen, the calendar and a day's
  times take turns (pick a day and its times open as one scrolling list with the day's name and a
  way back), and the big-screen layout is unchanged. A week strip, closed Mañana/Tarde/Noche bars
  and a two-layout A/B try were weighed and dropped by Frank: he likes Calendly's list and will
  change it if he comes to hate it. The start-time grid stays (a customer never types 8:35); a clock
  picker is only a note for later.
  **Done when:** at phone size on the booking preview, with a 15-minute service, a picked day opens
  its times alone and Back returns to the calendar; a big screen shows both side by side as before;
  the turn-taking has a saved test.

- [x] **12i.3 The booking keeps its language: emails and the customer's page.** "A Spanish
  booking gets its confirmation in Spanish, and its cancel and move page is in Spanish; the owner's
  notification is in the business's language."
  - 12i.3.1 `booking.language` and `organization.language`, `"en"` or `"es"`, one migration,
    every existing row `"en"`. The booking route stores the asked language, or the business's.
  - 12i.3.2 The three customer emails and their subjects in the booking's language; the three owner
    notifications in the business's.
  - 12i.3.3 The customer's booking page and its change-time panel in the booking's language, its
    page's `lang` attribute included (on its own container: the root layout owns `<html>`).
  - 12i.3.4 The setting: Settings, Booking form page, "Language of the customer emails"; the
    client setup file's `language`, and the setup form on `/admin/client-setup`.
  - 12i.3.5 Publish 0.2.0, on Frank's yes.
  **Done when:** the backend tests show a Spanish booking's confirmation, moved and cancelled emails
  in Spanish and its owner notification in the business's language, a booking without a language
  taking the business's, and the customer page answering in the booking's language; the setting
  saves and reads back; the email preview script shows the Spanish emails; and 0.2.0 is published.

## Files / areas

- `packages/booking-component/`: a new `words/` folder (the two word lists and the language type),
  `booking-provider/booking-provider.tsx`, `booking-window/` (every screen, `month-calendar/format-*`,
  `booking-form/read-booking-form.ts`), `book-now-trigger/`, `api-client/` (the `language` value on
  the two calls), `index.ts` (exports and its header), `package.json` (0.2.0).
- `packages/shared/`: `zod-validation/booking-links-validation-schemas/` (the `language` field on
  the free-times query and the booking body), `helpers/format-booking-time.ts` (a language),
  `db/booking-tables/booking-table.ts`, `db/auth-tables/organization-table.ts`, one new migration,
  `client-setup/` (the `language` field).
- `backend/`: `routes/public-booking-links-routes.ts`, `routes/public-bookings-routes.ts`,
  `lib/scheduling/local-start-times.ts`, `emails/*` (the six booking emails), `lib/email/` (facts
  carry the languages), `lib/booking/find-booking-page.ts`, `routes/settings-routes.ts`.
- `frontend/`: `components/customer-booking/*`, `app/customer-booking/`, the Booking form settings
  page and its card, `components/admin/client-setup-form.tsx`.

## Data / contracts

- **Language values**: exactly `"en"` or `"es"` everywhere (prop, query, body, columns). Intl
  locales: `"en"` is `en-CA` (today's), `"es"` is `es-419`.
- **`BookingProvider`**: `language?: "en" | "es"` (left out: `"en"`); `afterBooking?: "stay" |
  { redirectTo: string | ((booked: BookedType) => string) }` (left out: `"stay"`);
  `onBooked?: (booked: BookedType) => void`.
- **`BookedType`**: `{ bookingId: string; serviceName: string; startsAt: string (ISO-8601 with
  offset); timeZone: string (IANA) }`. Never the customer's name, email, phone, address or answers.
- **After a booking (201)**: `onBooked` is called once; then with `"stay"` the window shows its done
  screen; with `redirectTo`, the browser goes to that address (a function is called with `BookedType`
  to build it), and the window shows its done screen while the page leaves (amended in 12i.1: a
  form left on screen while the browser leaves could be pressed again). The address is the site's own code,
  so the package does not restrict it. Both are caught and logged: a thrown `redirectTo` keeps the
  visitor on the done screen, a thrown `onBooked` still sends them on (F-458, 2026-10-24: a broken
  count must not cost the thank-you page). `onBooked` runs just before the page leaves, so what it
  sends must go at once (`navigator.sendBeacon`). The booking is never retried.
- **API**: `GET /public/:slug/booking-links/:bookingLinkId/times?...&language=es` and
  `POST /public/:slug/bookings` with `"language": "es"`: only `when` changes; the stable shapes and
  error answers do not. A value other than `en` or `es` is a 400 like any other invalid field.
- **Database**: `booking.language` and `organization.language`, text, not null, `"en"` for every
  existing row. A booking's language never changes after it is made.
- **Which language an email uses**: the customer's three follow `booking.language`; the owner's
  three follow `organization.language`.

## Testing

Vitest, as the project runs it: the booking component's tests (jsdom for screens), the shared
package's, and the backend's (local Postgres, migrated and seeded). Saved tests, one per rule that
would hurt if broken: every word list complete (a type check and one test), the window in Spanish
end to end in jsdom, a form error in Spanish, `onBooked` without customer fields, the redirect (a
string and a function) and the fallback when it throws, the done screen shown with `"stay"` (it has
no test today), `when` in Spanish and the 400, the stored language and the business's as fallback,
each customer email and the owner's in the right language, the customer page's language, the
migration's existing rows. By hand: a Spanish test page on the laptop against the local API, and the
email preview script. No browser test harness exists, so none is added.

## Decisions (made while planning, Frank's to overrule)

1. **Two languages only, `en` and `es`.** A third is a word list added later, not built for now.
2. **The site picks the window's language**, not the business: one business can have an English and
   a Spanish site (the website session's point, 2026-10-23). The business setting lost: it would put
   one language on both sites.
3. **The booking carries its language to its emails and page**, the business's setting only the
   fallback. A business-wide language for emails lost: the English site's customer would get Spanish.
4. **The owner's notifications use the business's language**: the owner reads one language, whichever
   site the booking came from.
5. **Spanish in "usted"**, as ialaorden.com is written ("Agende su", "su negocio").
6. **`es-419`, Latin American Spanish, for dates**: neutral across Colombia and the rest of the
   region; `es-CO` lost, since one Spanish has to serve every Spanish-speaking business.
7. **The window keeps its own error words**, keyed by field, instead of translating the shared
   schemas: those messages are also the API's, and the dashboard's, in English.
8. **The redirect is the site's code (`afterBooking`)**, not a dashboard setting, until item 24.
9. **No Simulate page**: the language rule is three lines (window from the site, emails from the
   booking, owner from the business), drawn in each step instead.

## Amendments

- 2026-10-24, 12i.1: with `redirectTo` the done screen still shows while the browser leaves (the
  spec said it would not): nothing is left to press meanwhile. The form errors are put into Spanish
  from the shared rules' English message, with a general Spanish line for any message added later,
  instead of by field alone: one field has several messages ("Enter a name.", "That name is too
  long."). English free-times questions carry no `language`, so they stay as before; a booking always
  sends its language, so an English site of a Spanish business is answered in English (12i.3). The
  dashboard's booking preview (`/admin/booking-preview/<slug>`) gained Language and After Book
  switches, the laptop check's stand-in site.

- 2026-10-24, 12i.3: the setting's words say what it does: "Your booking emails come in"
  English or Español, with the line that customers get theirs in the language they booked in (the
  plan's "Language of the customer emails" would have been wrong: customer emails follow the
  booking). The admin client-setup form is unchanged: it sets no business-wide choice (the contact
  rule is not on it either); the setup file takes `language`. Before a booking has loaded, the
  customer page speaks the browser's language. Spanish days are lowercase inside email subjects.
  Spanish has no short zone name, so times read "GMT-6" where English reads "MDT". Texts and the
  text-reply email stay English (out of scope). Package `version` is 0.2.0; publishing waits for
  Frank's yes (12i.3.5).

## Notes for the AI

- Never stage `blueprint/ai-voice-proposal.md`.
- The window's Spanish words are written by Claude and read by Frank on the laptop check; he is the
  judge of how they sound.
- `booking-form-view.tsx`'s two long problem sentences and the "At least one is required" rule
  (feature 12f) carry over with the same meaning in Spanish.
- The customer page lives in `frontend/app/customer-booking/`, outside the dashboard's layout; its
  `lang` attribute, on its own container, follows the booking.
