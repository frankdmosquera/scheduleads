# Independent Review

**Status:** changes-requested
**Target commit:** ec5167db1d12deccff22024d69f114e2bef26976
**Base commit:** 925920165bc7dc4dad188019dc1ad4a827ea9574
**Base ref:** main
**Spec hash:** 268a2bce7caebde1b91fc72fc30526d27381f493e8c3a1edaab08655fe255903
**Prepared by:** claude
**Builder model:** claude-opus-5
**Requested reviewer:** claude
**Requested model:** claude-opus-5
**Requested execution:** automatic
**Requested at:** 2026-09-22T00:00:00Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-opus-5
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-23T04:42:26Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** changes-requested
**Check result:** not-required

## Handoff

Review the active spec and the complete `925920165bc7dc4dad188019dc1ad4a827ea9574..ec5167db1d12deccff22024d69f114e2bef26976`
delta in a fresh session or isolated subagent without the builder conversation.
Run all Audit lenses from scratch. Run Check when required above. Do not edit
product code, accept findings, or reuse the existing findings as the review
scope.

This is the second review of this work item. The ledger carries F-01, F-02 and
F-04 at status `fixed` and F-03 at `open`. Verify each claimed repair against
the code and move it to `closed` only when the repair actually holds; leave or
reopen anything that does not. The prior findings are not the scope: run all
four lenses across the whole delta as if seeing it for the first time.

## Commands

- `npm run build --workspace=backend`: pass
- `npm run build --workspace=frontend`: pass
- `npm run lint --workspace=frontend`: pass
- `npm run db:generate --workspace=@scheduleads-app/shared`: pass, "No schema changes, nothing to migrate", no migration file emitted, no file hash changed
- `npm run db:migrate --workspace=@scheduleads-app/shared` against an empty database: unavailable, this review may not create a database or modify a row
- unit tests: unavailable, no test runner is configured in this project
- browser tests: unavailable, no browser harness is configured in this project
- `/check`: not run, the request records Check as not required

## Evidence

- Freshness verified before reviewing: `HEAD` equals `ec5167db...`, `git merge-base main HEAD` equals `925920165b...`, the SHA-256 of `blueprint/context/current-feature.md` equals the recorded spec hash, and `git status --porcelain` showed only `blueprint/context/review.md` modified, both before and after every command above.
- Reviewed the 13-commit delta across 75 files: the backend guards (`index.ts`, `lib/auth.ts`, `lib/active-organization.ts`, `lib/plan-gate.ts`, `lib/send-login-code.ts`, `database.ts`), `packages/shared` in full, the migration ledger, the four frontend files and `components/auth-card.tsx`, `AGENTS.md`, `.env.example`, `blueprint/config.json` and the three changed skill files.
- Tenant boundary traced against the installed better-auth 1.7.5 source rather than the code's comments. Every request-supplied `organizationId` in the mounted plugin routes passes `adapter.checkMembership` first: `set-active` (`crud-org.mjs:421`), `get-organization` (`crud-org.mjs:322`), `get-full-organization` (`crud-org.mjs:365`). `get-active-member` reads only `session.session.activeOrganizationId` (`crud-members.mjs:396`). `checkMembership` filters on both `userId` and `organizationId` (`adapter.mjs:409`). The app's own `/me` derives its id from the session alone.
- Refusals fail closed, checked path by path: a missing organization row resolves to `rung = null`, `getPlanLimits` returns the locked set and the gate refuses; `getActiveMember` throwing falls through to a membership lookup still scoped to the session's own user; two memberships with no active choice returns null and is refused rather than guessed.
- Platform-admin surface verified safe for an ordinary user: `user.role` is `input: false` in the admin plugin's own schema, and a null role resolves through `hasPermission` (`admin/has-permission.mjs:6`) to the permissionless `user` role in `admin/access/statement.mjs`. The custom `owner` role really cannot delete an organization: `crud-org.mjs:325` checks the `organization: ["delete"]` permission and `allowCreatorAllPermissions` is false there.
- OTP brute force is bounded at 3 attempts by default (`email-otp/routes.mjs:771`) and the send and verify routes carry their own 3-per-60s rate-limit rules (`email-otp/index.mjs:75-137`).
- Runtime probes against the already-running dev API, read-only, no rows touched: `GET /health` 200; unauthenticated `GET /me` 401 with the shared refusal shape; `GET /me` with an unlisted `Origin` returns no `Access-Control-Allow-Origin`, while the configured origin does; unauthenticated `/api/auth/organization/list` and `/api/auth/organization/get-full-organization?organizationId=anything` both 401.
- Standards checked: no em dash (U+2014) anywhere in the delta, no AI attribution in any commit message or file, `blueprint/config.json` parses, and the config and skill changes in this delta tighten gates rather than loosen them.

## Findings

- F-05 [P1] open. The blocker. Signup and organization creation are wide open against a written product decision.
- F-06, F-07, F-08, F-09 [P2] open. Fresh findings in the migration ledger, the plan gate's stated rule, the production env fallbacks and the standards file.
- F-10, F-11 [P3] open. Spec and `.env.example` claims that no longer match what shipped.
- F-01 [P1] and F-02 [P2] verified against the code and moved to `closed`. F-01's claim was tested by running the real `db:generate` and hashing the ledger before and after, not accepted from the note.
- F-04 [P3] verified and moved to `closed`. The `transpilePackages` bullet is present and the state it describes is real; two other spec gaps survived and became F-10 instead of holding this entry open.
- F-03 [P2] re-confirmed unchanged and left `open`. P2 does not block.

## Remaining risk

- No unit test runner and no browser harness exist, so nothing automated covers `getPlanLimits` or the active-organization fallback, which are the two pieces the tenant boundary rests on. `verification.logicTests` is `when-configured`, so no gate is violated, but the tests lens found no coverage to assess. Both commands are listed unavailable above.
- `npm run db:migrate` against an empty database is unavailable to this review, so F-06 rests on reading the SQL and Postgres's documented `ADD COLUMN IF NOT EXISTS` behaviour rather than on a reproduction.
- F-05 was likewise not reproduced end to end, because signing up and creating an organization both write rows. It rests on the better-auth 1.7.5 source lines cited in the finding.
- `/check` was not run; the request did not require it, so no behaviour was proved against the spec's Done-when gates in this pass.
- Production cookie behaviour cannot be exercised locally. `sameSite: "none"`, `secure`, `partitioned` and `crossSubDomainCookies` are all on the `NODE_ENV === "production"` branch, and only the development branch was observed.
- `user.additionalFields.role` in `auth.ts` re-declares a field the admin plugin already declares identically. Verified harmless today, and not recorded as a finding, but whichever declaration wins the merge is an implementation detail of better-auth that a future upgrade could change.
- The published build log was reviewed only as the tracked `blueprint/context/project-log.html` source. Whether the live artifact matches it could not be checked from here.
