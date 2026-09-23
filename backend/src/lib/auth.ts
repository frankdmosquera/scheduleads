import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP, organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";
import { eq } from "drizzle-orm";

import * as schema from "@scheduleads-app/shared/db";
import { member } from "@scheduleads-app/shared/db";

import { db } from "../database.js";
import { sendLoginCode } from "./send-login-code.js";

/**
 * Better Auth, mounted on the API rather than inside Next.
 *
 * The first repo ran it inside the Next app, and codestash still does.
 * Here the session lives on the service that owns the data, so every
 * authenticated route reads it directly instead of the API being blind
 * to who is calling. The cost is a cross-origin cookie in production,
 * handled at the bottom of this file.
 *
 * This module holds BETTER_AUTH_SECRET and the database. Nothing in the
 * frontend workspace may import it.
 */

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET is not set. Copy .env.example to .env at the repo root and fill it in."
  );
}

const isProduction = process.env.NODE_ENV === "production";

/** Where the dashboard is served from. The only origin allowed to hold a session. */
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";

/**
 * Organization roles.
 *
 * The one change from Better Auth's defaults: `owner` does not get
 * `organization: ["delete"]`. A business owner can rename and configure
 * their organization but cannot destroy it, because deleting one takes
 * its leads, bookings and calendar connection with it. Only the platform
 * admin deletes an organization, and item 23 builds the screen for it.
 */
const ac = createAccessControl(defaultStatements);

const owner = ac.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
});

const orgAdmin = ac.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
});

const orgMember = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
});

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  /**
   * The API's own origin, not the app's. Better Auth builds callback and
   * cookie URLs from it, and inferring it from the incoming request is
   * unreliable once this sits behind a proxy.
   */
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  basePath: "/api/auth",

  /**
   * The schema is passed explicitly. The adapter would otherwise fall
   * back to `db._.fullSchema`, an internal Drizzle field, and a table it
   * cannot find fails at the first query rather than at boot.
   */
  database: drizzleAdapter(db, { provider: "pg", schema }),

  /**
   * The dashboard is a different origin from this API in every
   * environment: a different port locally, a different subdomain in
   * production. Without this, Better Auth rejects its requests.
   */
  trustedOrigins: [appOrigin],

  user: {
    additionalFields: {
      /**
       * The platform admin hat, from the `admin` plugin. Server-set only:
       * `input: false`, so no request body can write it. Promotion is a
       * manual database edit until item 23.
       *
       * Proved at step 1.6, not assumed: a sign-in body carrying
       * `role: "admin"` is refused outright with 400 FIELD_NOT_ALLOWED.
       * It has no `defaultValue`, and `parseInputData` in
       * `better-auth/dist/db/schema.mjs` throws for an `input: false`
       * field with a truthy value unless a default exists to substitute.
       * That is the opposite of how `plan` below behaves, so do not
       * assume the two fail the same way.
       */
      role: { type: "string", required: false, input: false },
    },
  },

  plugins: [
    organization({
      ac,
      roles: { owner, admin: orgAdmin, member: orgMember },
      creatorRole: "owner",
      schema: {
        organization: {
          additionalFields: {
            /**
             * The package rung. `input: false` is the whole security
             * story: no request body can set it. Until Stripe arrives in
             * Phase 9 the only writer is Frank, by hand.
             *
             * It fails differently from `user.role` above, because it
             * carries a `defaultValue`. On create, a body sending
             * `plan: "enterprise"` is silently replaced with `agency`
             * rather than refused; on update it throws. Both are safe,
             * but only the second is visible to whoever tried it, so do
             * not read a create that returned 200 as proof the value
             * was accepted.
             */
            plan: {
              type: "string",
              required: false,
              input: false,
              defaultValue: "agency",
            },
          },
        },
      },
    }),

    emailOTP({
      /**
       * Better Auth stores the code in plain text by default. That leaves a
       * working login code readable in the database for its whole five
       * minute life, so anyone who can read the table can sign in as that
       * person without ever seeing their email.
       *
       * Nothing here ever needs to read the code back - it is generated,
       * sent, and compared - so hashing costs nothing. The only feature it
       * rules out is resending the identical code, and the default there is
       * to rotate anyway.
       */
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        await sendLoginCode({ email, otp, type });
      },
    }),

    admin(),
  ],

  databaseHooks: {
    session: {
      create: {
        /**
         * The org fix, carried from the first repo.
         *
         * Better Auth only stamps `activeOrganizationId` when an
         * organization is created or explicitly switched to, so a
         * returning user who simply signs in belongs to nothing and every
         * org-scoped route refuses them. Stamping it at session creation
         * closes that.
         *
         * With two or more memberships and no prior choice it is left
         * unset on purpose. Picking one would be guessing which tenant
         * the user meant, and tenant scope is a security boundary, not a
         * convenience. The frontend asks them instead.
         */
        before: async (session) => {
          const memberships = await db
            .select({ organizationId: member.organizationId })
            .from(member)
            .where(eq(member.userId, session.userId))
            .limit(2);

          if (memberships.length !== 1) return;

          return {
            data: { ...session, activeOrganizationId: memberships[0].organizationId },
          };
        },
      },
    },
  },

  advanced: {
    /**
     * Local development is two ports on localhost, which is cross-origin
     * but same-site, so a Lax cookie works and nothing needs HTTPS.
     *
     * Production is app.<domain> talking to api.<domain>. That is
     * cross-site to a browser unless the cookie is scoped to the shared
     * parent domain, which is what COOKIE_DOMAIN is for. Without it the
     * session cookie is set and then silently dropped on every
     * subsequent request.
     */
    useSecureCookies: isProduction,
    crossSubDomainCookies: process.env.COOKIE_DOMAIN
      ? { enabled: true, domain: process.env.COOKIE_DOMAIN }
      : undefined,
    defaultCookieAttributes: isProduction
      ? { sameSite: "none", secure: true, partitioned: true }
      : { sameSite: "lax", secure: false },
  },
});

export type Auth = typeof auth;
