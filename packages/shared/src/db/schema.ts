import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * The database schema, shared by every workspace that talks to Postgres, and
 * reached as `@scheduleads-app/shared/db`.
 *
 * It lives here rather than in `backend/` because the database belongs to
 * neither app: the Hono API owns every write today, but migrations and types
 * are read from both sides. A schema owned by one workspace would let two of
 * them generate migrations from different definitions against one database.
 *
 * One file, not a directory of seven. The first repo learned that a barrel
 * re-export forces a relative import, and the two workspaces disagree about
 * extensions: the backend's NodeNext resolution demands `./user-schema.js`
 * while the frontend's bundler wants none. This package compiles to `dist/`
 * before either consumer reads it, which sidesteps that, but a single file
 * sidesteps it and stays readable at this size.
 *
 * Each app builds its own connection: pooling and lifetime differ between a
 * Next.js server and a long-lived Node process.
 */

/**
 * Better Auth's own tables for this project's exact plugin set: `emailOTP`,
 * `organization` and `admin`, on better-auth 1.7.5. The `admin` columns were
 * read off `node_modules/better-auth/dist/plugins/admin/schema.mjs` rather
 * than written from memory. Re-read it before changing anything here.
 *
 * Timestamps are `timestamptz` throughout. A booking product that stores an
 * instant without its zone is a booking product that double-books.
 */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),

  /**
   * The `admin` plugin's platform role, and Frank's second hat. Nothing in
   * the product reads it yet; the admin area is item 23.
   *
   * Better Auth marks this `input: false`, so no request body can set it. It
   * is promoted by hand against the database and nowhere else. Do not add a
   * route, form or server action that writes it.
   */
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires", { withTimezone: true }),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  /**
   * The tenant this session is acting for, and the single source of the
   * `organizationId` every org-scoped query uses.
   *
   * Better Auth only stamps it when an organization is created or explicitly
   * switched to, which is the org fix this feature exists to close: see the
   * session-create hook in `backend/src/lib/auth.ts`.
   */
  activeOrganizationId: text("activeOrganizationId"),

  /** `admin` plugin. Set while a platform admin is impersonating. */
  impersonatedBy: text("impersonatedBy"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  /** Unused: sign-in is email-OTP only, so no password is ever set. */
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  metadata: text("metadata"),

  /**
   * The package rung. `agency` is the only one that exists until item 23
   * adds the ladder above it.
   *
   * Server-set only: it is declared `input: false` on the Better Auth
   * organization plugin, so no create or update body can carry it. Until
   * Stripe arrives in Phase 9 the only writer is Frank, by hand.
   *
   * Anything this column holds that `plan-limits` does not recognise
   * resolves to the locked set, not to `agency`. An unknown rung is a
   * misconfiguration, and the gate fails closed.
   */
  plan: text("plan").notNull().default("agency"),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /**
   * Better Auth's default set: owner | admin | member. Only `owner` carries
   * meaning today, and it is the organization owner, not the platform admin
   * on `user.role`. The two are different hats and never the same check.
   */
  role: text("role").notNull().default("member"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // One membership row per user per organization. Without this the
  // "exactly one membership" fallback in active-organization.ts could be
  // fooled by a duplicate into thinking a single-tenant user is ambiguous.
  uniqueIndex("member_organization_user_unique").on(
    table.organizationId,
    table.userId
  ),
]);

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  inviterId: text("inviterId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
