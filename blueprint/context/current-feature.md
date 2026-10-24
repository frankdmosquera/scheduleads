# Feature: Spanish dashboard

**From build-plan:** feature 12j

**Size:** heavy - three separate risks: a stored per-login setting behind a new route and the
sign-in, every dashboard screen's words and dates moved into word lists, and the messages that
come from the API and the shared rules.

**Status:** planned

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

- [ ] **12j.2 Every screen in Spanish.** The words and dates of every signed-in screen.
  - Every screen listed under In scope reads its words from `useDashboardWords()`; no English
    sentence stays written into a screen.
  - Dates and times through the words' `intlLocale`: `format-lead-time.ts`,
    `calendar-day-words.ts` and the screens that format their own (the schedule's week, a lead's
    timeline, closed days, notice).
  - The shared helpers that write words for the dashboard take the language (for example
    `apiNotRespondingMessage` becomes a word).
  - **Done when:** each screen opened in Spanish on http://localhost:3400 shows no English
    except the business's own words and the API's messages (12j.3); the same screens in English
    are unchanged; `npm run build --workspace=frontend` fails when a Spanish word is removed and
    passes again when restored. All suites, builds, lint and format pass.

- [ ] **12j.3 The API's messages and the form errors in Spanish.**
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
