# Feature: Confirmations

**From build-plan:** feature 6

**Branch:** feature/06-confirmations

## Goal

When a booking is saved, the customer gets a confirmation email from the
business, with the time in the business's own zone and a calendar invite
(`.ics`) attached, and the business gets a notification it can read in a
second. Customers only ever hear from the business: never from the product's
name and never from a worker's own address. The same email path delivers the
login codes, which today print to the console and stop the API from running in
production.

Texts (the confirmation text and the reminder the evening before) are feature
8, with its job runner. Until then a customer who gave only a phone (5d's
decision 16) gets no confirmation; the business notification still names them.

## In scope

- One email seam in the backend: every send goes through Resend with the key
  it is given; in development without a key, one console line per email with
  ids only. Every send carries an idempotency key so a repeat never makes a
  second email.
- Each business sends from its own Resend account (decision 6): the app holds
  that account's send-only key, write-only and locked. Two ways in: Frank's
  client setup form for a new client he sets up, and the owner's own "Email
  sending" card after signing in, for a business that already has its email.
  Saving a key sends a test email first, so a wrong key is never stored.
- Login codes sent through it. Production refuses to start without the email
  settings, the way it already refuses without `CALENDAR_TOKEN_KEY`.
- The business details an email needs (decision 8): who it comes
  from, where the business notification goes, the phone for the `tel:` button,
  the website, the brand colour; the logo already has a column. Set when the
  agency sets up a client; editable in Settings later (feature 12).
- The calendar invite: a pure function that writes one booking as an
  RFC 5545 `.ics`.
- Two emails, in Primo's template pattern (`primo-painters/emails/contact-lead.tsx`:
  hex colours, never CSS variables; the zone pinned; a `tel:` button): the
  customer's confirmation and the business notification.
- Sending both once a booking is saved, without the customer's answer waiting
  for them (the same rule as the Google event, 5d's decision 6), and an
  `email_sent` timeline entry for each email that went.

### Decisions made in the spec

1. **Emails are sent after the booking is saved and never make the customer
   wait** (the same rule as 5d's decision 6, Frank's F-93 answer). A failure
   keeps the booking; feature 8 retries.
2. **The same email is never sent twice.** Each send carries an idempotency
   key made from the booking id and the email's kind, and only a new booking
   sends (a resent form gets its booking back and nothing else).
3. **The timeline records that an email went, never what it said.** No
   address and no content in the payload or the logs.
4. **No sender, no email.** A business without its sender address,
   notification address or key sends nothing and logs one line, rather than
   sending from a fallback address the customer would not recognise.
5. **The invite's times are in UTC.** Every calendar converts them to the
   reader's own zone, so no time zone block is written; the email's text
   shows the business's zone. Rejected: a `VTIMEZONE` block, long and easy to
   get wrong, adding nothing when the times are absolute.
6. **Each business sends through its own Resend account, and nobody can read
   its key** (Frank, 2026-10-02, open question 1). The account is the
   business's, the one its Gmail replies already go out through (the agency's
   email setup guide); its emails and their logs stay there. The app holds a
   key made with Resend's "Sending access" only, limited to the business's
   domain: it can send, it cannot read past emails. The key is write-only:
   stored locked with the token key that locks calendar tokens, never
   returned by any route, shown on any screen or written to any log; changing
   it means pasting a new one. It lives in a table of its own, not on
   `organization`, which Better Auth's own routes return to members. A new
   client: Frank sets up the account, pastes the key in client setup, tests,
   and hands over the password (the client changes it and removes him). A
   business that already has its email: Frank builds with a test sender of
   his own, and at handover the owner pastes their own key in the "Email
   sending" card, replacing his. Rejected: one agency account sending for
   everyone, where Frank could read every business's emails in its logs.
7. **Login codes come from the agency** (Frank, 2026-10-02, open question 3):
   one address on the agency's own domain, through the agency's own Resend
   account (`RESEND_API_KEY`), named in the setting `LOGIN_EMAIL_FROM`. The
   app sends them, not the business, and a new owner needs a code before they
   can sign in and paste their own key. Rejected: each business's own sender,
   which cannot send the first code.
8. **One email per business now; each person's own work email later**
   (Frank, 2026-10-02, open question 2). The business notification goes to
   the business's notification address, which client setup fills with the
   owner's email to start; it is its own field so a business can point it at
   another inbox without the owner changing their sign-in. Who hears about a
   booking is answered in one place (`findBookingEmailRecipients`, 6.6), so
   when a person has their own work email at the business's domain (stored
   with Settings, feature 12), Jane's replies and that person's notification
   go to them without a rewrite. A work address at the business's domain is
   still the business; only a worker's personal address is ruled out. When a
   business runs on one email, the booked worker is kept in the loop by text
   (feature 8). Both later parts are written into the build plan.
9. **The owner's card also sets the two addresses** (Frank, 2026-10-02, with
   step 6.3's plan). Where emails come from and where notifications go sit
   above the key, so a business set up without them is never stuck until
   Settings (feature 12). Whenever the card is saved and a key is there (the
   new one, or the one already saved), one test email goes from the new
   sender to the new notification address first; refused, nothing is saved.
   Phone, website and colour stay for Settings: nothing is stuck without
   them.

## Out of scope

- Texts, reminders and retrying a failed email: feature 8 (the job runner).
- The cancel and reschedule link in the confirmation: feature 7.
- Telling the booked worker, beyond what their Google calendar shows (open
  question 5): feature 19 unless Frank decides otherwise.
- Editing the business details from the dashboard: feature 12 (Settings).
- Inbound email, CRM email and the BCC capture address: Phase 6.
- Each business's own booking questions: features 9 and 12.

## Build loop

Steps are built one at a time on `feature/06-confirmations`. Each step's plan
gets Frank's yes just before it is built. After that yes nothing stops until
the review: build, tests, tick the box, the build log entry, commit with the
step number and push to the feature branch, `/audit` scoped to the step, then
the independent review (`workflow.stepReview: "every"`,
`workflow.checkpointCommits: "enabled"`). Findings are talked through after
the review; P0/P1 are fixed before the next step. `/complete` makes the merge
commit, on Frank's yes.

Installing a package is a line only Frank crosses: steps 6.1 and 6.5 name
theirs in their plan, and his yes to that plan is the yes to install them.

## Build steps

- [x] **6.1 The email seam, and login codes through it.**
  - Install `resend` in `backend` (Frank's yes with this plan).
  - `backend/lib/email/send-email.ts`: `sendEmail(...)` (Data / contracts).
    It sends through Resend with the key it is given (the business's, or the
    agency's `RESEND_API_KEY` for login codes), with a 10-second timeout, and
    returns Resend's id; Resend reports failures in its answer rather than
    by throwing, so an error answer throws one safe reason (never the key,
    the addresses, the subject or the body). Without a key, outside production, it
    prints one line with the kind and the idempotency key only, and returns
    `null`.
  - `backend/lib/email/read-email-settings.ts` reads and checks the settings;
    `server.ts` calls it at start, so production without `RESEND_API_KEY` or
    the login sender (`LOGIN_EMAIL_FROM`, decision 7) refuses to start, like
    `readTokenKey()`.
  - `send-login-code.ts` sends the code through `sendEmail` from the login
    sender, plain and short; it keeps printing to the console in development
    without a key, and never puts the code in a log line otherwise.
  - `.env.example`: `RESEND_API_KEY` now read; the login sender named.
  - **Done when** saved tests, with Resend's `fetch` faked: a send carries the
    from, to, reply-to, subject, both bodies, the attachment and the
    idempotency key, with the key it was given; Resend's error answer throws a
    reason with no key, address or content in it; a timeout throws; no key in development prints one line
    without content and sends nothing; the settings check refuses production
    without the key or the login sender; a login code is sent through the seam
    from the login sender. Both builds pass. Resend's documentation checked:
    a "Sending access" key cannot read emails (the answer goes in the log).

- [x] **6.2 The business details an email needs, and its locked key.**
  - Migration 0016 adds to `organization` (decision 8):
    `senderEmail` (the confirmation's from address), `notifyEmail` (where the
    business notification goes; client setup fills it with the owner's email
    to start, decision 8), `phone`, `website`, `brandColor` (a
    `#rrggbb` hex). All nullable at the database; the sending refuses without
    the two addresses and logs it (decision 4).
  - The same migration adds `email_sending_key`: `organizationId` (primary
    key, cascade), `credentials` (the key, locked with `encryptCredentials`
    bound to the business), `savedAt`. Read only by the sending code; no
    route returns it (decision 6).
  - `backend/lib/email/save-email-sending-key.ts`: checks the key's shape
    (`re_` then letters, digits and underscores), sends a test email with it
    from the business's sender to its notification address, and only then
    stores it locked, replacing any earlier key. A refused test answers why
    in safe words ("Resend refused this key", "The sender's domain is not
    verified in Resend") and stores nothing.
  - A shared Zod schema for them (emails lowercased and trimmed, the phone
    1 to 40 characters, the website an `https://` address, the colour
    `#rrggbb`), used by client setup.
  - Client setup (`POST /admin/clients`, its schema and the 3b form) takes
    them, and the key optionally (path A, decision 6), saved through the same
    function; the seed fills both dev businesses with addresses at
    `example.com` and no key.
  - `backend/lib/email/find-business-email-details.ts` reads them, with the
    name, logo and time zone, inside one business only.
  - **Done when** saved tests, with Resend faked: setup stores the details
    and refuses a bad colour, a website without `https`, an address that is
    not an email; a key is stored locked only after its test email went, and
    a refused test stores nothing; the stored key never appears in any
    route's answer or log line; the reader returns one business's details and
    never another's; both builds
    pass; the 3b form shows the new fields with their labels and errors
    (checked by hand in the browser, the screenshot in the log).

- [x] **6.3 The owner's "Email sending" card.**
  - `PUT /email-sending` (dashboard route: `requireOrganizationMiddleware`,
    `requirePermissionMiddleware({ organization: ["update"] })`, the
    dashboard CORS, CSRF and no-store middleware): takes `{ senderEmail,
    notifyEmail, key? }` (decision 9); with a key, new or already saved, the
    test email goes first and a refusal saves nothing; answers the card's
    state or a refusal. The business is the signed-in one, never from the
    request.
  - `GET /email-sending`: the two addresses and when a key was saved; never
    the key.
  - `frontend/components/email-sending/email-sending-card.tsx` on the
    dashboard home, beside the calendar card: "Not set up" or "Sending from
    bookings@primopainters.com, key saved Oct 2"; the two address fields; a
    password-type field to paste a new key, a Save button that locks while saving, the refusal shown
    under the field and read out, the field emptied after a save. Called
    through the typed dashboard client.
  - **Done when** saved tests: an owner saves the two addresses and a key,
    and the answer never carries the key; changing an address with a key
    already saved sends the test from the new address, and a refusal keeps
    the old addresses; a member without the permission is refused; another
    business's key is never touched; `GET` never carries the key; a refused
    test answers its safe reason and stores nothing. The frontend build
    passes and the typed client sees both routes; the card checked by hand in
    the browser (not set up, a refused key, a saved key), the screenshots in
    the log.

- [x] **6.4 The calendar invite.**
  - `backend/lib/email/booking-ics.ts`: one pure function from a booking
    (id, service name, start, end, address, business name, sender email,
    customer name and email) to the text of an `.ics` file: `METHOD:REQUEST`,
    one `VEVENT` with `UID:<booking id>@<sender domain>`, `SEQUENCE:0`,
    `DTSTAMP`, `DTSTART` and `DTEND` in UTC (`...Z`), `SUMMARY` "<service>
    with <business>", `LOCATION` the address, `ORGANIZER` the business,
    `ATTENDEE` the customer with `RSVP=FALSE`, `STATUS:CONFIRMED`. CRLF line
    ends, lines folded at 75 octets without splitting a character, and
    commas, semicolons, backslashes and new lines escaped (decision 5).
  - **Done when** saved tests: the exact text for a plain booking; an address
    with a comma, a semicolon and a new line comes out escaped; a long
    Spanish service name folds at 75 octets and unfolds back to the same
    text; the UID is the same for one booking every time (feature 7 cancels
    and moves the same event by it).

- [ ] **6.5 The two emails.**
  - Install `@react-email/components`, `@react-email/render`, `react` and
    `react-dom` in `backend` (Frank's yes with this plan; the plan's choice,
    Primo's pattern). The templates are `.tsx` files with
    `/** @jsxImportSource react */`, because the backend's own JSX setting is
    Hono's.
  - `backend/emails/booking-confirmation.tsx`, to the customer: the business's
    logo (alt text its name) and colour; "You're booked"; the service, the
    day and time in the business's zone with the zone named, the person, the
    address; a `tel:` button for the business's phone; the business's website;
    a plain-text twin. Never the product's name.
  - `backend/emails/booking-notification.tsx`, to the business: "New booking:
    <service>, <day and time>", then the customer's name, email, phone,
    address and words, each scannable at a glance, and the person booked.
    Reply-to is the customer's email when given, so pressing Reply writes to
    them.
  - Everything the customer typed is rendered as text by React, never as
    HTML. Dates go through one formatter (`format-booking-time.ts`) that takes
    the business's zone.
  - `npm run email:preview --workspace=backend` writes both, filled with a
    sample booking, to a gitignored `backend/.email-preview/` folder to open
    in a browser; nothing is sent.
  - **Done when** saved tests: each email renders with the right subject, the
    time in the business's zone (a booking at 15:00Z reads 9:00 a.m. in
    Edmonton), the `tel:` link, no product name, and a customer's
    `<script>` shown as text; the plain-text twins carry the same facts; the
    preview writes two files; both opened by hand, the screenshots in the log.

- [ ] **6.6 Sent once the booking is saved.**
  - `backend/lib/booking/booking-confirmation-emails.ts`, beside
    `booking-event-writes.ts` and in the same shape: started by `bookTime`
    after the booking's transaction, not awaited; the sends still running can
    be awaited by tests. It reads the booking and the business details inside
    one business, renders the two emails, attaches the invite to the
    customer's, and sends with the business's own key, to the recipients
    one function decides (`findBookingEmailRecipients`: the business's
    notification address today, decision 8): the customer's only when an email was given, the
    business's always. Idempotency keys `booking-confirmation/<booking id>`
    and `booking-notification/<booking id>`.
  - Each email that went gets an `email_sent` timeline entry on the contact
    (Data / contracts), never an address or content.
  - Only a new booking sends: a resent form (`alreadyBooked`) sends nothing.
    A failure keeps the booking and logs one line with the booking id and a
    safe reason; a business without its two addresses or its key logs that
    and sends nothing (decision 4). Retrying is feature 8.
  - Owner-made bookings (open question 4) and the booked worker (open
    question 5) follow Frank's answers.
  - **Done when** saved tests, with Resend faked: a booking with an email
    sends both, the invite attached to the customer's, and writes two timeline
    entries; a phone-only booking sends only the business's; a resent form
    sends nothing more; Resend failing keeps the booking, logs one line with
    no address, and writes no entry; a business missing its addresses or its
    key sends nothing and logs it; the route's answer does not wait for the emails (the
    same held-answer test as 5d's Google event); no log line or timeline
    payload carries a customer's name, email, phone, address or words.

## Files / areas

- `backend/package.json` (resend; React Email, react, react-dom)
- `backend/lib/email/` (new): `send-email.ts`, `read-email-settings.ts`,
  `check-email-sending-key.ts`, `store-email-sending-key.ts`, `save-email-sending.ts`,
  `find-email-sending-state.ts`, `email-refusal-code.ts`, `booking-ics.ts`,
  `find-business-email-details.ts`, `format-booking-time.ts`
- `backend/routes/email-sending-routes.ts` (new), `backend/app.ts`
- `frontend/components/email-sending/` (new), the dashboard home,
  `frontend/lib/api-client.ts`
- `backend/emails/` (new): the two templates and the preview script
- `backend/lib/auth/send-login-code.ts`, `backend/server.ts`
- `backend/lib/booking/book-time.ts`, `booking-confirmation-emails.ts` (new)
- `backend/lib/admin/provision-client.ts`, `backend/routes/admin-routes.ts`
- `packages/shared/db/auth-tables/organization-table.ts`, a new
  `email-sending-key` table, migration 0016,
  `zod-validation/` (the business details, client setup),
  `scripts/seed-dev.ts`
- `frontend/app/admin/clients/new/` (the 3b form's new fields)
- `.env.example`, `.gitignore`
- their tests

## Data / contracts

**organization** gains (6.2): `senderEmail` text null, `notifyEmail` text
null, `phone` text null, `website` text null, `brandColor` text null
(`#rrggbb`). `logo` exists (an absolute `https://` image URL when set).

**email_sending_key** (6.2): `organizationId` text primary key (cascade),
`credentials` text not null (`encryptCredentials(key, readTokenKey(),
organizationId)`), `savedAt` timestamptz. One key per business.

**The card's routes** (6.3, decision 9): `PUT /email-sending` body
`{ senderEmail: string; notifyEmail: string; key?: string }` answers 200
`{ senderEmail, notifyEmail, keySavedAt }`, 400 `bad_request` (an address
that is not an email, not a Resend key), 422 `key_refused` with the safe
reason, 401/403 as the other dashboard routes; `GET /email-sending` answers
the same three (each may be null).

**sendEmail** (6.1):

```ts
type SendEmailInputType = {
  apiKey: string | null; // the business's or the agency's key; null only in development: nothing sent
  kind: string; // for the log line only: "login_code", "booking_confirmation", ...
  from: string; // "Primo Painters <bookings@primopainters.com>"
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType: string }[];
  idempotencyKey: string; // the same key never sends twice (Resend keeps it 24 hours)
};
// Resolves to Resend's email id, or null when nothing was sent (development without a key).
// Throws Error("Sending an email failed: <safe reason>") otherwise.
```

**The invite** (6.4): file name `invite.ics`, content type
`text/calendar; charset=utf-8; method=REQUEST`.

**The timeline entry** (6.6): `type: "email_sent"`, payload `{ bookingId,
kind: "booking_confirmation" | "booking_notification", resendId }`,
`actorUserId` null.

## Testing

Backend Vitest. The invite builder and the date formatter are pure. The
seam, the emails and the sending use Resend's `fetch` faked: no test ever
sends a real email. Database tests build businesses of their own and remove
them, and wait for running sends before closing the database. Each case on
the feature's Simulate page ("Who hears what when Jane books?") is a saved
test under the same name, in the step that builds its rule (6.6). No real email is
sent until Frank sets a Resend key and a verified domain on purpose.

## Notes for the AI

- Resend's SDK returns `{ data, error }` and does not throw on an API error;
  check `error`.
- Resend's idempotency option exists on `emails.send`; confirm the installed
  version's exact option name before relying on it.
- The backend's `tsconfig` sets `jsxImportSource: "hono/jsx"`; the email
  templates override it per file. Check that `tsc` builds them into `dist/`.
- Logo URLs must be absolute; most clients block images, so the alt text is
  the business's name.
- Dates: `Intl.DateTimeFormat` with the business's `timeZone`, never the
  server's zone (Railway runs UTC).
- Never put a customer's details or a login code in a log line.

## Open questions

Each blocks only the step named; Frank answers it when that step's plan is
gone through, before it is built.

1. Answered 2026-10-02: decision 6.
2. Answered 2026-10-02: decision 8.
3. Answered 2026-10-02: decision 7.
4. **Does a booking the owner makes email the customer?** (blocks 6.6)
   Recommended: yes, when an email is given; the owner's screen (feature 11
   or 12b) can add a "don't send" box later.
5. **Is the booked worker told by email?** (blocks 6.6) Recommended: not in
   this feature. A worker with Google sees the event already; one with a
   login but no Google, or neither, is feature 19's question, as the build
   plan allows.
