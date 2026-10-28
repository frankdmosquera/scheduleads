# Feature: The business's look

**From build-plan:** feature 25e

**Size:** heavy - two separate risks with real logic: pictures uploaded by owners (files from outside, stored for every business) and one colour theme that changes three places (the booking window, the dashboard and the emails); then real data on the live app.

**Branch:** feature/25e-the-business-s-look

**Status:** verified

## Goal

An owner opens Settings > Look and makes Booking CRM look like her business: she uploads her
logo, picks her colours (or starts from a ready palette), and, if she wants, gives each service a
photo. Her customers see her logo, her colours and her photos in the booking window on her own
site and in their emails; she sees her colours in her own dashboard. Face and Body is first: her
logo, her site's colours and light free photos for her services.

## In scope

- **Where pictures live (Frank, Oct 28).** A business's own look (its logo and its service
  photos, a few small public pictures, like a website's) is uploaded to the agency's ImageKit, in
  one folder per business. Documents and records a business keeps about its customers never go
  there: they will go to Cloudflare R2, later (plan B, not this feature).
- **Uploading.** The dashboard shrinks each picture in the browser before it is sent (a logo to
  at most 600 px, a service photo to at most 1200 px, as WebP), so every picture stays light. The
  API accepts PNG, JPEG or WebP only, checked by the file's own bytes, never SVG (it can carry
  script), at most 1 MB, and only from a login that may change the business. It uploads to
  ImageKit through ImageKit's web API (no package) and saves the picture's address and its
  ImageKit file id; replacing or removing a picture deletes the old file from ImageKit.
- **Settings > Look**, a new Settings page: the logo (upload, see, replace, remove), the colours
  (step 25e.2), read-only for a login that may not change the business, as every Settings page.
- **A photo per service**, optional, on the service's card in Settings > Services (upload, see,
  replace, remove).
- **Where they show.** The booking window: the logo where it already shows the business (the
  rail), the service photo on the service card and at the top of the rail; ImageKit serves a small
  size by its address (`?tr=w-...`). The emails already show the logo: they now get the uploaded
  one.
- **The colours (step 25e.2).** A theme of three colours: the main colour (buttons, highlights;
  the existing `brandColor`), the background and the text. The text on the main colour is worked
  out for contrast (the existing `textColorOn`), never picked. A few ready palettes fill the three
  pickers in one click; none is applied until saved, and a business with no theme looks as today.
  The window, the owner's dashboard (its accent colour) and the emails wear it. In the window the
  business's colours win over any `--sa-*` colour a site sets in its own CSS; a site's own font and
  corner radius still apply.
- **Face and Body (step 25e.3)**: her logo (from her site), her site's colours, and a light free
  photo for each service (Unsplash or Pexels, whose licences allow it), set through her setup file
  or Settings, then on the live app and in her site with the new window.

## Out of scope

- Documents, files and records for customers (R2, plan B, a later feature).
- Fonts, corner radius and layout: the site's own CSS keeps them.
- A picture gallery, several photos per service, or cropping in the dashboard.
- The customer's booking page and the dashboard's look beyond its accent colour.

## Build loop

Heavy: each step's plan gets Frank's yes just before it is built, then runs straight through
(build, tests, build log, commit and push to the feature branch, `/audit` scoped to the step, the
independent review) without asking; the stop is after the review. A line only Frank crosses stops
it earlier: the ImageKit key on Railway, real data on the live app, `main`, a merge.

## Build steps

- [x] **25e.1 Pictures** - `organization.logoFileId` and `booking_link.imageUrl` / `imageFileId`
  (migration), the upload route with its checks, ImageKit upload and delete, Settings > Look with
  the logo, the photo on each service's card, and the window showing both (package 0.2.4). The
  key `IMAGEKIT_PRIVATE_KEY` in the laptop's `.env` (ImageKit's answer carries each picture's
  full address, so no endpoint is needed), uploads from the laptop going to a `booking-crm-dev`
  folder.
  **Done when:** on the laptop, Riverbend Clinic's owner uploads a logo and a service photo; the
  window's rail shows the logo, the service card and rail the photo, the confirmation email
  (rendered in the test) the logo; replacing one deletes the old file in ImageKit; a PDF, an SVG,
  a file over 1 MB and a member who may not change the business are each refused with a message;
  another business's service cannot get a photo; every suite, both builds, lint and format pass.
- [x] **25e.2 Colours** - the theme (three colours and the ready palettes) on Settings > Look,
  the public answer carrying it, the window's colours from it, the dashboard's accent from it, and
  the emails' main colour from it.
  **Done when:** on the laptop, picking a palette and saving changes the window, the owner's
  dashboard and a rendered email; a light main colour gets dark text; a business with no theme
  looks exactly as before; every suite, both builds, lint and format pass.
- [x] **25e.3 Face and Body live** - her logo, colours and service photos, the ImageKit key on
  Railway (Frank's yes), the migration on live before the merge, her look applied on live, and
  her site on the new window.
  **Done when:** her live booking page shows her logo, her colours and the service photos.

## Files / areas

- `packages/shared/db` (organization, booking_link) and a migration; `packages/shared/zod-validation` (theme, palette)
- `backend/lib/images/` (the ImageKit upload and delete, the file check), `backend/routes/settings-routes.ts` (logo, service photo, theme), `backend/routes/public-booking-links-routes.ts`, `backend/lib/email/`
- `frontend/app/(dashboard)/settings/look/`, `frontend/components/settings/` (Look page, picture field, theme picker), `settings-frame.tsx`, the dashboard layout (accent colour)
- `packages/booking-component/` (rail, service card, colours), version 0.2.4 then 0.2.5
- `packages/shared/client-setups/face-and-body.ts`

## Data / contracts

- `organization.logo` (exists, the picture's address) plus `organization.logoFileId text null`;
  `booking_link.imageUrl text null`, `booking_link.imageFileId text null`. Theme (25e.2):
  `organization.brandColor` (exists) plus `backgroundColor` and `textColor`, each `#rrggbb` or null.
- `PUT /settings/look/logo` (multipart, one file), `DELETE /settings/look/logo`,
  `PUT /settings/services/:id/image`, `DELETE /settings/services/:id/image`: change-business
  permission, the business from the session, a service found only inside it; answers the new
  address. Refusals: 400 with the field's message (type, size), 413 over the form's size limit,
  403, 404, 503 `unavailable` when ImageKit fails or its key is missing (nothing saved).
- Public: `business.logo` (exists), each service's `imageUrl`; 25e.2 adds `business.theme:
  { main, mainInk, background, text } | null`.

## Testing

- The file check: PNG, JPEG and WebP by their bytes pass; SVG, PDF, a renamed text file and a file
  over 1 MB are refused.
- The routes: upload, replace (old file deleted), remove, permission, another business's service;
  ImageKit is reached through one seam the tests replace, so no test uploads for real.
- The window: the logo and the photo show, and nothing shows without them; 25e.2: the colours
  from the theme, the ink from the main colour, no theme leaves the defaults.

## Notes for the AI

- ImageKit's upload API: `POST https://upload.imagekit.io/api/v1/files/upload` with basic auth
  (the private key, empty password); delete with `DELETE https://api.imagekit.io/v1/files/:fileId`.
  Use `fetch`, no package. The private key never reaches the frontend.
- Read `blueprint/context/coding-standards.md` before changing code: one export per backend
  file, types end in `Type`, the upload route validates before any database call.

## Implementation walkthrough

**Where pictures live (Frank, Oct 28).** A business's own look, its logo and its service photos, goes to the agency's ImageKit, one folder per business (`/booking-crm/<business id>/` live, `/booking-crm-dev/` on the laptop). Documents a business keeps about its customers never go there: they will go to Cloudflare R2 later. Uploads use ImageKit's web API with `IMAGEKIT_PRIVATE_KEY` (key "booking-crm", media read and write only), no package.

**25e.1 Pictures.** Migration 0036 adds `organization.logoFileId` and `booking_link.imageUrl` / `imageFileId`. The dashboard shrinks each picture before sending it (`frontend/lib/shrink-picture.ts`: a logo to 600 px, a photo to 1200 px, WebP, or Safari's PNG kept while it fits, else JPEG on white). The API (`backend/lib/images/`) takes PNG, JPEG or WebP checked by their own bytes, never SVG, at most 1 MB, from a login that may change the business, and a photo only for a service of this business, checked before any upload; replacing or removing a picture deletes the old file once nothing points at it, and a save that fails deletes the new one. Settings > Look holds the logo; each service's card holds its photo (`picture-field.tsx`). The window (0.2.4) shows the photo on the service card and above the side panel, and the logo, each asked of ImageKit at its size through the shared `imageKitSized`; the emails ask for the logo as a PNG, which Outlook shows.

**25e.2 Colours.** Migrations 0037 and 0038 add `backgroundColor`, `textColor` and `coloursOn`; the main colour is the existing `brandColor`. The Colours card on Look has three pickers, six ready palettes and a sample; text too faint on its background (under 4.5) is refused. The colours are worn only once saved on Look (`coloursOn`), so a `brandColor` set earlier for the emails recolours nothing. The window (0.2.5) sets them as its own `--sa-*` tokens on the dialog, over a site's CSS colours, with the softer greys mixed from text and background; where the main colour is text, a shade of it that reads at 4.5 on the background and the free days' disc is used (`readableOn`). The dashboard's highlight is the main colour, shaded to read on its page, and shows at once after a save.

**25e.3 Face and Body.** The setup file carries a `look` (a logo already online and the three colours) and a `photo` per service, filled only where missing and listed, never applied, where something is already set (an email colour set earlier included). Her file holds her orchid logo, her site's Copper colours (#c0704f on #f7f2ea, text #1c1a17) and one of eight free Unsplash photos per kind of service, kept in ImageKit's `booking-crm/face-and-body/`. On Oct 28 migrations 0036 to 0038 went on the live database through the tunnel before the merge, and her look was applied live ("the logo, the colours, 37 photos").

**Proof.** Shared 227 tests, backend 1116, window 108; both builds, lint and format. By hand on the laptop: a real logo and photo uploaded to ImageKit and shown in the window; Rose clay saved, the dashboard and the window wearing it; her laptop site with her logo, colours and photos.

**Reviewed.** Each step by fresh reviewers until it passed: 25e.1 three rounds (F-558 to F-567), 25e.2 three rounds (F-568 to F-579), 25e.3 one round (F-580 to F-582). Carried: F-567, F-578 (the dashboard's dark mode, which nothing can switch on yet), F-579, F-581, F-582.

## Findings

### 25e/F-558 [P1] closed - A picture shrunk in Safari could come out as a large PNG and be refused

**File:** frontend/lib/shrink-picture.ts
**Found:** 2026-10-28 by independent review of step 25e.1 (fresh subagent; scope: 4709e04..f958a28)
**Why it matters:** `canvas.toBlob(..., "image/webp")` falls back to PNG where a browser cannot write WebP (Safari), and nothing checked the blob's type: a 1200 px photo became a PNG of 2-3 MB, refused as over 1 MB, and was sent named `picture.webp`.
**Suggested fix:** When the blob is not WebP, encode again as JPEG; name the file from its real type.
**Resolution:** fixed 2026-10-28: WebP, else JPEG at 0.85, named by the type it really has.
Closed 2026-10-28 by independent re-review (fresh subagent, f958a28..72d2649): a non-WebP blob is encoded again and named by its real type; its fix raised F-566.

### 25e/F-559 [P2] closed - Emails showed the uploaded WebP logo, which Outlook does not display

**File:** backend/emails/email-layout.tsx
**Found:** 2026-10-28 by independent review of step 25e.1 (fresh subagent; scope: 4709e04..f958a28)
**Why it matters:** Every uploaded logo is WebP; classic Outlook for Windows shows a broken image.
**Suggested fix:** Ask ImageKit for a PNG at email size.
**Resolution:** fixed 2026-10-28: the email asks `tr=f-png,w-280` through the shared `imageKitSized`, which leaves any non-ImageKit address as it is.
Closed 2026-10-28 by independent re-review (fresh subagent, f958a28..72d2649): email-layout.tsx asks `tr=f-png,w-280`; the email test checks it.

### 25e/F-560 [P2] closed - The picture preview broke on an address that already had a question

**File:** frontend/components/settings/picture-field.tsx
**Found:** 2026-10-28 by independent review of step 25e.1 (fresh subagent; scope: 4709e04..f958a28)
**Why it matters:** `${picture}?tr=w-192` breaks an address with its own query, such as a logo set by address before 25e.
**Suggested fix:** Use the `?`/`&` rule the window uses.
**Resolution:** fixed 2026-10-28: one shared `imageKitSized` for the preview, the window and the email; only ImageKit addresses get a transform.
Closed 2026-10-28 by independent re-review (fresh subagent, f958a28..72d2649): imageKitSized takes only ik.imagekit.io or *.imagekit.io, leaves a broken address alone, three tests; the window bundles it.

### 25e/F-561 [P3] closed - The hidden file input took a keyboard stop with no visible focus

**File:** frontend/components/settings/picture-field.tsx
**Found:** 2026-10-28 by independent review of step 25e.1 (fresh subagent; scope: 4709e04..f958a28)
**Why it matters:** Tab landed on an invisible control before the Upload button.
**Suggested fix:** `tabIndex={-1}` on the input; the button opens it.
**Resolution:** fixed 2026-10-28.
Closed 2026-10-28 by independent re-review (fresh subagent, f958a28..72d2649): tabIndex={-1} on the labelled hidden input.

### 25e/F-562 [P3] closed - The 413 path for a form over the size limit was never tested

**File:** backend/routes/settings-routes.test.ts
**Found:** 2026-10-28 by independent review of step 25e.1 (fresh subagent; scope: 4709e04..f958a28)
**Why it matters:** The "over 1 MB" case sent 1,050,000 bytes, under the 1.1 MB body limit, and accepted either 400 or 413.
**Suggested fix:** A 1.2 MB case that expects 413.
**Resolution:** fixed 2026-10-28: 1,050,000 bytes expects 400, 1,200,000 expects 413 with the refusal shape.
Closed 2026-10-28 by independent re-review (fresh subagent, f958a28..72d2649): 400 at 1,050,000 bytes and 413 with bad_request at 1,200,000.

### 25e/F-563 [P3] closed - The spec said 502 where the code answers 503 when ImageKit fails

**File:** blueprint/context/current-feature.md (Data / contracts); backend/routes/settings-routes.ts
**Found:** 2026-10-28 by independent review of step 25e.1 (fresh subagent; scope: 4709e04..f958a28)
**Why it matters:** The contract and the code disagreed.
**Suggested fix:** Make them agree.
**Resolution:** fixed 2026-10-28: the spec now says 503 `unavailable` (and 413 over the form limit), as the code does and as every other "cannot be read right now" answer in the API is.
Closed 2026-10-28 by independent re-review (fresh subagent, f958a28..72d2649): the spec lists 413 and 503 unavailable.

### 25e/F-564 [P3] closed - A save that failed after the upload left the new picture in ImageKit

**File:** backend/routes/settings-routes.ts (the logo and service photo routes)
**Found:** 2026-10-28 by independent review of step 25e.1 (fresh subagent; scope: 4709e04..f958a28)
**Why it matters:** A database fault after a successful upload left a file nothing points at.
**Suggested fix:** Delete the stored file when the save throws.
**Resolution:** fixed 2026-10-28: `keepOrUndo` deletes it, then the fault answers as before.
Closed 2026-10-28 by independent re-review (fresh subagent, f958a28..72d2649): after the commit only the old file is deleted, by a function that never throws, so keepOrUndo only runs on an uncommitted save.

### 25e/F-565 [P3] closed - The empty photo box repeated its own label

**File:** frontend/components/settings/service-form.tsx
**Found:** 2026-10-28 by independent review of step 25e.1 (fresh subagent; scope: 4709e04..f958a28)
**Why it matters:** "Photo (optional)" showed as the label and again inside the empty box.
**Suggested fix:** Its own words.
**Resolution:** fixed 2026-10-28: "No photo yet" / "Aún sin foto".
Closed 2026-10-28 by independent re-review (fresh subagent, f958a28..72d2649): lookWords.noPhoto in English and Spanish.

### 25e/F-566 [P2] closed - On Safari a see-through logo would have been stored with a black box behind it

**File:** frontend/lib/shrink-picture.ts
**Found:** 2026-10-28 by independent re-review of step 25e.1 (fresh subagent; scope: f958a28..72d2649), raised by the F-558 fix
**Why it matters:** JPEG has no see-through, and the canvas was never filled, so a transparent PNG logo re-encoded as JPEG on Safari came out on black, in the window and in every email.
**Suggested fix:** Keep Safari's PNG while it fits under 1 MB; use JPEG only for larger pictures.
**Resolution:** fixed 2026-10-28: Safari's PNG is kept up to 900 KB (a 600 px logo nearly always is; a noisier one takes the JPEG path); a larger picture becomes JPEG with white behind it, never black.
Closed 2026-10-28 by independent re-review (fresh subagent, 72d2649..4245aec): every path checked; a PNG is sent only up to 900,000 bytes, a JPEG gets white where the picture was see-through, null still shows the "not a picture" line; build and lint pass.

### 25e/F-568 [P1] closed - The main colour was written as text on the background with no readability check

**File:** packages/booking-component/booking-window/theme-style.ts; frontend/lib/business-accent-style.ts
**Found:** 2026-10-28 by independent review of step 25e.2 (fresh subagent; scope: 368b727..31dbc20)
**Why it matters:** `--sa-identity` is the window's text colour for day numbers, times and the business's name; the shipped Rose clay put #b5838d on #fbf6f2 (2.97:1), an amber on white 2.15:1, and a dark background with no main colour left the times near-black on near-black. The dashboard used the main colour as text on its active menu item and tags too.
**Suggested fix:** Keep the main colour on the buttons; where it is text, use it only when it reads at 4.5, else a readable shade.
**Resolution:** fixed 2026-10-28: the shared `readableOn` mixes the colour toward black (or white on a dark background) until it reads at 4.5 and keeps its hue; the window's identity tokens and the dashboard's highlight use it; with no main colour the buttons take the text colour. Tests cover Rose clay, amber on white and a dark background.
Reopened 2026-10-28 by independent re-review (31dbc20..4906585): the shade read on the background but not on the free days' grey disc (F-575). Fixed again: the shade is taken against the disc, then checked on the background.
Closed 2026-10-28 by independent re-review (fresh subagent, 4906585..d9ab953): run against the real theme-style: every palette, amber and yellow on white and eight random pairs read at 4.5 or more on the background and the disc (lowest 4.63).

### 25e/F-569 [P2] closed - The window flashed white while a service loaded

**File:** packages/booking-component/booking-window/booking-window.tsx
**Found:** 2026-10-28 by independent review of step 25e.2 (fresh subagent; scope: 368b727..31dbc20)
**Why it matters:** The loading screen carries no business, so the theme reset to the default white between screens; with a dark palette every pick and every retry flashed.
**Suggested fix:** Keep the last theme.
**Resolution:** fixed 2026-10-28: the last business's theme is kept while a screen without one shows.
Closed 2026-10-28 by independent re-review (fresh subagent, 31dbc20..4906585): the theme is kept while the loading screen shows; a business with none resets it.

### 25e/F-570 [P3] closed - The Look page showed an old email colour as if the window already wore it

**File:** backend/lib/settings/find-look-settings.ts; frontend/components/settings/colours-card.tsx
**Found:** 2026-10-28 by independent review of step 25e.2 (fresh subagent; scope: 368b727..31dbc20)
**Why it matters:** The main colour is pre-filled from the brandColor set earlier for the emails, with a hint saying the window wears it.
**Suggested fix:** Say it is not shown yet.
**Resolution:** fixed 2026-10-28: until colours are saved the card says they are not shown yet, and that a main colour already there is the emails' one.
Closed 2026-10-28 by independent re-review (fresh subagent, 31dbc20..4906585): coloursOn reaches the card; after a save it follows the same rule as the API.

### 25e/F-571 [P3] closed - The Reset button's spoken name did not contain "Reset"

**File:** frontend/components/settings/colours-card.tsx
**Found:** 2026-10-28 by independent review of step 25e.2 (fresh subagent; scope: 368b727..31dbc20)
**Why it matters:** Voice-control users saying "click Reset" missed it (WCAG 2.5.3).
**Suggested fix:** "Reset main colour" as its name.
**Resolution:** fixed 2026-10-28; the longer wording stays as its title.
Closed 2026-10-28 by independent re-review (fresh subagent, 31dbc20..4906585): resetColour is the name, the old wording the title.

### 25e/F-572 [P3] closed - The palette buttons did not say which one is picked

**File:** frontend/components/settings/colours-card.tsx
**Found:** 2026-10-28 by independent review of step 25e.2 (fresh subagent; scope: 368b727..31dbc20)
**Why it matters:** Nothing told a screen reader, or the eye, which palette the pickers hold.
**Suggested fix:** `aria-pressed`.
**Resolution:** fixed 2026-10-28: pressed when the three colours match it, and drawn highlighted.
Closed 2026-10-28 by independent re-review (fresh subagent, 31dbc20..4906585): aria-pressed is on and drawn.

### 25e/F-573 [P3] closed - "muy tenue ... para leerse" read badly in Spanish

**File:** packages/shared/helpers/spanish-messages.ts
**Found:** 2026-10-28 by independent review of step 25e.2 (fresh subagent; scope: 368b727..31dbc20)
**Why it matters:** "demasiado tenue" is the natural phrase.
**Suggested fix:** Use it.
**Resolution:** fixed 2026-10-28.
Closed 2026-10-28 by independent re-review (fresh subagent, 31dbc20..4906585): "demasiado tenue".

### 25e/F-574 [P3] closed - The contrast measure was written twice

**File:** packages/shared/helpers/text-color-on.ts; contrast-ratio.ts
**Found:** 2026-10-28 by independent review of step 25e.2 (fresh subagent; scope: 368b727..31dbc20)
**Why it matters:** Two copies of the luminance code can drift.
**Suggested fix:** One.
**Resolution:** fixed 2026-10-28: `textColorOn` uses `contrastRatio`.
Closed 2026-10-28 by independent re-review (fresh subagent, 31dbc20..4906585): the old and new textColorOn agree on about 125,000 colours.

### 25e/F-575 [P2] closed - The window's colour fell just short of readable on the free days' grey disc

**File:** packages/booking-component/booking-window/theme-style.ts; booking-component.css (.sa-d[data-free], hover states)
**Found:** 2026-10-28 by independent re-review of step 25e.2 (fresh subagent; scope: 31dbc20..4906585)
**Why it matters:** A free day's number (14 px bold, not large text) sits on the second surface, a little darker than the background: Rose clay read 4.40, amber on white 4.33, the worst random case 3.91.
**Suggested fix:** Shade against the disc, the darker of the two.
**Resolution:** fixed 2026-10-28: the shade is taken against the disc (6% of the text in the background, as the CSS mixes it), then checked on the background; tests check both for Rose clay and amber.
Closed 2026-10-28 by independent re-review (fresh subagent, 4906585..d9ab953): the disc mix matches the CSS's 6%; Rose clay gives #7f5c63, 4.87 on the disc.

### 25e/F-576 [P3] closed - The required-field star used the raw main colour

**File:** packages/booking-component/booking-component.css (.sa-req::after)
**Found:** 2026-10-28 by independent re-review of step 25e.2 (fresh subagent; scope: 31dbc20..4906585)
**Why it matters:** Text in --sa-action, amber on white at 2.15.
**Suggested fix:** --sa-identity.
**Resolution:** fixed 2026-10-28.
Closed 2026-10-28 by independent re-review (fresh subagent, 4906585..d9ab953): .sa-req::after uses --sa-identity.

### 25e/F-577 [P3] closed - The kept theme was written to a ref during render

**File:** packages/booking-component/booking-window/booking-window.tsx
**Found:** 2026-10-28 by independent re-review of step 25e.2 (fresh subagent; scope: 31dbc20..4906585)
**Why it matters:** Breaks React's pure-render rule; a thrown-away render could keep a theme never shown.
**Suggested fix:** State.
**Resolution:** fixed 2026-10-28: kept in state, set in an effect; the screen's own theme shows at once.
Closed 2026-10-28 by independent re-review (fresh subagent, 4906585..d9ab953): the screen's own theme shows in the same render; the kept one only without a business; no flash, never stale.

## Independent review

### Receipt

- **Status:** passed
- **Target:** 378540e (each step reviewed until it passed: 25e.1 at 368b727, 25e.2 at 9cb8106, 25e.3 at 378540e after its one round)
- **Base:** 407dcda (merge base with `main`)
- **Spec SHA-256:** 74ff5c58520c7e393173c8525241db798a3d842fc7590d7928f7ea1b019a49cc
- **Builder:** claude, claude-opus-5-5
- **Reviewer:** claude, claude-opus-5-5, a fresh subagent each round (automatic)
- **Check:** by hand on the laptop and against ImageKit (see the walkthrough)
- **Reviewed:** 2026-10-28

### Commands

`npm run test --workspace=@scheduleads-app/shared` (227 passed), `npm run test --workspace=backend` (1116 passed), `npm run test --workspace=@frankdmosquera/booking-component` (108 passed), `npm run build --workspace=@frankdmosquera/booking-component`, `npm run build --workspace=frontend`, `npm run lint --workspace=frontend`, `npm run format:check`.

### Findings

25e.1: F-558 (P1) and F-559 to F-566 fixed and closed; F-567 carried. 25e.2: F-568 (P1) and F-569 to F-577 fixed and closed; F-578 and F-579 carried. 25e.3: F-580 fixed; F-581 and F-582 carried. No P0 or P1 open.

### Remaining risk

The dashboard's dark mode would show a highlight shaded for white (F-578); nothing can switch it on yet.
