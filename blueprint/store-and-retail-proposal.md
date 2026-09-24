# Retail, and the host-site seam

**Status: proposal. Not approved, not an instruction.**

Nothing in this file has been agreed. It is written to be reviewed, argued
with, and either applied or thrown out. Do not treat any section as settled,
and do not apply the plan edits in section 6 until Frank has read them and
said yes. If you disagree with something here, say so rather than working
around it: this was written in a session that could not see this repo's own
rules or half-built work.

Written 2026-09-22, in a `face-and-body` session, from a long conversation
with Frank about how the clinic's product store should work. It touches this
repo because the conclusion was that the store does not belong in the clinic's
site at all.

The same material with diagrams is at
https://claude.ai/artifact/K9MqXZ6me95FwSePbQxLvU (private to Frank's account).
This file is the version that lives in the repo, and it is the one that counts.

---

## 1. Why this exists

Frank asked how to build a product store for the clinic: server actions, a
Neon database, a dashboard for her, and where products sit relative to the CRM.

Working through it produced one conclusion that lands here rather than there:
**a retail store is a module of this product, not a feature of a marketing
site.** The clinic then becomes its customer, the same way the build plan
already designs booking.

It also produced an answer to an open question this plan already carries.

---

## 2. It answers open question 15

> 15. **Browser-to-API, or proxied through the host's server action?**
> Section 8. Decided at Phase 3, not before.

*(Numbered 12 when this was written. The Open questions list was renumbered to
14 to 19 on 2026-09-22, because it collided with the Decided list at 11, 12 and
13.)*

**Proposed answer: proxied through the host site's own server action.**

This is not a new idea. Section 8 already carries the rationale and leans this
way: *"a public URL anyone can POST to has no auth and no rate limit."* The
conversation reached the same place from the other direction, so this is a
confirmation rather than a discovery.

What the proxy buys, stated plainly:

- The browser never holds a credential, because the server action does.
- The API can stay private. No CORS allow-list to maintain, no public auth
  surface, no token shipped to a visitor.
- Rate limiting and abuse handling sit on a surface you already control.

It costs one hop and it means `WIDGET_ORIGINS` stops being load-bearing for
proxied tenants.

**Caveat worth arguing about:** the plan says decide this at Phase 3, when the
first tenant is wired, and that instinct is sound. The widget in item 9 may
have reasons to call directly that a store does not. It is legitimate to accept
this answer for the retail routes and leave the booking widget open until
Phase 3 as planned.

---

## 3. The architecture, in four claims

**One backend, one database.** Tenant sites own no data. The Hono API is the
only writer to Postgres. There is no second database anywhere, and in
particular the clinic site does not get its own.

**The API exists for you, not for third parties.** Frank's phrasing during the
conversation was that APIs are only needed "for third parties to connect to
us." The correction: the moment data lives in a different deployment from the
Next app there is a network boundary, and its first consumer is your own server
action. Third parties are a later, separate, public surface.

**Do not let a tenant site reach Postgres directly.** Pointing Drizzle at the
same database from a tenant's server actions is technically possible and is the
thing to refuse. Two apps with their own copy of the schema writing to one
database is how stock decrements and tax rules drift apart, and serverless
connection pooling makes it worse. One writer owns the database.

**The dashboard is this frontend.** The clinic does not get an admin panel
bolted onto her marketing site. She gets the CRM, early, with one customer on
it. A dashboard is cheap to build twice; a database is not cheap to move once,
so the data home is fixed from the first row and there is no migration later.

---

## 4. Typesafety across the repo boundary

Item 2 already lands `hc<AppType>` inside this monorepo and specifies the
proof: rename a route and watch the frontend stop compiling. That stays exactly
as written.

The new problem is that a tenant site is a **different repository**, so the
type has to travel. Three options:

1. A published package on GitHub Packages. Versioned. Right answer at two or
   more tenant sites.
2. A git dependency. Works, messy.
3. A hand-written typed wrapper in the tenant site's `lib/`. Honest for one.

**Proposed:** option 3 for the first tenant, promoted to option 1 at the
second, which is Primo at item 13. Publishing a package for a single consumer
is overhead with no payer.

**One detail that matters:** export a narrowed `PublicAppType`, not the whole
`AppType`. A tenant site should not be able to infer the shape of admin routes,
and typechecking an entire Hono app across a package boundary is slow.

What is lost against the monorepo is not typesafety. It is the compiler
checking both sides at the same commit. The backend can ship a breaking change
and a tenant site still builds on its pinned version until someone bumps it. A
version number is the replacement, and it makes the break loud instead of
silent. This is normal for one backend with several frontends.

---

## 5. Retail

### Why it belongs in this product

Every small service business sells something on the side. Spas, salons,
barbers, groomers, trades. Square Appointments, Vagaro, Mindbody, Fresha and
Phorest all carry retail.

Which is the honest framing: **retail is table stakes in this category, not a
differentiator.** Its absence loses deals. Its presence wins none. Budget it
accordingly and do not let it outrank the booking loop.

### The shape

In those competitors, retail is mostly **a line item added to the client's bill
at the counter**, not a public web store. That is the build. Carts, shipping
addresses, delivery and fraud are a different and much larger product.

And most of it already exists in the plan. Item 16, Quotes, lands line items,
quantity, rate, a flat `taxRate`, a total, and a tokenized customer link.
**A retail sale is a quote that is paid immediately.** So the sale reuses that
shape rather than inventing a parallel one.

### The schema has to be generic

This is Frank's own point and it is the right one. The same table has to hold a
painter's touch-up kits, a salon's shampoo and the clinic's moisturiser.
Nothing brand-shaped goes in it.

The rule that makes the column list easy: **a column exists only if the system
acts on it.** Price drives the bill, stock drives the count, taxable drives
tax, active drives whether it shows. Everything else is displayed, not acted
on, so it belongs in a json blob or outside this product entirely.

Applied to the clinic: her 133 Eminence products carry descriptions,
ingredients, how-to-use text and brand groupings. **None of that enters this
database.** It is website content and it stays in the `face-and-body` repo
where it already lives. This product stores the sellable facts only, and the
two join on `sku`.

---

## 6. Proposed plan edits

Exact text, so review is reading rather than guessing. **Do not apply before
approval.**

### 6a. `build-plan.md`, a new phase after Phase 9

```markdown
## Phase 10. Retail

Exit: the owner adds a product she stocks, sells it to a contact standing at
the counter, and the sale appears on that contact's timeline beside their
bookings with the stock count decremented.

- [ ] 27. **Product catalogue** - the `product` table and a settings screen
  the owner manages herself. Generic by construction: a column earns its
  place only if the system acts on it. Brand copy, ingredients and
  groupings are the host site's content, not this product's data
- [ ] 28. **Counter sale** - add products to a contact's bill, mark it paid,
  decrement stock, write the timeline entry. Reuses item 16's line-item and
  tax shape rather than a parallel one; a retail sale is a quote that is
  paid immediately. This is the item that earns the module
- [ ] 29. **Stock and low stock** - adjustments, and the list of what is
  running out. Needs item 8's runner only if alerts are wanted
- [ ] 30. **Storefront API** - public catalogue read and order create, so a
  tenant site can sell. Only if a tenant actually sells online; counter-only
  is a legitimate end state
- [ ] 31. **Payments on behalf of the business** - Stripe Connect.
  Not the same job as item 25, see the note below
```

### 6b. `build-plan.md`, remove from "Named, not planned"

Nothing to remove. Retail was never listed there. It graduates in as new work.

### 6c. `project-plan.md` section 4, appended under "New here"

```markdown
- `product`: organization-scoped catalogue. Name, sku, price, taxable, stock
  count, active, image. Deliberately generic: this table holds a painter's
  touch-up kits and a clinic's moisturiser, so nothing brand-shaped goes in
  it. Anything the system does not act on goes in a json details column or
  stays on the host site.
- `sale` and `sale_item`: modelled on `quote` and `quote_item`, because a
  retail sale is a quote that is paid immediately. Carries a payment
  reference and a destination account from the first migration, so Stripe
  Connect is a later feature and not a later migration.
- `activity` gains a `sale_created` type. A purchase and a booking land on
  one timeline, which is the entire reason retail lives in this product
  rather than in a separate store.
- `plan-limits`: `ModuleType` gains `"retail"`. One edit to the config, no route
  changes, exactly as item 23 was designed to work.
```

### 6d. `project-plan.md`, answering open question 15

Move question 15 out of Open questions and into a dated decided section:

```markdown
## Decided 2026-09-22

1. **Host sites proxy through their own server action.** Answers open
   question 15. Section 8 already carried the rationale and leaned this way;
   the store conversation reached it independently. The browser never holds a
   credential, the API stays private, and CORS stops being load-bearing for
   proxied tenants. Open only for the booking widget in item 9, if that item
   finds a reason to differ.
2. **Retail becomes a module of this product**, not a feature of any tenant
   site. Proposed as Phase 10, items 27 to 31. The clinic is its customer,
   the same seam booking already uses.
3. **Two Stripe jobs, not one.** Item 25 is an organization paying the agency
   through the agency's own single account: hosted checkout and a webhook
   writing `organization.plan`. Item 31 is a customer paying the business,
   where the money never belongs to the agency. That is Stripe Connect, with
   per-tenant onboarding, KYC, payouts and dispute liability. Same vendor,
   different product, and item 25 must not be built in a way that pretends
   otherwise.
4. **Cross-repo type seam.** A hand-written typed wrapper in the first tenant
   site, promoted to a published package at the second (Primo, item 13).
   Export a narrowed `PublicAppType`, never the whole `AppType`.
```

---

## 7. What this does not decide

- **Where Phase 10 sits.** Proposed after Phase 9 because retail depends on
  the CRM spine and quotes and nothing depends on retail. Pulling it earlier
  is defensible; it costs a rework of the sale record if it lands before
  item 16.
- **Whether items 30 and 31 exist at all.** If retail stays counter-only, they
  do not. That is a real and cheap end state.
- **Anything about the booking widget.** Item 9 is untouched.
- **Anything in flight.** See section 9.

---

## 8. Three answers this needs from outside the code

None of these are engineering decisions and all three can change the plan:

1. **Is the clinic allowed to resell Eminence online?** Spa partner agreements
   commonly restrict it. One email to her rep settles it and it can remove
   items 30 and 31 for that tenant entirely.
2. **Ship or pickup?** Pickup only removes carriers, rates, packaging and
   returns, which is most of the work in physical goods.
3. **Whose Stripe account?** Hers, from day one. The Cal.com account currently
   sitting on Frank's email is the cautionary case.

Tax is not on this list. Alberta has no provincial sales tax, so the clinic is
a single GST rate, which item 16's flat `taxRate` already models. It becomes
real work the first time a tenant is in a PST or HST province.

**Operational risk worth recording:** the clinic's shelf is sold at the counter
through Square. If a website sells the same shelf, both systems sell the last
item and neither is wrong. This is the Cal.com and Square double-booking
collision in goods. Either one system owns the count, or the site only takes
orders she confirms before money moves.

---

## 9. State of this repo when this was written

Read this before acting.

- Branch `feature/multi-tenant-auth-with-the-org-fix`, item 1, with
  uncommitted work across `backend/src`, `frontend/app`, `frontend/lib`,
  `packages/shared/src/validation` and several untracked files.
- This file is the only thing added. No plan file, no source file and no
  config was modified, because the edits in section 6 are proposals and
  Frank has not approved them.
- It will still show up in `git status` mid-feature. Committing it separately,
  or after item 1 lands, is cleaner than folding it into that branch.
- Whoever picks this up knows this repo better than the session that wrote
  this file did. Where that knowledge contradicts something here, the
  knowledge wins.
