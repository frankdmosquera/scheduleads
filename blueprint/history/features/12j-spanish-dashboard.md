# Feature: Spanish dashboard

**From build-plan:** feature 12j

**Size:** heavy - three separate risks: a stored per-login setting behind a new route and the
sign-in, every dashboard screen's words and dates moved into word lists, and the messages that
come from the API and the shared rules.

**Status:** verified

**Branch:** feature/12j-spanish-dashboard

## Goal

The dashboard speaks Spanish as well as English: every screen's words, its dates and times, its
form errors, the API's refusals and the sign-in pages. Each login picks its own language (plan
decision 30: a setting, never one rule for all), so two people in one business can each read
their own. It is not the business's language, which 12i keeps for the customer and for the
owner's booking emails. IA a la Orden is the first business that runs its day in Spanish.

## In scope

- One language per login, stored on the login, `en` or `es`, or not picked yet.
- A login that has not picked follows its browser: Spanish when the browser's first language is
  Spanish, English otherwise. Once picked, the pick wins on every device.
- An English | Español switch in the dashboard frame, beside Sign out, open to every login
  (owners and members alike). It saves at once and the screen changes without a reload.
- The sign-in pages (email step, code step) in the browser's language, with the same switch,
  kept in the browser only until sign-in.
- The sign-in code email in the login's language: its pick, else the language of the sign-in page
  that asked for it, else English.
- Every signed-in screen in both languages: the gate's screens (loading, signed out, pick a
  business, plan refused, API down), the frame, home, leads list, a lead's page, the schedule,
  and the eight Settings screens (hours, days off, services, people, booking form, texts,
  calendar, and the Settings index).
- Dates and times written through each language's locale (Spanish `es-419`, English as today).
- Form errors from the shared rules and the API's refusals shown in the login's language;
  holiday, country and province names in it where the holiday library offers them.

## Out of scope

- A third language. One more word list later; nothing is built for it now.
- The platform admin pages (`/admin/client-setup`, `/admin/booking-preview`): only Frank uses
  them; they stay English.
- The booking window and the customer's booking page (done in 12i).
- The owner's booking emails: they keep the business's language (12i's Booking form setting).
- Words a business typed itself (service, person and place names, its booking questions, its
  texts): shown as typed, never translated.
- Money: no dashboard screen shows an amount today; quotes (feature 16) use the words' locale
  when they come.

## Build loop

`workflow.stepReview` is `every` and the spec says heavy, so each step is reviewed on its own.
After the green light, nothing stops until the review: each step runs from its plan's yes through
build, tests, the box ticked, the build log entry, commit and push to
`feature/12j-spanish-dashboard`, `/audit` scoped to the step, then the independent review. The
stop is after the review, where findings are talked through; P0/P1 are fixed by default. The only
earlier stops are the three in `AGENTS.md`: the plan turns out wrong, a line only Frank crosses,
blocking findings. `/complete` makes the final feature commit and merges on Frank's yes. Migration
0032 must be applied on live, by hand through the tunnel, before the merge deploys the API (as
0031 was for 12i).

## Build steps

- [x] **12j.1 Each login's language.** The stored choice and the frame around every screen.
  - `user.language` (text, `en` | `es`, null = not picked; a check constraint like 12i's),
    migration `0032`, declared to Better Auth as an additional user field with `input: false`,
    so no Better Auth endpoint can set it and the session's user carries it.
  - `GET /me` adds `user.language` (null when not picked). `PUT /me/language` with
    `{ "language": "en" | "es" }` sets the signed-in login's own language and nothing else: the
    login comes from the session, never from the body; 400 `bad_request` "Use en or es." for
    anything else; 401 signed out; CSRF and no-store as every dashboard route.
  - `pickDashboardLanguage(saved, browserLanguages)` in `packages/shared/helpers/`: the saved
    pick, else `es` when the browser's first language starts with `es`, else `en`.
  - The dashboard's word lists, `frontend/lib/dashboard-words/`: one `DashboardWordsType`, an
    English and a Spanish object (a word left out is a type error, as 12i's), and a
    `DashboardWordsProvider` with `useDashboardWords()`, mounted in the root layout so the gate
    and the sign-in pages read it too.
  - The switch (`language-switch.tsx`) in the frame beside Sign out, and on the sign-in card.
    Signed in, it calls `PUT /me/language` and changes the screen once saved; refused, the
    screen keeps its language and says so. Signed out, it is kept in the browser
    (`localStorage`, wrapped in try/catch), read only before sign-in.
  - The sign-in code email in the login's language (`sendLoginCode` reads the login's pick, else
    the sign-in page's `Accept-Language`; check in this step that Better Auth hands the request
    to `sendVerificationOTP`). Still not awaited, so a known address answers as fast as an
    unknown one.
  - In Spanish in this step: the sign-in pages, the gate's screens, the frame and its menu, home.
  - **Done when:** on http://localhost:3400, a login with no pick in a Spanish browser sees the
    sign-in page and the frame in Spanish; the switch to English saves, survives a reload and a
    second browser; `owner@example.com` and `admin@example.com` each keep their own; the sign-in
    code email for a Spanish login is in Spanish. Saved tests: the route (sets own login only,
    400 for `fr`, 401 signed out, the value read back on `/me`), the pick rule, the code email's
    language. All suites, builds, lint and format pass.

- [x] **12j.2 Every screen in Spanish.** The words and dates of every signed-in screen.
  - Every screen listed under In scope reads its words from `useDashboardWords()`; no English
    sentence stays written into a screen.
  - Dates and times through the words' `intlLocale`: `format-lead-time.ts`,
    `calendar-day-words.ts` and the screens that format their own (the schedule's week, a lead's
    timeline, closed days, notice).
  - The shared helpers that write words for the dashboard take the language (the date formatters).
    The API calls' own message, `apiNotRespondingMessage`, moves to 12j.3 (changed in 12j.2's plan,
    Frank's yes, 2026-10-24): it reaches a screen the way the API's refusals do, so it goes through
    12j.3's one table instead of being translated twice.
  - Each area's words in a file of its own under `frontend/lib/dashboard-words/` (leads, schedule,
    hours, days off, people, services, booking form, texts, calendar, the Settings frame, the Setup
    cards), each one type with its English and Spanish objects, joined into `DashboardWordsType`.
  - **Done when:** each screen opened in Spanish on http://localhost:3400 shows no English
    except the business's own words and the API's messages (12j.3); the same screens in English
    are unchanged; `npm run build --workspace=frontend` fails when a Spanish word is removed and
    passes again when restored. All suites, builds, lint and format pass.

- [x] **12j.3 The API's messages and the form errors in Spanish.**
  - One table of Spanish for every message the shared rules and the API's dashboard routes can
    send, keyed by the English message (functions for those carrying a value), in
    `packages/shared/helpers/`. The dashboard shows a refusal or a form error through it when
    the login speaks Spanish; a message missing from the table shows in English, never blank.
  - A saved test in `packages/shared` collects every message literal in the shared rules and in
    the backend's refusals and fails on any without Spanish, so a new English refusal cannot ship
    untranslated (proved able to fail).
  - Holiday, country and province names on Days off in the login's language: the holidays route
    takes `language`; `date-holidays` names them in Spanish where it has them (check in this
    step), English where it does not.
  - **Done when:** in Spanish, a refused save (a name already taken), a form error (a window
    that ends before it starts) and the API down show Spanish; Days off lists Colombia's holidays
    in Spanish; English is unchanged. All suites, builds, lint and format pass.

## Files / areas

- `packages/shared/db/auth-tables/user-table.ts`, `packages/shared/migrations/0032_*.sql`
- `packages/shared/helpers/` (the pick rule, the Spanish message table, their tests)
- `backend/lib/auth/auth-server.ts` (additional field, the code email's language),
  `backend/app.ts` (`/me`, `/me/language`), the login code email and its words in
  `backend/emails/`, the holidays route in `backend/routes/settings-routes.ts`
- `frontend/lib/dashboard-words/` (new), `frontend/app/layout.tsx`,
  `frontend/components/dashboard/`, `frontend/components/sign-in/`,
  `frontend/components/auth/`, `frontend/components/leads/`, `frontend/components/schedule/`,
  `frontend/components/settings/`, `frontend/components/calendar/`,
  `frontend/components/email-sending/`, `frontend/components/booking-links/`,
  `frontend/components/centred-card/`, `frontend/lib/` formatters and `api-client/` refusal
  readers, `frontend/lib/api-client/dashboard/` (the language call)

## Data / contracts

- `user.language`: `text`, nullable, check `language in ('en','es')`. Every login before 12j is
  null (follows its browser). Never set by Better Auth; only `PUT /me/language` writes it.
- `GET /me` 200: `user` gains `language: "en" | "es" | null`.
- `PUT /me/language` body `{ language: "en" | "es" }` -> 200 `{ language }`; 400
  `{ error: { code: "bad_request", message: "Use en or es." } }`; 401 signed out (middleware).
  Idempotent: the same value twice is two 200s.
- Holidays route: optional `language` query, `en` | `es`, default `en`; anything else 400.
- Words: `DashboardWordsType` with `intlLocale` (`en-CA` English as today, `es-419` Spanish);
  Spanish in "usted", as 12i.
- Rendering: every word and every API message is rendered as React text, never as HTML.

## Testing

- `packages/shared`: the pick rule (saved wins; `es-CO` browser gives `es`; `fr` gives `en`; no
  browser languages gives `en`); the message table's completeness test.
- `backend`: `PUT /me/language` and `GET /me` against the seeded `scheduleads_dev` (own login
  only, 400, 401, idempotent, read back), the code email's language, the holidays route's
  language.
- Frontend: no test runner; the word lists are proved by the type check (one object per
  language) and each screen by hand on http://localhost:3400, both languages.

## Notes for the AI

- Copy 12i's shape: `packages/booking-component/words/` and
  `frontend/components/customer-booking/customer-booking-words.ts` (one object per language,
  `usted`, `es-419`).
- The customer booking page keeps its own words; do not merge it into the dashboard's.
- Never read the language from the request body for whose login it is: the session's user only.
- The language picked on the sign-in page (`localStorage`) counts as the browser's language, also
  after sign-in for a login that never picked (changed in 12j.1: forgetting it at sign-in would open
  an English dashboard right after a Spanish code email). Signed in, a saved pick always wins.
</content>
</invoke>

## Implementation walkthrough

Feature 12j was specced heavy, three steps, and kept them: 12j.1 in `fe03a61` (its review fixes
in `4bcce66`), 12j.2 in `0acd574` (review fixes in `f75afd3` and `12b1611`), 12j.3 in `6e24d7e`
(review fixes in `368eb42`, `d3da094`, `1811dcc`, `08551a9` and `247d810`). Between 12j.2 and
12j.3, Frank's walk through the screens added the Calendar's Day, Week and Month views
(`ec5f6f0`, `81749cb`, `06c05ec`), which the spec does not record (F-486, open): they are written
down here instead. The final independent review, over the whole `576bdaf..247d810` delta, passed;
it closed F-483 and F-484 and left F-485 (P2) and F-486 (P3) open, carried.

### each login's language (12j.1)

Migration 0032 adds `user.language`, `text` with an `in ('en','es')` check and no default, so a
login that never picked one stays null. Better Auth knows the field as `input: false`, so no
sign-in or profile call can set it; only `PUT /me/language` does, from the session's own login,
behind the `/me/*` CORS, CSRF and no-store guards. `pickDashboardLanguage` (shared) decides what
the dashboard speaks: the login's own pick, else its browser's first language, Spanish when it is
Spanish, English otherwise. The sign-in page has its own switch; its pick is kept in the browser
until sign-in (`sign-in-language-pick.ts`, every storage call allowed to fail) and is forgotten on
"Sign in again" and on sign-out, so it never saves to a login that has ended (F-469). The sign-in
code email is written in the login's pick, else the asking page's language, else English
(`login-language-of.ts`), and it is still sent unawaited so a known address answers as fast as an
unknown one (`login-code-timing.test.ts`, F-470).

### every screen in Spanish (12j.2)

`DashboardWordsType` composes one word file per area (`leadsWords`, `scheduleWords`, `hoursWords`,
`daysOffWords`, `peopleWords`, `servicesWords`, `bookingFormWords`, `textsWords`,
`calendarSettingsWords`, `settingsFrameWords`, `setupCardsWords`), each with its own type and an
English and a Spanish object, so a missing word is a type error. The `Words` suffix keeps the area
keys apart from the menu's own words. `DashboardWordsProvider` hands the list and `intlLocale` to
every screen; `DashboardLanguageFrame` marks the pages with `lang`. Spanish is "usted". The left
column became fixed on a laptop (`md:sticky md:h-screen`), with the language switch under the
business and Sign out at the bottom. One Spanish name for a person's time off, "No disponible",
across the Calendar (F-472), and one for the off state across Settings (F-473). Ready-made booking
questions are named in the login's language and filled in the business's, the language its
customers read (F-471, F-481). Default lead stages stay as stored, English (F-474, accepted).

### the Calendar views (from the walk, not in the spec)

`schedule-screen.tsx` gained a Day, Week and Month toggle, and Book by hand and Time off became
toggle buttons with a legend. Day and Week draw a time grid (`schedule-time-grid.tsx`) whose
header row and hour column stay in view while it scrolls, with overlapping items side by side in
lanes. Month (`schedule-month-grid.tsx`) shows four to six weeks and asks the week route with
`google=skip`, so Google is not read for times it never shows (F-480). The date arithmetic is
hand-written in `frontend/lib/calendar-dates.ts`, in the business's time zone. While the next days
load, the old calendar stays on screen, dimmed, so the page never jumps; Today and the person
picker always send a date (F-476).

### messages from the API and the shared rules (12j.3)

`packages/shared/helpers/spanish-messages.ts` holds about 220 English messages with their Spanish,
`{}` standing for a value; a value that is a text's own date ("Mon Oct 26, 9:00am") is put into
Spanish too. The dashboard's API client translates the `message` of every error answer through a
custom fetch (`/admin` paths left English); `dashboardFormResolver` does the same for the forms'
own checks, and the client's fallback lines go through `inDashboardLanguage`. The language comes
from `message-language.ts`, a store the provider sets in a layout effect, so the first read on a
page already has it. `spanish-messages.test.ts` reads the API's refusals, the shared rules and the
client by pattern and fails on any English message with no Spanish (F-478). Holidays keep their
English names as the saved picks; their shown `label` comes from date-holidays' Spanish lists, and
country names from `Intl.DisplayNames`. The Days off routes take `language`, every answer names
its days in it, and the screen and its holiday picker read again on a switch while keeping what is
unsaved (F-477, F-483).

### still open

F-485: the sign-in and business-picker screens use Better Auth's own client, which skips the
translating fetch, so a wrong or expired code reads "Invalid OTP" on the Spanish page. Migration
0032 must be applied on live before this merge deploys the API.

## Findings

### 12j/F-469 [P2] closed - After "Sign in again" from a dashboard screen, the sign-in page's language switch tries to save to the login that has ended

**File:** frontend/lib/dashboard-words/dashboard-words-provider.tsx:69, 77; frontend/components/language-switch/language-switch.tsx:27; frontend/components/centred-card/refusal-notice.tsx:17; frontend/components/dashboard/dashboard-gate.tsx:60
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..fe03a61; lenses: quality, security, performance, tests)
**Why it matters:** The provider lives in the root layout and counts a login as signed in while `loginLanguage !== undefined`. Only `SignOutLink` calls `forgetLoginLanguage`. When a sign-in ends on its own, a screen shows `RefusalNotice`, whose "Sign in again" is a client-side `Link` to `/sign-in`, so the provider keeps the old login's language and `signedIn: true`. On the sign-in page the switch then calls `PUT /me/language`, gets 401, and says "Your language could not be saved" instead of keeping the pick in the browser, as the spec's "Signed out, it is kept in the browser" requires. The page also shows the ended login's language rather than the sign-in pick or the browser's, and sends that as the code email's `Accept-Language`. The gate's `signed-out` result (after "Try again" or a business pick) has the same gap. A reload clears it. Code-path evidence; not seen in a browser.
**Suggested fix:** Forget the login's language whenever the screen knows the login is gone: call `forgetLoginLanguage()` when the sign-in page mounts (it is only reached signed out) and in the gate's `signed-out` case, or have `DashboardSignedOutScreen` do it before it redirects.
**Resolution:** Fixed 2026-10-24 (12j.1 review fixes): the sign-in page forgets the last login's language when it opens (`frontend/app/sign-in/page.tsx`), and the gate forgets it on a signed-out answer (`dashboard-gate.tsx`). Reproduced first on http://localhost:3400 (session ended in the dev database, Sign in again, English gave PUT /me/language 401 and "No se pudo guardar su idioma"); after the fix the same path switches the page to English, saves `en` in the browser and sends no PUT. Closed 2026-10-24 by /audit independent current (576bdaf..0acd574): re-read `frontend/app/sign-in/page.tsx:18-20` and `frontend/components/dashboard/dashboard-gate.tsx:44`; `forgetLoginLanguage` is a stable `useCallback` in `dashboard-words-provider.tsx:69`, so neither effect loops, and the gate's next `ok` answer sets the login's pick again after a sign-in. The original path is gone and the repair adds no new one.

### 12j/F-470 [P3] closed - No saved test carries the sign-in page's Accept-Language through Better Auth to the code email's language

**File:** backend/lib/auth/auth-server.ts:164-166; backend/app-me.test.ts:177-194; backend/lib/auth/send-login-code.test.ts:63-77
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..fe03a61; lenses: quality, security, performance, tests)
**Why it matters:** The tests prove `loginLanguageOf` (pick, else header, else English) and `sendLoginCode` with a stubbed `languageOf`, but the one line that joins them, `ctx?.headers?.get("accept-language")`, is untested. Better Auth 1.7.5 passes the endpoint context as an optional second argument (`ctx?: GenericEndpointContext`); if an upgrade stopped passing it, or the header name drifted, a Spanish login that never picked would get its code in English and every suite would still pass. The step's Done when asks for a check of exactly this hand-off.
**Suggested fix:** One test through `app.request("/api/auth/email-otp/send-verification-otp")` with `Accept-Language: es` for a seeded login with no pick, Resend faked as in `login-code-timing.test.ts`, asserting the faked call's subject is Spanish.
**Resolution:** Fixed 2026-10-24 (12j.1 review fixes): `backend/lib/auth/login-code-timing.test.ts` gains "a login code's language": a throwaway login with no pick asks the real route for a code with `Accept-Language: es-CO,es;q=0.9` and the faked Resend gets "Su código de acceso: NNNNNN"; with no header, "Your sign-in code: NNNNNN". Proved able to fail: with `ctx?.headers?.get("accept-language")` replaced by null it got the English subject and failed. Closed 2026-10-24 by /audit independent current (576bdaf..0acd574): the test (`backend/lib/auth/login-code-timing.test.ts:62-108`) goes through the real Better Auth route, inserts and deletes its own throwaway login, and passed in this pass's `npm run test --workspace=backend` (92 files, 1075 tests). The hand-off is now covered; the repair adds no new risk.

### 12j/F-471 [P2] closed - On a Spanish Booking form, the ready-made question sets stay English: "Empezar con el conjunto de painting" fills in English questions

**File:** frontend/lib/dashboard-words/booking-form-words.ts:102; frontend/components/settings/booking-questions-card.tsx:74-75, 131; backend/lib/settings/booking-question-sets.ts:13-27
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..0acd574; lenses: quality, security, performance, tests)
**Why it matters:** The step's contract is no English on a signed-in screen except the business's own words and the API's messages (12j.3). The set names come from the product's own list in `booking-question-sets.ts` ("Painting", "Clinic"), not from the business and not from an API refusal, so a Spanish owner with no questions sees two buttons reading "Empezar con el conjunto de painting" and "Empezar con el conjunto de clinic". Pressing one fills the list with "Interior or exterior?", "How many rooms?" (or the clinic pair), which a Spanish business then saves and shows to its Spanish customers in the booking window. 12j.3 lists refusals, form errors and holiday names; these sets are in neither step.
**Suggested fix:** Name each set in the words by its `trade` key (`presetName: Record<"painting" | "clinic", string>`, "pintura", "clínica") instead of the API's `name`, and give the sets their Spanish questions: either the route answers them in the login's language, or the frontend keeps one question list per language keyed by `trade`. Or record in the spec that the sets stay English until a later step.
**Resolution:** Fixed 2026-10-24 (12j.2 review fixes, Frank's yes): each set in `backend/lib/settings/booking-question-sets.ts` carries its name and questions in English and Spanish; `booking-questions-card.tsx` names the button and fills the questions in the login's language. Seen on http://localhost:3400/settings/booking-form in Spanish: "Empezar con el conjunto de pintura" / "clínica", filling "¿Tiene alergias o alguna afección de la piel?" and "¿Es su primera visita?" (not saved). Settings route tests 45 pass. Closed 2026-10-24 by /audit independent current (576bdaf..6e24d7e): `booking-question-sets.ts` carries both languages and `booking-questions-card.tsx:75, 131` names and fills the sets from them, so a Spanish owner no longer sees "painting" or English questions. Which language the sets should follow is a separate point, F-481.

### 12j/F-472 [P3] closed - "Tiempo libre" names a person's time off on the Calendar, while "libre" on the same screen means free to book

**File:** frontend/lib/dashboard-words/schedule-words.ts:124, 138, 150, 165-166, 174, 181; frontend/lib/dashboard-words/services-words.ts:121
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..0acd574; lenses: quality, security, performance, tests)
**Why it matters:** To a Latin American reader "tiempo libre" is leisure, and "libre" reads as available. On the Calendar a block labelled "Tiempo libre" means the person cannot be booked, while the Book by hand lede on the same screen says "Cualquier hora en que esta persona esté libre", meaning bookable. Services uses "Tiempo libre antes" for a third thing, the buffer kept clear. An owner can read a person's blocked afternoon as open time.
**Suggested fix:** Use one unambiguous word for time off, such as "Ausencia" (title, item label, "Guardar ausencia", "La ausencia quedó registrada") or "Tiempo no disponible", and keep "libre" for available.
**Resolution:** Fixed 2026-10-24 (Frank picked "No disponible"): a person's time off is "No disponible" on the Calendar (block, legend, button, its saved lines and the lede); "libre" is left meaning only free to book. A reason for the time off (vacation, appointment) is a later addition. Closed 2026-10-24 by /audit independent current (576bdaf..6e24d7e): `schedule-words.ts:147, 173, 200-201, 209` name a person's time off "No disponible" / "horario no disponible", and the Calendar keeps "libre" for bookable only. The Services buffer still reads "Tiempo libre antes" (`services-words.ts:121-123`) on its own screen, with the hint "Se deja libre, nunca se reserva" saying what it means.

### 12j/F-473 [P3] closed - The off state of a person, place or service has several Spanish names across Settings

**File:** frontend/lib/dashboard-words/people-words.ts:115-116; frontend/lib/dashboard-words/settings-frame-words.ts:64; frontend/lib/dashboard-words/services-words.ts:114-115, 135, 139, 146-147
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..0acd574; lenses: quality, security, performance, tests)
**Why it matters:** English uses one pair, On and Off. In Spanish, People shows a person as "No disponible", the same person in a service's ticks reads " (desactivado)" and "Todos los marcados están desactivados", and a service is "Oculto" in its badge but "Apagado lo oculta" in its checkbox. An owner matching a person turned off on People with the one marked in a service sees two different words. " (desactivado)" is also masculine after a place such as "la sala", which `people-words.ts` avoids on purpose ("Gender-free on purpose").
**Suggested fix:** Pick one word per state and use it everywhere: for people and places "Disponible" / "No disponible" (ticks: " (no disponible)", "Todos los marcados no están disponibles"); for services "Activo" / "Oculto" ("Si lo desmarca, se oculta").
**Resolution:** Fixed 2026-10-24: a person or place switched off is "Fuera de servicio" / "En servicio" (People, the Settings suffix, the service form's notes), gender-free and apart from the Calendar's "No disponible"; a service stays "Activo" / "Oculto" and the form's "Apagado" became "Oculto". Closed 2026-10-24 by /audit independent current (576bdaf..6e24d7e): people and places read "En servicio" / "Fuera de servicio" in `people-words.ts:115-116`, `settings-frame-words.ts:64` and `services-words.ts:135, 140`; services read "Activo" / "Oculto" (`services-words.ts:114-115, 147`); no "desactivado" or "Apagado" is left for these states.

### 12j/F-474 [P3] accepted - The default lead stages are stored in English, so a Spanish dashboard shows "New", "Contacted", "Booked", "Done"

**File:** packages/shared/crm/default-pipeline-stages.ts:4; backend/lib/crm/seed-pipeline-stages.ts:25; frontend/components/leads/leads-list-screen.tsx:157; frontend/components/leads/lead-page-screen.tsx:139, 218
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..0acd574; lenses: quality, security, performance, tests)
**Why it matters:** Every business gets its stages from `DEFAULT_PIPELINE_STAGES`, written in English, and the leads list, a lead's page and its other requests show `stage.name` as stored. The business never typed them, so they are not "words a business typed itself" under Out of scope, and neither 12j.2 nor 12j.3 names them. A Spanish owner's leads list reads "New" and "Booked" beside Spanish words.
**Suggested fix:** Decide it in the spec: either the stage names are business data (shown as stored, said so under Out of scope), or a Spanish business gets Spanish stages when it is set up (the business's `language` choosing the names in `seed-pipeline-stages.ts`), or the dashboard names the four default stages through the words while their stored names are untouched.
**Resolution:** Accepted 2026-10-24 by Frank ("sure" to moving it): moved to feature 14, where each business names, adds and reorders its own stages and boards, so translating the four defaults now would be undone there.

### 12j/F-475 [P3] closed - The sign-in page's email placeholder stays English in Spanish

**File:** frontend/components/sign-in/sign-in-email-step.tsx:71
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..0acd574; lenses: quality, security, performance, tests)
**Why it matters:** The sign-in pages are in scope for Spanish (12j.1), and the Setup card's same kind of placeholder was moved into the words ("usted@sunegocio.com", `setup-cards-words.ts`). The sign-in email box still reads "you@yourbusiness.com" when the page is in Spanish.
**Suggested fix:** Add an `emailPlaceholder` word to `DashboardWordsType` (Spanish, for example "nombre@sunegocio.com") and read it here.
**Resolution:** Fixed 2026-10-24: the sign-in email placeholder is a word, "usted@sunegocio.com" in Spanish, English unchanged. Closed 2026-10-24 by /audit independent current (576bdaf..6e24d7e): `sign-in-email-step.tsx:71` reads `words.emailPlaceholder`, declared in `dashboard-words-type.ts:30` with both languages.

### 12j/F-476 [P1] closed - In the Month view, "Today" shows only the current week

**File:** frontend/components/schedule/schedule-screen.tsx:45-49, 293, 206
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** `fetchCalendar` asks for one week whenever `asked.date` is missing (`!asked.date ? [undefined]`), whatever the view. The Today button calls `onAsk({ resourceId })` with no date, so in the Month view it fetches one week; `ScheduleCalendar` then hands those seven days to `ScheduleMonthGrid` as `allDays`, and the month's heading sits over a single row. The calendar picker (line 206) passes the same missing date after Today, so changing person keeps the one-week month, and Book by hand in that view offers only that week's dates (`datesToBook`). Today is the most used button on a calendar.
**Suggested fix:** Make a missing date in the Month view mean today in the business's zone: Today sends `todayInZone(timezone)` as the date (the zone is already on screen), or `fetchCalendar` fetches the current week first and then `weeksOfMonth` of its today, so the Month view always asks for its four to six weeks.
**Resolution:** Fixed 2026-10-24: Today asks for today's date and the person picker for the date on screen, so a Month view always asks for the whole month. Seen on http://localhost:3400/calendar: Month, Next (November, 42 days), Today (October, 35 days), another person (October, 35 days). Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): every `onAsk` in `schedule-screen.tsx` now carries a date (picker line 208 `date: shown`, Today line 295 `date: today` from `todayInZone`, Previous/Next, the view buttons, a month day), so `fetchCalendar` takes the dateless one-week path only for the first read, which is always the Week view. No frontend test runner exists; verified by reading the code.

### 12j/F-477 [P2] closed - On Days off in Spanish, a closed holiday goes back to its English name after any save

**File:** backend/routes/settings-routes.ts:522, 579, 598; frontend/components/settings/days-off-screen.tsx:98, 135, 187
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** Only GET `/settings/days-off` names closed holidays through `holidayPackage.nameOn` (lines 485-497). PUT `/settings/days-off`, POST `/close` and POST `/open` return `findDaysOff` as stored, with English names, and the screen merges `...answer.daysOff` over its state. So a Spanish owner who ticks a holiday, closes a day or opens one sees "Navidad" turn into "Christmas Day" until the page is reloaded. The list also keeps its old language after the language switch, since nothing reads it again. The route test checks the GET only.
**Suggested fix:** Name the closed days in one place for all four answers (a helper in the routes, or `findDaysOff` taking the language), have the three save calls send `language` as the GET does, and add one test that a Spanish save answers "Navidad".
**Resolution:** Fixed 2026-10-24 (Frank's yes): PUT /settings/days-off, POST close and POST open take `language` and name their closed holidays with the same `namedIn` as the GET; the client sends the login's language. Days off reads itself again on a language switch (`readsAgainInEachLanguage`) and the list takes the new answer. Test: the save's answer reads Navidad. Seen on the laptop: Navidad, Christmas Day, Navidad across two switches. Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): GET, PUT, POST close and POST open all answer through one `namedIn` (`settings-routes.ts:76-99`), each validates `language` the same way (en when absent, 400 otherwise, before the body), and `save-days-off.ts` sends `dashboardLanguage()` on all three. The re-read runs from a passive effect after the provider's layout effect has set the new language, and `ClosedDaysList` adopts a new answer during render (`days-off-screen.tsx:56-61`), which only fires when SettingsSection holds a new result object. The holiday picker beside it is a separate gap, F-483. Close and open in Spanish have no route test of their own; they share `namedIn` with the tested PUT.

### 12j/F-478 [P2] closed - Some dashboard refusals have no Spanish, and the completeness test cannot see them

**File:** backend/routes/settings-routes.ts:604-609; backend/routes/schedule-routes.ts:347-352; backend/lib/email/check-email-sending-key.ts:30-60; backend/lib/email/save-email-sending.ts:61; packages/shared/helpers/spanish-messages.test.ts:28-30, 46-53
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** The spec says the saved test collects every message in the backend's refusals so none ships untranslated. Its `refusalRule` matches only `refuse(code, "literal")` and `messageRule` only `message: "literal"`. Missed, and reachable from Spanish screens: "The business does not work that weekday: set that day's hours on Hours." and "They do not work that weekday: set their hours on Hours." (Days off, opening a day; a ternary inside `refuse`), "A booking in that time has already begun, so time off cannot cover it." and "There are bookings in that time. Choose for each one: move it or cancel it." (Calendar, time off; a ternary), and the email sending card's Resend reasons ("Resend refused this key.", the quota, sender and retry lines, some joined with `+`, and "The saved key can no longer be read. Paste it again."), written as `reason:`. None is in `spanish-messages.ts`, so each shows in English on a Spanish dashboard: never blank, as the contract allows, but the test's promise does not hold.
**Suggested fix:** Add these messages to the table, and widen the test: also read backend `reason:` literals and every sentence literal inside a `refuse(` call (or every sentence literal under `backend/routes` and `backend/lib/email`, logs left out), writing the `+` joined reasons as one literal each.
**Resolution:** Fixed 2026-10-24 (Frank: fix them all, then come back): Spanish for the open-a-day and time-off choices, the six email key reasons, the saved-key line, the six "Check the ... and try again." fallbacks and "That is not a valid question.". The completeness test now also reads a choice inside refuse(), a reason written in pieces (sentences only, never a reason code), a backend fallback after ??, and lib/email. Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): the shared tests pass (214) with `choiceRule`, `piecesRule` and the backend `fallbackRule` reading the ternaries in `settings-routes.ts:640-645` and `schedule-routes.ts:348-353` and the joined reasons in `check-email-sending-key.ts`. A separate probe of every sentence literal under `backend` (logs, thrown errors and comments left out) found none reachable from a dashboard refusal without Spanish; the rest are worker logs, public booking routes or the question sets themselves.

### 12j/F-479 [P3] closed - A few Spanish templates read wrong once their value is put in

**File:** packages/shared/helpers/spanish-messages.ts:158-159, 207, 220; backend/routes/schedule-routes.ts:329; backend/lib/text/format-text-time.ts:6-17
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** "Tick each of the {} once." becomes "Marque cada uno de los personas una sola vez." with "people" ("personas" is feminine). "Already off from {} to {}." becomes "Ya no está disponible de Mon Oct 26, 9:00am a Mon Oct 26, 5:00pm.": "Ya no está disponible" reads as "no longer available", and the times come from `formatTextTime`, fixed to `en-US`, so English day and month names sit inside the Spanish. "{} no está en la lista de festivos" puts the English holiday name in, since picks are saved in English.
**Suggested fix:** Two exact keys for people and places ("Marque cada persona una sola vez.", "Marque cada lugar una sola vez."); "Ya hay un horario no disponible de {} a {}."; for the times, let the route send the two moments so the dashboard writes them in its locale, or accept English times there and say so in the spec.
**Resolution:** Fixed 2026-10-24 (Frank: fix them all, then come back): "Cada uno se marca una sola vez."; "Ya hay un horario no disponible de {} a {}: quite primero...", with a text's time inside written in Spanish ("lun 26 oct, 9:00 a. m."), tested. A holiday name inside "{} no está en la lista" stays English: it is a pick the list no longer has, so there is no Spanish to give. Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): `spanishValueOf` (`spanish-messages.ts:356-362`) rewrites only a whole value shaped exactly like `formatTextTime`'s en-US output (`format-text-time.ts:17`, "Mon Oct 26, 9:00am") and leaves any other value as it is; the lazy `(.+?)` splits at the first " to ", which a text time never holds; the test proves the full sentence.

### 12j/F-480 [P3] closed - The Month view reads Google busy times four to six times and never shows them

**File:** frontend/components/schedule/schedule-screen.tsx:44-55, 303; frontend/components/schedule/schedule-month-grid.tsx:52; backend/lib/schedule/find-schedule-week.ts:149-185
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** Each Month view asks the week route four to six times in parallel, and each week reads the person's Google busy times (`getBusyTimes`), which the Month grid then filters out (`item.kind !== "google_busy"`). That is up to six Google calls per page turn for nothing shown, and when one fails the Month view still says "No se pudo leer Google para esta semana", about a week it does not name. The Day view also reads its whole week, Google included, on every one-day step. Not measured; the cost is Google's quota and the page's speed.
**Suggested fix:** Let the week route skip Google when asked (a query flag) for the Month view, or hide the Google notice there; later, one month route.
**Resolution:** Fixed 2026-10-24 (Frank: fix them all, then come back): the week route takes google=skip and then reads no busy times (google: "skipped"); the Month view sends it, so its 4 to 6 weeks never ask Google and its notice cannot show. Tested: no Google call, 400 for any other value. Seen on the laptop: every Month request carries google=skip. Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): `google: z.enum(["skip"]).optional()` in the strict week query schema, `readGoogle: query.google !== "skip"` in `schedule-routes.ts:129`, and `find-schedule-week.ts:151-152` skips the connection read and `getBusyTimes` together. The only consumer of `google` (`schedule-screen.tsx:305`, `=== "unreadable"`) is unaffected by the new "skipped" value; the backend test proves no Google call and a 400 for another value.

### 12j/F-481 [P3] closed - The ready-made booking questions follow the login's language, not the language the business's customers book in

**File:** frontend/components/settings/booking-questions-card.tsx:75, 131; backend/lib/settings/find-booking-form.ts:17
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** The questions are shown to customers in the booking window, in the business's own language (12i, `language` on the same Booking form settings). The card fills them in `useDashboardWords().language`, so a Spanish-reading member of an English business fills Spanish questions for English customers, and the reverse. The spec keeps the login's language and the business's language apart on purpose.
**Suggested fix:** Fill the questions in `settings.language` (the business's) and keep only the button's set name in the login's language; or let Frank decide and record it in the spec.
**Resolution:** Fixed 2026-10-24 (Frank: fix them all, then come back): the ready-made questions fill in the business's language (the Booking form's setting, what its customers read); the buttons' names stay in the reader's language. Reopened 2026-10-24 by /audit independent current (576bdaf..1811dcc): the repair reads `settings.language` (`booking-questions-card.tsx:76`), the business's language as it was when the page was read. The business's language is changed on the same page by `BookingFormRulesCard`, which keeps the saved value only in its own state (`booking-form-rules-card.tsx:26, 43`), so an owner setting up a business who switches it from English to Spanish, saves, and then presses a ready-made set still gets the English questions until the page is reloaded. Suggested fix: keep the business's language in one place both cards read (lift it into `BookingFormScreen`, or have the rules card hand the saved language up), so the questions follow a save at once. Fixed again 2026-10-24: the Booking form page keeps the business's language as last saved (BookingFormCards); the rules card reports a saved language and the questions card fills the ready-made set in it. Seen on the laptop: reading English, business saved as Spanish, the clinic set filled "¿Tiene alergias o alguna afección de la piel?" with no reload. Closed 2026-10-24 by /audit independent current (576bdaf..08551a9): `BookingFormCards` (`booking-form-screen.tsx:26-35`) starts from the read's language, the rules card hands up only a language the API saved (`booking-form-rules-card.tsx:46-50`), never an unsaved pick, and `startFrom` fills `set.questions[businessLanguage]` (`booking-questions-card.tsx:80-86`), while the button names the set in the reader's language (line 142). Try again remounts both cards from a fresh read, so the state cannot go stale. The question sets' file header still describes the old rule, a separate entry, F-484.

### 12j/F-482 [P3] closed - The comment for the first-issue refusal now sits above the holiday language helper

**File:** backend/routes/settings-routes.ts:67-76
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..6e24d7e; lenses: quality, security, performance, tests)
**Why it matters:** `holidayLanguageOf` was put between "The first problem, with where it is..." and `refuseFirstIssue`, so the comment now describes the wrong function, against the project's rule that a comment sits beside the line it explains.
**Suggested fix:** Move line 67 down, directly above `refuseFirstIssue`.
**Resolution:** Fixed 2026-10-24 (Frank: fix them all, then come back): the comment is back above refuseFirstIssue. Closed 2026-10-24 by /audit independent current (576bdaf..1811dcc): `settings-routes.ts:101` sits directly above `refuseFirstIssue`, and each of `holidayLanguageOf` and `namedIn` has its own comment above it.

### 12j/F-483 [P3] closed - After a language switch, the Days off holiday picker keeps its countries and holiday names in the old language

**File:** frontend/components/settings/holiday-picker.tsx:72-82, 84-114; frontend/components/settings/days-off-screen.tsx:193
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..1811dcc; lenses: quality, security, performance, tests)
**Why it matters:** The spec says the switch changes the screen without a reload, and F-477's repair makes the closed days list read itself again in the new language. The picker beside it reads its countries and its holiday labels with `dashboardLanguage()` (`fetch-holiday-choices.ts:18`), but its two effects depend only on `[attempt]` and `[country, region, attempt]`, and `HolidayPicker` is not keyed, so after English to Español the list above says "Navidad" while the picker's tick list still says "Christmas Day" and the country names stay English, until the owner changes country or province or reloads.
**Suggested fix:** Add the dashboard `language` from `useDashboardWords()` to both effects' dependencies (the picks are English names, so they stay valid), or key the picker by language in `ClosedDaysList`.
**Resolution:** Fixed again 2026-10-24: the holiday picker is keyed by the login's language, so a switch reads its countries and holidays again. Seen: Navidad and Canadá became Christmas Day and Canada on the switch. Reopened 2026-10-24 by /audit independent current (576bdaf..08551a9): the original gap is gone (the remounted picker's passive effects run after the provider's layout effect has set `dashboardLanguage()`, so both reads ask in the new language). But the remount also throws away what the picker holds unsaved, because `holiday-picker.tsx:55-57` read `daysOff` only when it mounts: a country, province or ticks changed and not yet saved go back to the saved ones on a switch, with no word, while the rest of Days off (an open close or open form) keeps its input. And a holiday save still in flight when the switch lands updates `ClosedDaysList` (`days-off-screen.tsx:197-198`) but not the new picker, which shows the picks from before that save, so a second Save writes them back. Suggested fix: drop `key={language}` (`days-off-screen.tsx:194`) and add `language` from `useDashboardWords()` to the two effects' dependencies (`holiday-picker.tsx:82, 114`), the first option suggested above; the picks are English names and stay valid, and `prune` stays false on a language change. Fixed again 2026-10-24: the key is gone and both effects read again on `language`, so the picker keeps what it holds. Seen: Remembrance Day ticked and not saved stayed ticked across English to Español, while Christmas Day became Navidad and Canada Canadá. Closed 2026-10-24 by /audit independent current (576bdaf..247d810): `days-off-screen.tsx:193-199` mounts `HolidayPicker` with no key, so its unsaved country, province and ticks (`holiday-picker.tsx:57-59`) survive a switch, and both reads now depend on `language` (`holiday-picker.tsx:84, 116`). The provider sets `dashboardLanguage()` in a layout effect (`dashboard-words-provider.tsx:87`), which runs before these passive effects, so each read asks in the new language. `prune` is untouched by a switch, so the picks are never cut; a pending province pick whose read the switch cancels is pruned on the re-read, as intended. A save in flight now lands in the same picker, so the second-Save case from the reopening is gone. No new defect found.

### 12j/F-484 [P3] closed - The ready-made question sets' file header still says they fill in the reader's language

**File:** backend/lib/settings/booking-question-sets.ts:1-4
**Found:** 2026-10-24 by /audit independent current (scope: 576bdaf..08551a9; lenses: quality, security, performance, tests)
**Why it matters:** The header says "the page fills in the language its login reads". Since F-481's repair the page fills the questions in the business's language (what its customers read) and only names the set in the login's language, so the comment states the rule F-481 removed and points the next reader at the wrong one.
**Suggested fix:** Say the page names a set in the login's language and fills its questions in the business's language.
**Resolution:** Fixed 2026-10-24: the header now says the page names a set in the login's language and fills its questions in the business's language. Closed 2026-10-24 by /audit independent current (576bdaf..247d810): `booking-question-sets.ts:1-5` now states the rule the card follows (`booking-questions-card.tsx:142`: the set's name in the reader's `language`; line 82: its questions in `businessLanguage`).

## Independent review

**Status:** passed
**Target commit:** 247d8107f7ca2297fc0136ad7cc80f80797010cc
**Base commit:** 576bdaf322eb1e4934a701ccfb7db81b5b96536a
**Base ref:** main
**Spec hash:** f32ceaf64418f57b12ff110bdd821d0731174af1d75d763eace5bb623829afec
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-24T20:22:31Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-24T20:28:30Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

### Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (32 files, 214 tests)
- `npm run test --workspace=backend`: pass (92 files, 1078 tests, against the local seeded scheduleads_dev)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (18 files, 98 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass (no problems)
- `npm run format:check`: pass

### Evidence

- Freshness: HEAD equals the target, `git merge-base main HEAD` equals the base, the spec's SHA-256 matches, and only `blueprint/context/findings.md` and `blueprint/context/review.md` differ from the target.
- Security: `PUT /me/language` (`backend/app.ts:82-97`) takes the login from the session only, sits behind CORS, CSRF and no-store (`app.ts:36`), and its Zod schema strips any extra `userId`; `user.language` is an `input: false` Better Auth field with a database check (migration 0032); no session cookie cache, so `/me` reads the new value at once. Every word and API message is rendered as React text; the login code email puts only constant words and the digits into its HTML.
- F-483 holds: `HolidayPicker` is no longer keyed (`days-off-screen.tsx:193-199`) and both its reads depend on `language` (`holiday-picker.tsx:84, 116`), after the provider's layout effect sets the message language; unsaved picks survive a switch. F-484 holds: `booking-question-sets.ts:1-5` matches `booking-questions-card.tsx:82, 142`.
- Holidays: `date-holidays` checked for CA-QC, CA-ON, CA-NB, US and CO; the English and Spanish public lists pair by index and date, Spanish where the package has it, English otherwise, with no French leaking in for Quebec.
- Calendar views (`schedule-screen.tsx`, `schedule-time-grid.tsx`, `schedule-month-grid.tsx`, `calendar-dates.ts`): every `onAsk` carries a date, Month asks four to six weeks with `google=skip`, and the backend skips the Google read for it (`find-schedule-week.ts:151`).
- `fetchInDashboardLanguage` (`dashboard-api-client.ts`) only rewrites JSON refusals outside `/admin`; no caller reads `response.url` or headers that the rebuilt response drops.

### Findings

- F-483 [P3] closed (re-reviewed, repair holds)
- F-484 [P3] closed (re-reviewed, repair holds)
- F-485 [P2] open: the sign-in steps and business picker show Better Auth's English messages ("Invalid OTP") in Spanish
- F-486 [P3] open: the Calendar's Day, Week and Month views are not recorded in the spec

### Remaining risk

- The frontend has no test runner: the language switch, the sign-in pages, the Calendar views and every Spanish screen were verified by reading the code and the builds, not by a saved frontend test or a browser run in this review.
- Check was not required and was not run; no dev server was started.
- Migration 0032 still has to be applied on live by hand before the merge deploys the API, as the spec says.
- Better Auth's own messages outside the email OTP plugin (its rate-limit and organization errors) were not listed one by one; F-485 covers the screens that show them.
