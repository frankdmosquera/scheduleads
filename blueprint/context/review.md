# Independent Review

**Status:** changes-requested
**Target commit:** 3ae2eca15922fafa2ce7f33afc635605862f2fbe
**Base commit:** 7abbf56d796fc9fe02f4902afe85d99b9376ab97
**Base ref:** main
**Spec hash:** ca4278560a18fceda9aaa9d109f5588e4bffdf7027c7e837308adbe5bae1b66a
**Prepared by:** claude
**Builder model:** claude-opus-5-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5-5
**Requested execution:** automatic
**Requested at:** 2026-10-27T14:45:24Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-10-27T14:52:00Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** changes-requested
**Check result:** not-required

## Handoff

Review the active spec and the complete `7abbf56d796fc9fe02f4902afe85d99b9376ab97..3ae2eca15922fafa2ce7f33afc635605862f2fbe` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain`: pass (HEAD, merge base and spec hash match the request; only review.md differed)
- `npm run test --workspace=backend`: pass (96 files, 1093 tests)
- `npm run test --workspace=@scheduleads-app/shared`: pass (32 files, 210 tests)
- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `/check`: not run (not required by the request)

## Evidence

- Read the whole delta: the new resolver, signing-record lookup, agency key reader and fallback in `send-email.ts`; the booking, move, cancellation and text-reply senders; the card's state, save, route, schema and frontend; provision-client and the admin form; save-resource and find-people-settings; and every changed test.
- Tenant scope: `findBookingEmailContext` joins every table on the booking's own organization; `findBusinessEmailDetails` reads the organization and its first owner by `organizationId` only; the card routes take the business from the session. No cross-business read found.
- Secrets and addresses: `send-email.ts` logs kind and idempotency key only, Resend errors keep name and status only, the card answer carries no key, and the fallback test asserts no line holds the business domain. The live key is never logged; tests set a fake one before import.
- Fallback idempotency: the second send uses `<key>/agency`, so a job retry that hits the same 403 reuses the cached agency send instead of sending twice; the test checks both keys and two timeline entries.
- DNS check: `resolveTxt("resend._domainkey.<domain>")`, a non-empty `p=` required, failures count as not set up, kept an hour per domain; tests fake `node:dns/promises`, and no route test reaches real DNS (their businesses either save a sender or have no website).
- Trust gap behind F-531: `emailSendingValidationSchema` accepts any address, `saveEmailSending` stores it, and `resolveBusinessSender` returns it unchecked for the agency key; the website is written only by the platform admin's provision path.

## Findings

- F-531 [P1] open: any business owner can make the agency key send from another client's domain or booking-crm.com (blocking)
- F-532 [P2] open: the card claims a saved sender's domain even when Resend refuses it and emails go from booking-crm.com
- F-533 [P3] open: `.env.example` still describes per-business Resend keys
- F-534 [P3] open: fallback log line names the booking, not the business, and says "sent" before trying
- F-535 [P3] open: DNS lookup has no time limit and runs inside save-resource's transaction
- F-536 [P3] open: website-domain work-email path and text-reply fallback untested; one test fakes an impossible DNS throw

## Remaining risk

- `/check` was not run (not required): the card on http://localhost:3400 was not seen in a browser.
- Whether Resend caches a 403 under an idempotency key is not verified; if it does not, a job retry after the business's domain is verified within 24 hours could send the same email once from each sender.
- The agency key's domain reach in Resend (the spec's open question) is outside the code and unverified; it decides whether rule 2 and F-531 behave as described.
- Any member of a business, whatever its role, can now read the owner's login email through the card's `noticesTo`; same business only, noted, not raised.
- The dashboard activity helper (`run.json`) was not written: this reviewer was limited to findings.md and review.md.
