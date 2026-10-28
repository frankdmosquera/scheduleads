# Feature: The business's look

**From build-plan:** feature 25e

**Size:** heavy - two separate risks with real logic: pictures uploaded by owners (files from outside, stored for every business) and one colour theme that changes three places (the booking window, the dashboard and the emails); then real data on the live app.

**Branch:** feature/25e-the-business-s-look

**Status:** draft

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

- [ ] **25e.1 Pictures** - `organization.logoFileId` and `booking_link.imageUrl` / `imageFileId`
  (migration), the upload route with its checks, ImageKit upload and delete, Settings > Look with
  the logo, the photo on each service's card, and the window showing both (package 0.2.4). The
  key `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT` in the laptop's `.env`, uploads from the
  laptop going to a `booking-crm-dev` folder.
  **Done when:** on the laptop, Riverbend Clinic's owner uploads a logo and a service photo; the
  window's rail shows the logo, the service card and rail the photo, the confirmation email
  (rendered in the test) the logo; replacing one deletes the old file in ImageKit; a PDF, an SVG,
  a file over 1 MB and a member who may not change the business are each refused with a message;
  another business's service cannot get a photo; every suite, both builds, lint and format pass.
- [ ] **25e.2 Colours** - the theme (three colours and the ready palettes) on Settings > Look,
  the public answer carrying it, the window's colours from it, the dashboard's accent from it, and
  the emails' main colour from it.
  **Done when:** on the laptop, picking a palette and saving changes the window, the owner's
  dashboard and a rendered email; a light main colour gets dark text; a business with no theme
  looks exactly as before; every suite, both builds, lint and format pass.
- [ ] **25e.3 Face and Body live** - her logo, colours and service photos, the ImageKit key on
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
  address. Refusals: 400 with the field's message (type, size), 403, 404, 502 when ImageKit fails
  (nothing saved).
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
