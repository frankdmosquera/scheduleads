# Independent Review

**Status:** passed
**Target commit:** 296314a364dbb8c0468af42bcefb1db5694f7555
**Base commit:** c2173536dc775768d51b40250145b611b0a2f9df
**Base ref:** main
**Spec hash:** fbc2f813f028b91c760452a4394861bb751e1bf1022bd521331bfd3785eaeb60
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-24T03:56:47Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-24T04:01:46Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `c2173536dc775768d51b40250145b611b0a2f9df..296314a364dbb8c0468af42bcefb1db5694f7555` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `npm run test --workspace=@scheduleads-app/shared`: pass (30 files, 203 tests)
- `npm run test --workspace=backend`: pass (91 files, 1059 tests, against local `scheduleads_dev` with 0031 applied)
- `npm run test --workspace=@frankdmosquera/booking-component`: pass (18 files, 98 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run format:check`: pass
- `npm run email:preview --workspace=backend`: pass (14 previews, English and Spanish; read the Spanish subjects and bodies)

## Evidence

- Freshness: `HEAD` = target, `git merge-base main HEAD` = base, spec SHA-256 matches, only `blueprint/context/review.md` differed from the target.
- Focus on 12i.3 (`515f930..296314a`), read against the whole `c217353..296314a` range.
- Migration 0031: adds `organization.language` and `booking.language` as `text DEFAULT 'en' NOT NULL` with `in ('en','es')` checks, so every existing row is English; additive only, matches the Drizzle tables.
- Email languages: the three customer renders (`booking-confirmation`, `booking-moved`, `booking-cancelled`) use `facts.language` (the booking's) for words, `when`, subject and `<html lang>`; the three owner renders use `facts.business.language`. `findBookingEmailContext` fills them from `booking.language` and `organization.language`.
- Booking route stores `body.language ?? null`, and `bookTime` falls back to the business's language read through the booking link's own organization join; the schedule route sends none, so an owner's booking takes the business's.
- Customer page: `findBookingPage` returns the booking's language and writes `when` in it; the move-times query carries it; the loaded frame has `lang`; before load it uses `useSyncExternalStore` with a server snapshot of English, so no hydration mismatch.
- Settings: `PUT /settings/booking-form/rules` keeps `requirePermissionMiddleware({ organization: ["update"] })`; `language` is an optional enum, saved only when sent (partial save keeps it), refused with 400 otherwise; the field sits inside the card's `disabled={!canEdit}` fieldset.
- Client setup: optional `language`, applied only while the business has no service, listed as a difference after; tenant-scoped by `organizationId`.
- Tenant scoping: every new read is on rows already scoped by session `organizationId`, the slug's business, or the signed booking token; no client-supplied ownership. Security: the only new inputs are `en`/`es` enums. Performance: no new queries beyond added columns on existing selects.
- Spanish wording read in `email-words.ts`, `customer-booking-words.ts` and the preview output: "usted" throughout, accents present, days lowercased inside subjects and the moved/cancelled previews.

## Findings

- F-462 [P2] open - A Spanish customer's calendar invite still reads "<service> with <business>"
- F-463 [P2] open - No test carries a Spanish booking from the database into its emails or its page
- F-464 [P3] open - The customer page's loading and failure screens speak the browser's language with no lang, under an English tab title
- F-465 [P3] open - A few Spanish lines read wrong (confirmation preview capital, gendered "lo", "no puede cargar", "4 oct al 10")
- F-466 [P3] open - The booking body's schema comment says left out means English; the booking stores the business's

## Remaining risk

- Check was not required and was not run: no browser pass of the Spanish customer page or the Settings field in this review.
- The emails were read as rendered HTML from the preview script, not as delivered through Resend to a real inbox.
- `drizzle-kit` snapshot consistency for 0031 was not re-generated (no generate run, to keep the tree unchanged); the SQL and the tables were compared by hand.
- 12i.3.5 (publishing 0.2.0) is deliberately not done; the package carries `version` 0.2.0 unpublished.
