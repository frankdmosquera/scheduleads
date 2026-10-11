# Feature: The booking form

**From build-plan:** feature 12f

**Size:** heavy - two separate risks with real logic: the business's own questions (a list kept in order, added, changed and removed, with past answers kept), and what the booking form requires of a customer (email, phone, address), which the public booking API enforces and the booking window every client site installs must show the same way.

**Branch:** feature/12f-the-booking-form

## Goal

The owner sets the booking form on Settings: the business's own questions (up to 20, under the
standard ones), started from a ready-made set for the trade (painting, clinic) or written from
nothing; whether a customer must leave an email, a phone, or either one; for each service whether
the address is asked and required, asked and optional, or not asked; and whether the form asks for
the customer's yes to later texts. After this nobody changes `booking_question`, the contact rule,
a service's address choice or `askLaterTextsYes` by hand or in a setup file to change any of it.

## In scope

- A Booking form page, `/settings/booking-form`, in the section list after Days off.
- **The questions (12f.1)**: the business's questions in order, each with its words and whether it
  is required; add one, change one, move one up or down, remove one; at most 20. With no questions,
  "Start from the painting set" or "Start from the clinic set" fills the list, to change before
  saving. One save writes the whole list. A removed or changed question never changes a lead's
  saved answers: each answer already keeps its own copy of the question's words (`lead.answers`).
- **What the form requires (12f.2)**: the contact rule, one of "an email", "a phone" or "either
  one", per business; the address, per service, one of "asked and required", "asked, optional" or
  "not asked" (today's yes/no per service becomes the three-way choice); whether the form asks for
  the yes to later texts. The public booking API enforces the contact and address rules, and the
  booking window shows each field as required or optional the same way.
- Read-only for a role that may not change the business, as 12a.

## Out of scope

- What the business later sends to a customer who said yes (offers, reminders to book again): a
  later feature; this only asks and records the yes, as feature 9 built.
- The texting number, the confirmation and reminder texts (12g). A business without text settings
  cannot ask for the yes yet; the page says so instead of offering the choice.
- Answer types other than text (a choice list, a date): every answer stays text (decision 5).
- Questions per service: the questions are the business's, asked for every service.
- Publishing the booking component to GitHub Packages (Frank's yes each time).

## Build loop

Approved one step at a time (AGENTS.md). Heavy: `workflow.stepReview` is `every`,
`checkpointCommits` enabled. After a step's plan has Frank's yes, nothing stops until the review:
build, tests and checks, tick the box, write the build log entry and commit it to buildlogs, commit
and push the step to `feature/12f-the-booking-form`, `/audit` scoped to the step, then the
independent review. The planned stop is after the review. Blocking findings (P0/P1) are fixed by
default; P2/P3 are recorded and carried. `/complete` makes the final pass and merges on Frank's yes.

## Build steps

- [x] **12f.1 The business's questions.** "On Summit I press Start from the painting set, change
  'How many rooms?' to required, add 'Any pets?', move it up, and save: the booking preview asks
  the three in that order. Removing 'Any pets?' later leaves Maria's lead still showing her answer
  to it."
  - Backend: `GET /settings/booking-form` (any member) answers `{ canEdit, questions, presets }`;
    `PUT /settings/booking-form/questions` (`organization: ["update"]`) saves the whole list in
    order in one transaction under a lock on the business's questions: kept ids are updated,
    missing ones deleted, new ones added; an id of another business or unknown is `404`.
  - Shared: the save's Zod schema (1 to 200 characters, trimmed, at most 20, no two the same
    words). The two ready-made sets are data in `backend/lib/settings/booking-question-sets.ts`
    (amended in 12f.1: only the backend reads them, through the GET).
  - Frontend: `app/(dashboard)/settings/booking-form/page.tsx`, "Booking form" in the section list,
    `components/settings/booking-form-screen.tsx` and `booking-questions-card.tsx`.
  **Done when:** the route tests below pass, and by hand on Summit the scene above works in the
  booking preview at http://localhost:3400/admin/booking-preview/painting-dev; Summit's questions
  are put back after.

- [x] **12f.2 What the form requires.** "Riverbend sets 'a phone' and its facial service's address
  to 'not asked': the booking preview asks for a phone, marks the email optional, and asks no
  address; a booking sent without a phone is refused. Summit sets its estimate's address to 'asked,
  optional': a booking without one is taken."
  - Migration: `organization.contactRule` (`email` | `phone` | `either`, existing businesses
    `either`, today's rule); `booking_link.addressMode` (`required` | `optional` | `not_asked`)
    replaces `asksAddress` (true becomes `required`, false `not_asked`).
  - Backend: the booking route checks the contact rule and the address mode; the public service
    detail answers both; `PUT /settings/booking-form/rules` saves the contact rule and
    `askLaterTextsYes` (only for a business with text settings, else `409 no_text_settings`); the
    service save takes `addressMode`. Client setup files and the seed say both.
  - Frontend: the rules card on the Booking form page; the service form's address choice becomes
    three-way. Booking component: the contact fields and the address follow the rules.
  **Done when:** the booking route and booking component tests below pass, and by hand both scenes
  above work in the booking preview; the dev businesses are put back after.

## Files / areas

- `frontend/app/(dashboard)/settings/booking-form/`, `frontend/components/settings/` (section list,
  the questions card, the rules card, `service-form.tsx`), `frontend/lib/api-client/settings/`
- `backend/lib/settings/` (find and save the booking form), `backend/routes/settings-routes.ts` and
  its test; `backend/lib/booking/` (book-time's contact and address checks, check-answers),
  `backend/routes/public-booking-links-routes.ts`, `public-bookings-routes.test.ts`
- `packages/shared/db/` (organization, booking_link), a migration,
  `packages/shared/zod-validation/` (the two saves, the service schema, create-booking),
  `packages/shared/client-setup/`, `packages/shared/scripts/seed-dev.ts`
- `packages/booking-component/booking-window/` (the form, its reading and its tests)

## Data / contracts

All under the dashboard CORS, CSRF and no-store middleware and the `booking` module; reads for any
member, writes need `requirePermissionMiddleware({ organization: ["update"] })`. The business always
comes from the session; every query filters on it first.

**`GET /settings/booking-form`** `200 { canEdit, questions, presets, contactRule, askLaterTextsYes }`:
`questions` `{ id, label, required }` in order; `presets` `{ trade: "painting" | "clinic", name,
questions: { label, required }[] }`; `contactRule` and `askLaterTextsYes` from 12f.2
(`askLaterTextsYes` null when the business has no text settings).

**`PUT /settings/booking-form/questions`** `{ questions: { id?, label, required }[] }`, strict, 0 to
20, labels 1 to 200 characters trimmed, no two the same (ignoring case). Order is the list's order.
`200 { questions }` as the GET's. `404 not_found` for an id not this business's.

**`PUT /settings/booking-form/rules`** (12f.2) `{ contactRule, askLaterTextsYes? }`, strict;
`askLaterTextsYes` left out when the page did not show it (no text settings), and then left as it is.
`200 { contactRule, askLaterTextsYes }` as saved (amended at 12f.2: the card needs only these two);
`409 no_text_settings` for a yes without text settings.

**Booking (public)**: `customer.email` required when the rule is `email`, `customer.phone` when
`phone`, one of them when `either` (today's rule); `location`, when the service's
`addressMode` is `required`, refused empty and taken missing (left blank: the form never showed the
box; amended after 12f.2's review), taken when `optional`, ignored (not kept) when `not_asked` (Frank,
2026-10-11, at 12f.2's plan: a form opened before the address was switched off still books). Errors keep the public
route's shape, `400 { error: { code, message } }` with no `field` (amended at 12f.2: the booking
window marks the field itself, with the same `missingContact`, before anything is sent). `answers` (amended after 12f.1's review) carries
every question the form showed, `{ questionId, question, answer }`, the words as shown and a blank
answer included: a required question shown and left blank is `400 "Answer: <words>"`; one the form
never showed is left blank; an answer to a question removed since is kept under its shown words.

**User text**: question words and answers are rendered by React as text, never HTML.

## Testing

Commands: `npm run test --workspace=@scheduleads-app/shared`, `npm run test --workspace=backend`
(local Postgres, migrated and seeded), `npm run test --workspace=@frankdmosquera/booking-component`,
`npm run build` and `npm run lint` for the frontend.

One test per rule that would hurt if broken:

- 12f.1: a save keeps the order, changes and removes; another business's question id is refused and
  nothing is saved; a removed question leaves a lead's saved answer; a member without the
  permission cannot save.
- 12f.2: each contact rule refuses a booking without what it requires and takes one with it; each
  address mode refuses, takes or ignores the address as it says; the booking window marks the
  fields the same way; the yes to later texts cannot be turned on without text settings.

## Notes for the AI

- 12a's patterns: client components through `dashboardApiClient`; each error under its field with
  `aria-describedby`; a refused save focuses the first bad field; saved and failed messages
  announced and cleared on the next edit. No TanStack Query (feature 14).
- Nothing is pre-filled where the business must choose (decision 30): the ready-made sets fill the
  list only when pressed; `contactRule` keeps today's rule for existing businesses.
- Comments beside the line they explain, one or two lines, no step or finding numbers.

## Decided

- The ready-made sets' questions (Frank, 2026-10-11, at 12f.1's plan): the dev seed's own, painting
  "Interior or exterior?" (required) and "How many rooms?"; clinic "Any allergies or skin
  conditions?" (required) and "Is this your first visit?". More can be added any time.
- A booking sent from a form opened before the owner changed the questions is always taken
  (Frank, 2026-10-11, at 12f.1's review): answers keep the words the customer read, a newly
  required question they never saw stays blank, and a fresh form still requires it.
- The same for the address (Frank, 2026-10-11, at 12f.2's review): a form opened before a service's
  address was made required sends none, and its booking is taken with the address blank; a form
  that showed the box and left it empty is still refused.
