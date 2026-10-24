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

## Implementation walkthrough

Feature 12i was specced heavy, three steps, and kept them, with a fourth added by Frank on the
day: 12i.1 in `639a834` (its review fixes in `09a24d4`), 12i.2 in `515f930`, 12i.3 in `296314a`
(its review fixes in `7c31df2`), and the checkpoint for the final review in `d5ec3d3`. Each step
had its own independent review; the final one, over the whole `c217353..d5ec3d3` delta, closed
nine findings and left F-463 (P2) open with two new P3s (F-467, F-468), all carried. Version 0.2.0
of `@frankdmosquera/booking-component` was published to GitHub Packages on 2026-10-24 on Frank's
yes, and the agency site moved to it on `chore/booking-window-spanish` in `agency-site-app`.

### the words (`packages/booking-component/words/`)

`BookingWordsType` holds one entry per thing the window says; `english-words.ts` and
`spanish-words.ts` are each one object of that type, so a word missing from either is a type
error, never a blank. Spanish is written in "usted". `booking-words-context.ts` hands the chosen
list to every screen; `booking-words.test.ts` checks every Spanish entry differs from English.
The old `problem-words.ts` folded into the lists.

### the window (`booking-provider/`, `booking-window/`)

`BookingProvider` takes `language` (`"en"` or `"es"`, left out English), `afterBooking`
(`"stay"` or `{ redirectTo }`, a string or a function of the booking) and `onBooked`, which hears
the booking's id, service, start and zone, never the customer. A throwing `onBooked` still sends
the visitor on; a throwing `redirectTo` keeps the window's own confirmation (F-458). The dialog
carries `lang` (F-459). Day, month and zone names format with `en-CA` or `es-419`; Spanish names
stay lowercase mid-sentence and are capitalized only where they start a line (F-457). Spanish has
no short zone name, so its times read "GMT-6". The form's errors are put into Spanish from the
shared rules' English message, with a general Spanish line for any message added later.

### the times on a phone (12i.2)

Below 760px the window fills the screen and the calendar and a day's times take turns: picking a
day opens its times as one scrolling list with the day's name and a Back to the calendar
(`day-times-view.tsx`, the `sa-pick--day` class); a big screen keeps both side by side. F-467
(open) is the one case where this leaves no way back.

### the API (`packages/shared`, `backend/`)

The free-times query takes `language` (English questions send none, so they are unchanged) and
the booking body always sends it; anything but `en`/`es` is the route's usual 400.
`format-booking-time.ts` and `local-start-times.ts` write `when` in the asked language. Migration
0031 adds `organization.language` and `booking.language`, `text default 'en' not null` with
`in ('en','es')` checks, so every existing row is English. `bookTime` stores the window's language,
or the business's when none is sent (the owner's own bookings, an older window).

### the emails and the customer's page

`email-words.ts` holds both languages for the six booking emails. The customer's three
(confirmation, moved, cancelled), their subjects, `<html lang>` and the attached invite's summary
(F-462) follow the booking's language; the owner's three follow the business's.
`findBookingEmailContext` and `findBookingPage` carry both. The customer's cancel and move page
(`frontend/components/customer-booking/`) answers in the booking's language with its own `lang`
on its container; before a booking loads it speaks the browser's language, with `lang` and the tab
title set (F-464), using `useSyncExternalStore` with an English server snapshot.

### the setting

Settings, Booking form page: "Your booking emails come in" English or Español, saved through
`PUT /settings/booking-form/rules` (partial save keeps it). The client setup file takes
`language`, applied only while the business has no service. The admin setup form is unchanged.
The dashboard's booking preview gained Language and After Book switches, the laptop check's
stand-in site.

## Findings

### 12i/F-457 [P3] closed - Spanish month and day names keep their capital in the middle of a sentence: "No quedan horarios en Octubre de 2026."

**File:** packages/booking-component/booking-window/month-calendar/format-month-name.ts:12; format-day-name.ts:14; used mid-sentence at screens/month-layout/month-service-screen.tsx:163, month-details-screen.tsx:70, day-times-view.tsx:47
**Found:** 2026-10-24 by /audit independent current (scope: c217353..639a834; lenses: quality, security, performance, tests)
**Why it matters:** `formatMonthName` and `formatDayName` always run `capitalized()`, which is right where the name starts a line (the calendar heading "Octubre de 2026", a day button's label). But the same names are put inside sentences: `noTimesLeftIn` shows "No quedan horarios en Octubre de 2026.", the details rail shows "10:00 a.m., Miércoles, 14 de octubre", and the Next button's label reads "Siguiente: Miércoles, 14 de octubre a las ...". In Spanish, month and weekday names are lowercase mid-sentence, so a Spanish reader sees a spelling mistake on the screen a customer meets when a month is full. English is unaffected (its names are capitalized anyway).
**Suggested fix:** Capitalize only where the name starts the line: return the plain Intl text from the two formatters and capitalize at the heading and the day button's label (or give each formatter a "starts the line" choice). Add the "no times left" sentence to the Spanish window test.
**Resolution:** Fixed 2026-10-24 on feature/12i: `formatDayName` and `formatMonthName` return the names as Intl writes them; the calendar heading, a day button and the times heading capitalize where the name starts a line. The Spanish form test reads "10:00 a. m., miércoles, 14 de octubre" in the rail. Re-reviewed 2026-10-24 by /audit independent current (c217353..d5ec3d3), closed: format-day-name.ts and format-month-name.ts return Intl's own lowercase Spanish; capitalized() is applied only at line starts (month-calendar-view.tsx heading and day aria-label, day-times-view.tsx heading, change-time-panel.tsx day heading); noTimesLeftIn, nextAt and the details rail get the plain names. No new defect.

### 12i/F-458 [P3] closed - A thrown onBooked still sends the visitor on, where the spec says the window falls back to its done screen; no test covers it

**File:** packages/booking-component/booking-window/booking-window.tsx:160-182; blueprint/context/current-feature.md (Data / contracts, "After a booking (201)")
**Found:** 2026-10-24 by /audit independent current (scope: c217353..639a834; lenses: quality, security, performance, tests)
**Why it matters:** The spec says "A thrown `onBooked` or `redirectTo` is caught and logged, and the window falls back to its done screen". The code catches a thrown `onBooked` and then redirects anyway; only a thrown `redirectTo` (or `goTo`) costs the redirect. The comment above it says "a site's code that throws only costs the redirect". The one test throws from both at once, so it cannot tell the two readings apart. Redirecting anyway is arguably the better behaviour (a broken analytics call should not cost the thank-you page), but this is the contract every site builds on, and it is published in 0.2.0. Related: `onBooked` runs straight before `window.location.assign`, so anything asynchronous it starts (a `fetch`, an analytics call) may be cut off by the navigation; neither the spec nor the `index.ts` header says so.
**Suggested fix:** Decide which reading is the contract, write it in the spec and the comment, and add one test: `onBooked` throws, `redirectTo` is a string, and the expected `goTo` call (or none). In the `index.ts` header, say that `onBooked` must finish synchronously (or use `navigator.sendBeacon`) when a redirect follows.
**Resolution:** Fixed 2026-10-24 on feature/12i, decided as the code was: a throwing onBooked still sends the visitor on (a broken count must not cost the thank-you page), a throwing redirectTo keeps the confirmation. The comment, the spec's contract and the index.ts header say so; the header adds that onBooked must send at once (navigator.sendBeacon) before the page leaves. A new test throws from onBooked alone and sees the redirect. Re-reviewed 2026-10-24 by /audit independent current (c217353..d5ec3d3), closed: booking-window.tsx booked() catches onBooked and still calls goTo; a throwing redirectTo is caught and the done screen stays. The comment, the spec's contract and the index.ts header (sendBeacon) agree; booking-window-language.test.ts "still goes to the thank-you page when the site's onBooked throws" pins it and passes.

### 12i/F-459 [P3] closed - The window's dialog carries no lang, so a Spanish window on a page in another language is read aloud with the page's pronunciation

**File:** packages/booking-component/booking-window/booking-window.tsx:186-188
**Found:** 2026-10-24 by /audit independent current (scope: c217353..639a834; lenses: quality, security, performance, tests)
**Why it matters:** The window's language is now the site's prop, independent of the page's `<html lang>`. Where they differ (the booking preview's Español switch on the English dashboard, or a site that passes `language="es"` on an English page), screen readers read Spanish words with English rules (WCAG 3.1.2, language of parts). The spec already gives the customer page its own `lang` in 12i.2 for this reason; the window has nothing.
**Suggested fix:** Put `lang={words.language}` on the `<dialog>`, and check it in the Spanish window test.
**Resolution:** Fixed 2026-10-24 on feature/12i: the dialog carries `lang={words.language}`; the Spanish window test checks lang="es". Re-reviewed 2026-10-24 by /audit independent current (c217353..d5ec3d3), closed: the dialog carries lang={words.language}; booking-window-language.test.ts checks lang="es". Passes.

### 12i/F-460 [P3] closed - Two Done when proofs are thinner than written: no test refuses a bad language on the booking route, and some screens are never drawn in Spanish

**File:** backend/routes/public-bookings-routes.test.ts:268-275; packages/booking-component/booking-window/booking-window-language.test.ts
**Found:** 2026-10-24 by /audit independent current (scope: c217353..639a834; lenses: quality, security, performance, tests)
**Why it matters:** The Done when asks for "a 400 for any other value" and "every screen's words in both languages". The 400 is tested on the free-times route only. `POST /public/:slug/bookings` with `language: "fr"` is refused only because it shares the schema, and nothing (route or `create-booking-validation-schema` test) pins it, so a later edit to the booking body's schema could drop the check unnoticed. The Spanish jsdom test walks the month screen, the form and the done screen. The service list, the loading screen, the problem screen, the person choice and the time-taken notice are never drawn in Spanish. `booking-words.test.ts` checks that each word differs, which proves the list but not that every screen reads it. The grep this review ran found no English left in those screens, so the gap is in the proof, not (today) in the window.
**Suggested fix:** Add one booking-route test (or a schema test) for `language: "fr"` getting the usual 400, and one jsdom render of the service list (no `bookingId`) and of a problem screen with `spanishWords`.
**Resolution:** Fixed 2026-10-24 on feature/12i: a booking-route test refuses language "fr" with the usual 400; new jsdom tests draw the loading screen, the service list, the person choice, the nothing-to-book screen and a time taken in Spanish. Re-reviewed 2026-10-24 by /audit independent current (c217353..d5ec3d3), closed: public-bookings-routes.test.ts refuses language "fr" with { bad_request, "Use en or es." }; booking-window-language.test.ts draws loading, service list, person choice, nothing-to-book and time-taken in Spanish. All pass.

### 12i/F-461 [P3] closed - The window's jsdom tests missed their 1-second wait on one cold run

**File:** packages/booking-component/booking-window/booking-window.test.ts:113, 158, 230
**Found:** 2026-10-24 by /audit independent current (scope: c217353..639a834; lenses: quality, security, performance, tests)
**Why it matters:** On this review's first run of `npm run test --workspace=@frankdmosquera/booking-component`, two tests failed: "hides Back to the times while a lost answer is unknown" (`findByRole("button", { name: "10:00 a.m." })` gave up after its default 1 s with the dialog still empty) and "gives each opening of the window its own form key" (5 s test timeout). Two immediate reruns passed 93/93 in about 4 s. This step added a second jsdom window file running in parallel, which adds load. A gate that fails without a code change costs a step's flow and teaches people to rerun. Missing validation: whether it repeats on a cold or busy machine.
**Suggested fix:** If it repeats, give the window tests' first `findByRole` a longer `timeout` (or set `asyncUtilTimeout` once for the package), rather than rerunning until green.
**Resolution:** Fixed 2026-10-24 on feature/12i: both window test files set Testing Library's wait to 3 seconds (configure asyncUtilTimeout), so a cold first run no longer misses the default 1 second. 97/97 on the next run. Re-reviewed 2026-10-24 by /audit independent current (c217353..d5ec3d3), closed: both window test files call configure({ asyncUtilTimeout: 3000 }); this review's first, cold run of the package tests passed 98/98.

### 12i/F-462 [P2] closed - A Spanish customer's calendar invite still reads "<service> with <business>"

**File:** backend/lib/email/booking-ics.ts:40; attached by backend/lib/email/send-booking-emails.ts:57-75, send-move-emails.ts and send-cancellation-emails.ts
**Found:** 2026-10-24 by /audit independent current (scope: c217353..296314a; lenses: quality, security, performance, tests)
**Why it matters:** Every customer confirmation, move and cancellation carries `invite.ics`, and its `SUMMARY` is always `${service} with ${businessName}`. A Spanish booking now gets a Spanish email whose attached invite drops "Exterior painting estimate with Primo Painters" into the customer's calendar, where it stays long after the email is read. The spec's goal is that "that customer's confirmation, move and cancel emails ... are in Spanish too"; its Out of scope names only the owner's Google calendar event and texts, and the 12i.3 amendment lists texts and the text-reply email as staying English, not the customer's invite. So this is an unlisted English line in the one artifact a Spanish customer keeps.
**Suggested fix:** Give `bookingIcs` the booking's language and take the joining word from the email words (`con` in Spanish), or write the summary as the service and the business without a joining word; add one assertion to the Spanish email test or `booking-ics.test.ts`. If it is meant to stay English, add it to the spec's Out of scope.
**Resolution:** Fixed 2026-10-24 on feature/12i: the invite takes the booking's language; a Spanish SUMMARY reads "<service> con <business>"; all three senders pass it; a test checks it. Re-reviewed 2026-10-24 by /audit independent current (c217353..d5ec3d3), closed: bookingIcs takes language (required in its input type, so tsc forces every caller); send-booking, send-move and send-cancellation pass facts.language; booking-ics.test.ts checks the Spanish SUMMARY. Passes.

### 12i/F-464 [P3] closed - Before the booking loads, and on its failure screens, the customer page speaks the browser's language with no lang, under an English tab title

**File:** frontend/components/customer-booking/customer-booking-screen.tsx:40-44, 63, 72, 86; frontend/app/customer-booking/layout.tsx:8
**Found:** 2026-10-24 by /audit independent current (scope: c217353..296314a; lenses: quality, security, performance, tests)
**Why it matters:** The amendment says the page speaks the browser's language before a booking has loaded, so a Spanish browser sees "Un momento…", "Este enlace no funciona" or "Su reserva no puede cargar". Only the loaded booking's frame gets `lang` (line 190); these three frames get none, so they sit under the root layout's `<html lang="en">` and a screen reader reads the Spanish with English rules, the same gap F-459 fixed on the window. The tab also keeps the layout's English "Your booking" on those screens, since `document.title` is set only once a booking has loaded. Small and short-lived on the loading screen, but the "link doesn't work" screen is where a customer stays.
**Suggested fix:** Pass `lang={language}` to the three early `CustomerBookingFrame`s and set `document.title` from the words in `CustomerBookingScreen` as well (or leave the title neutral).
**Resolution:** Fixed 2026-10-24 on feature/12i: the loading, broken-link and cannot-load screens carry lang, and the tab reads "Su reserva" / "Your booking" before a booking loads. Re-reviewed 2026-10-24 by /audit independent current (c217353..d5ec3d3), closed: customer-booking-screen.tsx passes lang to the loading, not-found and unreachable frames and sets document.title from the words before a booking loads; useSyncExternalStore's server snapshot "en" avoids a hydration mismatch. Frontend build passes.

### 12i/F-465 [P3] closed - A few Spanish lines read wrong: a capital day in the confirmation's preview, "lo" and "-lo" for every customer, "no puede cargar", "4 oct al 10"

**File:** backend/emails/booking-confirmation.tsx:59; backend/emails/email-words.ts:132, 152; frontend/components/customer-booking/customer-booking-words.ts:115, 152, 155; frontend/components/customer-booking/change-time-panel.tsx:44
**Found:** 2026-10-24 by /audit independent current (scope: c217353..296314a; lenses: quality, security, performance, tests)
**Why it matters:** Read in the email preview and the word lists. (1) The confirmation's inbox preview is `${service}, ${when}` without `inLine`, so it shows "Exterior painting estimate, Jueves, 8 de octubre" while the moved and cancelled previews lowercase the day (the amendment's rule). (2) "lo espera a la nueva hora" and "llame para contactarlo" address every customer as a man; "le espera" / "para contactar a {name}" read neutral. (3) "Su reserva no puede cargar" and "Los horarios libres no pueden cargar" are calques; Spanish says "no se puede cargar" / "no se pueden cargar". (4) The week name builds "4 oct al 10" (Intl puts the day first in Spanish), where a reader expects "4 al 10 de oct." Frank is the judge of how it sounds (Notes for the AI); these are the lines worth his look.
**Suggested fix:** Use `inLine(when)` in the confirmation's preview through a `bookedPreview` word; reword the two gendered lines and the two "cargar" lines; for Spanish, build the week as day-to-day then month (or `Intl.DateTimeFormat.formatRange`, which writes it the locale's way).
**Resolution:** Fixed 2026-10-24 on feature/12i: the confirmation's inbox line keeps the day lowercase in Spanish; "Su nueva hora con <negocio> está confirmada" and "llame para comunicarse" address no gender; "No se puede cargar"; a Spanish week reads "4 al 10 oct". Re-reviewed 2026-10-24 by /audit independent current (c217353..d5ec3d3), closed: confirmation preview goes through bookedPreview with inLine(); the two gendered lines and the two "cargar" lines are reworded in email-words.ts and customer-booking-words.ts; formatWeekName writes "4 al 10 oct" for Spanish. No new defect.

### 12i/F-466 [P3] closed - The booking body's schema still says a left-out language means English, but the booking now stores the business's

**File:** packages/shared/zod-validation/booking-links-validation-schemas/create-booking-validation-schema.ts:53
**Found:** 2026-10-24 by /audit independent current (scope: c217353..296314a; lenses: quality, security, performance, tests)
**Why it matters:** The comment beside the shared contract reads "left out = English". Since 12i.3 the route stores `body.language ?? null` and `bookTime` falls back to the business's language, while the answer's `when` is still written in English. So a booking from an older window at a Spanish business answers in English and emails in Spanish. That is the spec's rule, but the one comment a reader of the contract sees says otherwise.
**Suggested fix:** Say it as it is: "left out: `when` in English, and the booking keeps the business's language (an older window)".
**Resolution:** Fixed 2026-10-24 on feature/12i: the comment says a booking with no language takes its business's. Re-reviewed 2026-10-24 by /audit independent current (c217353..d5ec3d3), closed: create-booking-validation-schema.ts:53 now reads "left out, the booking takes its business's", matching public-bookings-routes.ts (body.language ?? null) and book-time.ts (?? businessLanguage).

## Independent review

**Status:** passed
**Target commit:** d5ec3d3a4c86bf3b5cb5a6f4e78ecbf41616fa60
**Base commit:** c2173536dc775768d51b40250145b611b0a2f9df
**Base ref:** main
**Spec hash:** fd1de954ae5da7108dd31dfb22eb5e36034741682427e88f3fbe75746ab50fe5
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-24T04:47:09Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-24T04:53:11Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain`: pass (HEAD, merge base and spec hash match the request; only review.md differed)
- `npm run db:migrate --workspace=@scheduleads-app/shared` (local `scheduleads_dev` on 127.0.0.1): pass (0031 applied)
- `npm run test --workspace=@scheduleads-app/shared`: pass (203/203)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (98/98, first cold run)
- `npm run test --workspace=backend`: pass (91 files, 1061/1061)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=@frankdmosquera/booking-component`: pass (dist imports only react, react-dom, hono, zod; d.ts exports language, afterBooking, onBooked, BookedType, AfterBookingType)
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass
- `/check`: not run (not required by the request)

### Evidence

- Whole delta c217353..d5ec3d3 read (95 files, 6 commits): shared schemas, migration 0031 and snapshot, format-booking-time, client setup; backend routes, book-time, booking page, email facts, the six emails and email-words, ics, settings; frontend customer page, its words, settings card, booking preview; the package's words, provider, window, every screen, api-client, CSS and index.ts header.
- Language rule traced end to end: window `language` -> free-times query (non-English only) and booking body (always) -> `bookTime` stores `input.language ?? organization.language` -> page, move times and customer emails/ics use `booking.language`; owner's three use `organization.language`. Schema refuses anything but en/es on query, body, settings and setup file; DB check constraints match.
- Security: onBooked's BookedType carries id, service, start and zone only; settings rules route keeps CHANGE_BUSINESS; booking preview renders the `booked` query value as React text only; redirectTo is the site's own code by spec.
- Shared rules' form messages compared with the Spanish formErrors map: every message a field can show is mapped; the rest fall to the general line.
- Fixed entries F-457, F-458, F-459, F-460, F-461, F-462, F-464, F-465, F-466 re-examined against the new code and closed with evidence in the ledger; F-463 re-examined and still open.
- Intl cost measured in Node: 42 `formatDayName` constructions plus formats about 3.4 ms (F-468).
- No `.skip`, `.only` or `todo` in the feature's tests.

### Findings

- F-457 [P3] closed
- F-458 [P3] closed
- F-459 [P3] closed
- F-460 [P3] closed
- F-461 [P3] closed
- F-462 [P2] closed
- F-463 [P2] open (re-examined: emails from the database, the owner's booking and the setup file's language still untested)
- F-464 [P3] closed
- F-465 [P3] closed
- F-466 [P3] closed
- F-467 [P3] open (new: on a phone, an open day in a month with no times left hides the calendar with no way back)
- F-468 [P3] open (new: day and month formatters built per call, about 42 per calendar draw)

### Remaining risk

- `/check` not run (not required): the phone layout and the redirect were not seen in a real browser; jsdom applies no CSS, so F-467 rests on code reading.
- No browser test harness exists, so the Spanish window end to end is proved only in jsdom.
- The 0.2.0 publish to GitHub Packages was not verified: checking the registry needs the network, not used in this review.
- No test reads the migration's existing rows; the `DEFAULT 'en' NOT NULL` in 0031 is the only proof they are English.
- F-463's gaps: a swap of the booking's and the business's language inside `findBookingEmailContext` would pass every test.
