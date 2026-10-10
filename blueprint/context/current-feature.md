# Feature: Leads list and contact page

**From build-plan:** feature 11

**Size:** heavy - two separate risks with real logic: showing one business's
customers to its login and never another's (security), and a write path that
creates contacts and leads by hand (data).

**Branch:** `feature/11-leads-list-and-contact-page`

## Goal

The owner signs in and sees every lead the business has, newest first, with its
stage; opens one and reads the person behind it, that request, the person's
other requests, their whole timeline and their open next steps; and types in a
lead that came by phone, so the painter's notebook goes into the CRM instead.

## Design reference

- `prototypes/leads.html` (the list, inside the app shell of `prototypes/shell.css`)
- `prototypes/contact.html` (the contact page and its timeline)
- Tokens already ported to `frontend/app/globals.css` from `prototypes/theme.css`.

Only what this feature has data for is built from them. The stats tiles,
Value column, Export, search and filters, quotes, the email composer, "Log a
call" and "Book a time" belong to later features (see Out of scope).

## In scope

- **The app shell**: a sidebar with the business mark and name, nav to
  **Leads** and **Setup** (today's home page cards), and sign out. Shared by
  `/`, `/leads` and `/leads/[leadId]`, with one `/me` gate (signed out, pick a
  business, plan refused, API down) instead of each page repeating it.
- **The leads list** at `/leads`: every lead of the signed-in business, newest
  first, 50 at a time with "Show more". Each row: the person's initials, name,
  phone or email; what they asked for (the booked service, else the first line
  of their own words, else a dash); when (the booking's time in the business's
  time zone, marked cancelled when it is, else when the lead came in); the
  stage; where it came from (Website, Booking page, Added by hand). A row opens
  the lead's page.
- **The lead page** at `/leads/[leadId]`: the person (name, phone as a `tel:`
  link, email as a `mailto:` link); this request (stage, source, when it came
  in, the phone given with it, their words, the answers to the business's own
  questions, its bookings with service, time, person, address and status); the
  person's other requests, each linking to its page; **open next steps** (due,
  not done, soonest first); and **the timeline**, newest first.
- **Adding a lead by hand** (step 11.2): an "Add a lead" button on the list
  opens a form; saving makes the lead in the first stage, joins an existing
  contact when the email is already known, writes "Added by hand" on the
  timeline, and opens the new lead's page.
- Loading, empty, not-found, refused and API-down states for every screen.

## Out of scope

- Changing a lead's stage, renaming or reordering stages (feature 14, the board).
- Editing or deleting a contact or a lead; merging duplicates.
- Notes, logging a call, sending email or texts from the page (feature 15).
- Quotes, money columns and the stats tiles (features 16, 20).
- Search, filters and export (not planned yet; a note for later).
- The owner booking a time for a lead (feature 12b puts things on calendars).
- Writing next steps, unless the open question below adds it to 11.2.
- TanStack Query: the build plan brings it at feature 14 with the board; these
  screens use the fetch-and-state pattern every dashboard screen uses today.

## Build loop

Heavy, so every step: its plan gets Frank's yes just before it is built; after
the yes nothing stops until the review (build, tests and checks, tick the box,
write the log, commit and push to the feature branch, `/audit` scoped to the
step, independent review). The stop is after the review, where findings are
talked through; P0/P1 are fixed or accepted by Frank with a reason, P2/P3 are
recorded and carried. `/complete` does the final pass and the merge on his yes.

## Build steps

- [x] **11.1 The leads list and the lead page.** Two read routes scoped to the
  session's business, the app shell, `/leads` and `/leads/[leadId]`.
  - 11.1.1 `GET /leads?after=<leadId>`: the business's leads, newest first
    (createdAt, then id), 50 per page, `nextAfter` when there are more. The
    business comes only from the session; `after` must be one of its own leads
    or the answer is 400.
  - 11.1.2 `GET /leads/:leadId`: one lead with its contact, its bookings, the
    contact's other leads, open next steps and the timeline (the newest 200,
    with `timelineCut: true` when there are more). Another business's lead and
    an unknown id answer the same 404.
  - 11.1.3 The timeline view: the backend turns each activity row into a typed
    entry with only the facts the screen shows (see Data / contracts); the raw
    payload never crosses the API, and a type with no view yet still shows as
    its label and time.
  - 11.1.4 The shell and the `/me` gate, shared by `/`, `/leads` and
    `/leads/[leadId]`; the home page's cards move under Setup unchanged.
  - 11.1.5 The two screens, with loading, empty, not-found and API-down states.
  - **Done when:** one backend test proves a business never sees another's
    leads (the clinic owner gets 404 for a painting lead, and the list never
    holds one); `npm run build --workspace=frontend` passes; and in the browser at
    http://localhost:3400/leads a booking made through the booking window shows
    as the top row, and opening it shows the booking, the email and text
    entries and the "Booked" line on its timeline.

- [ ] **11.2 Adding a lead by hand.** The form, `POST /leads`, the new timeline
  type.
  - 11.2.1 `lead_added` joins `ACTIVITY_TYPES`, and `lead` gets a nullable
    `requestKey`, unique per business; one migration for both.
  - 11.2.2 `POST /leads`, in one transaction: find or make the contact by the
    existing rule, the lead in the first stage with source `manual`, and the
    `lead_added` entry with the login as its actor. The same `requestKey` sent
    twice gives back the first lead, never a second one.
  - 11.2.3 The form on `/leads`: name, phone, email, what they want; saving
    opens the new lead's page, which says so when the person was already a
    contact.
  - **Done when:** four backend tests prove: a known email joins that person,
    no email makes a new person, the same form sent twice makes one lead, and
    a lead with neither phone nor email is refused; and in the browser a lead
    typed in at
    http://localhost:3400/leads appears at the top and its page shows "Added by
    hand" with the login's name.

## Files / areas

Backend (11.1):

- `backend/app.ts` - mount `/leads` with dashboard CORS, CSRF and no-store, as
  `/email-sending` is; `.route("/leads", leadsRoutes)` in the one chain.
- `backend/routes/leads-routes.ts` - `GET /`, `GET /:leadId` (11.2 adds `POST /`),
  each behind `requireOrganizationMiddleware`, `requireKnownSubscriptionMiddleware`,
  `requireModuleMiddleware("crm")`.
- `backend/lib/crm/find-leads-page.ts`, `backend/lib/crm/find-lead-page.ts`,
  `backend/lib/crm/timeline-entry-of.ts` - one export each.
- Their `*.test.ts` beside them, against the seeded `scheduleads_dev`.

Backend (11.2):

- `packages/shared/crm/activity-types.ts` - add `lead_added`.
- `packages/shared/db/crm-tables/lead-table.ts` - `requestKey`, unique index on
  (organizationId, requestKey) where not null.
- `packages/shared/migrations/` - one generated migration.
- `packages/shared/zod-validation/crm-validation-schemas/add-lead-validation-schema.ts`
- `backend/lib/crm/add-lead-by-hand.ts` and its test.

Frontend:

- `frontend/components/dashboard/dashboard-gate.tsx` (the `/me` switch lifted
  out of `app/page.tsx`) and `dashboard-shell.tsx` (the sidebar).
- `frontend/app/page.tsx` - uses the gate and shell; its cards unchanged.
- `frontend/app/leads/page.tsx`, `frontend/app/leads/[leadId]/page.tsx`.
- `frontend/components/leads/leads-list-screen.tsx`, `lead-page-screen.tsx`,
  `timeline-entry-line.tsx`; 11.2 adds `add-lead-form.tsx`.
- `frontend/lib/api-client/leads/fetch-leads.ts`, `fetch-lead.ts`; 11.2 adds
  `add-lead.ts`. Every call through `dashboardApiClient`.

## Data / contracts

**Who may do what.** Any member of the business (owner, admin, member) whose
plan includes the `crm` module may read its leads and add one. Adding a lead
destroys nothing and a receptionist takes calls, so no role check. The business
is always the session's (`c.get("organization").organizationId`), never a
request value, and every query filters by it first.

**`GET /leads?after=<leadId>`** → `200`

```ts
{
  leads: {
    id: string;
    createdAt: string;                 // ISO
    source: "widget" | "hosted" | "manual";
    stage: { id: string; name: string };
    contact: { id: string; name: string; phone: string | null; email: string | null };
    what: string | null;               // booked service name, else first line of details (max 120 chars), else null
    booking: { startsAt: string; status: "confirmed" | "cancelled" } | null; // the lead's newest booking
  }[];
  nextAfter: string | null;            // the last lead's id when more exist
  timeZone: string | null;             // the business's, from its business-wide availability rule
}
```

Phone shown is the lead's own phone, else the contact's. Errors: `400
bad_request` for an `after` that is not one of the business's leads; `401`,
`403 forbidden`, `403 plan_required` from the existing middleware.

**`GET /leads/:leadId`** → `200`

```ts
{
  lead: { id, createdAt, source, stage: { id, name }, phone: string | null,
          details: string | null, answers: { question: string; answer: string }[] };
  contact: { id, name, email: string | null, phone: string | null };
  bookings: { id, serviceName: string, startsAt: string, endsAt: string,
              status: "confirmed" | "cancelled", personName: string,
              placeName: string | null, location: string | null }[];   // newest first
  otherLeads: { id, createdAt, stageName: string, what: string | null }[]; // newest first
  nextSteps: { id, type: string, dueAt: string, what: string | null }[];  // dueAt set, doneAt null, soonest first
  timeline: TimelineEntryType[];      // occurredAt set, newest first, at most 200
  timelineCut: boolean;
  timeZone: string | null;
}
```

`404 not_found` ("No lead here.") for an unknown id and for another business's
lead alike, so the answer never tells whether it exists elsewhere.

**`TimelineEntryType`** - `{ id, type, occurredAt, actorName: string | null }`
plus, per type, only these facts (looked up within the same business):

| type | facts | the line reads |
|---|---|---|
| `booking_created` | serviceName, startsAt | Booked {service} for {time} |
| `booking_moved` | serviceName, fromStartsAt, toStartsAt | Moved {service} from {time} to {time} |
| `booking_cancelled` | serviceName | Cancelled {service} |
| `email_sent` | kind | Sent the confirmation / the business was told / ... |
| `sms_sent` | kind, minutesBefore | Texted the confirmation / a reminder {n} before |
| `later_texts_yes` | none | Said yes to texts |
| `lead_added` (11.2) | none | Added by hand by {actorName} |
| any other | none | its label |

Twilio and Resend ids, phone numbers inside payloads and the customer's words
in a `later_texts_yes` payload are not sent. Every string is rendered as text,
never HTML. Times are shown in the business's time zone; with none set, in the
browser's, labelled as such.

**`POST /leads`** (11.2) - body
`{ requestKey: uuid, name: string, phone?: string, email?: string, details?: string }`.
Name 1-120, phone up to 40, email by the existing email rule, details up to
2000; at least one of phone or email ("Enter a phone number or an email, so
you can reach them."). Contact by `findOrCreateContact` unchanged: a known
email joins that contact and keeps its name and phone (a phone is filled in
only when it had none); no email is always a new contact; a phone never
matches. Lead: first stage, source `manual`, `details`, `phone`, `answers`
null, `requestKey`. Activity `lead_added`, payload `{ leadId }`, actor the
login. One transaction. → `201 { leadId, contactId, joinedExistingContact }`;
the same `requestKey` again → `200` with the first lead's answer. `400
bad_request` with the first field's message; `401`/`403` as above.

## Testing

A test only where a mistake would hurt (workspace rule, Oct 10): five in all,
with Vitest against the seeded local `scheduleads_dev`, each adding and
removing its own rows.

- 11.1: a business never sees another's leads.
- 11.2: a known email joins that person; no email makes a new person; the
  same form sent twice makes one lead; neither phone nor email is refused.
- The existing "one of each type" activity test covers `lead_added` once it is
  in the list.
- `npm run build --workspace=frontend` for the typed client and the screens;
  the frontend has no test runner and gets none here.
- By hand in the browser at http://localhost:3400, per each step's Done when.

## Notes for the AI

- Next 16: read `node_modules/next/dist/docs/` for dynamic route params in a
  client page before writing `app/leads/[leadId]/page.tsx`.
- The business time zone lives on the business-wide `availability_rule` row
  (`personId` null); `find-booking-email-context.ts` already reads it. Reuse
  that query's shape; never assume one.
- A lead normally has at most one booking (moves change the same row), but the
  schema allows more: always take the newest.
- `requestKey` follows the booking form's pattern (`booking.requestKey`,
  `one-copy-of-a-form-at-a-time.ts`): the form makes one uuid when it opens.
- Never log a contact's name, phone or email; errors go through
  `safeErrorReason`.
- `/leads` and `/leads/*` both need the dashboard middleware; prove with a test
  that a cross-site POST to `/leads` is refused by the CSRF check.

## Open questions

- **Writing next steps.** The page shows open next steps, but nothing writes
  one yet, so the section will be empty for every lead. Should 11.2 also let
  the owner add a next step ("call back Thursday", a date and a few words) and
  tick it done? Decided before 11.2's plan; it does not affect 11.1.
