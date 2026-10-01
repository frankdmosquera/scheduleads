// Backend: the Better Auth setup (sign-in, businesses, roles, platform admin).
// Holds the secret and the database, so nothing in frontend/ may import it.

import { randomUUID } from "node:crypto";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP, organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { eq } from "drizzle-orm";

import * as schema from "@scheduleads-app/shared/db";
import { member, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { seedPipelineStages } from "../crm/seed-pipeline-stages.js";
import { sendLoginCode } from "./send-login-code.js";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET is not set. Copy .env.example to .env at the repo root and fill it in."
  );
}

const isProduction = process.env.NODE_ENV === "production";

// Defaults to localhost in development only. In production a missing (or empty) value
// stops the server rather than quietly trusting localhost.
function settingWithDevDefault(name: string, developmentDefault: string): string {
  const value = process.env[name];
  if (value) return value;

  if (isProduction) {
    throw new Error(
      `${name} is not set. It defaults to localhost in development only; production must name the real origin.`
    );
  }

  return developmentDefault;
}

// The dashboard's address, the only site allowed to hold a session. Exported so the
// CORS middleware reads the same value.
export const appOrigin = settingWithDevDefault("APP_ORIGIN", "http://localhost:3000");

// The API's own address. Better Auth builds its URLs from it, and so does the calendar's
// return address from Google.
export const apiOrigin = settingWithDevDefault("BETTER_AUTH_URL", "http://localhost:3001");

// Every action a business role can be granted. Written out instead of importing Better
// Auth's defaultStatements, which adds `team` and `ac` rows we don't use.
const customStatements = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
} as const;

const accessControl = createAccessControl(customStatements);

// No organization "delete": deleting a business destroys its leads and bookings, so only
// the platform admin can (item 23 builds that screen). No invitations either: nobody joins a
// business that way, and an accepted invite would put someone in a second business.
const owner = accessControl.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: [],
});

const orgAdmin = accessControl.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: [],
});

const orgMember = accessControl.newRole({
  organization: [],
  member: [],
  invitation: [],
});

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: apiOrigin, // the API's, not the dashboard's
  basePath: "/api/auth",

  // Schema passed explicitly, so a missing table fails at boot, not at the first query.
  database: drizzleAdapter(db, { provider: "pg", schema }),

  trustedOrigins: [appOrigin], // the dashboard is always a different origin from the API

  user: {
    additionalFields: {
      // The platform admin role (Frank). input: false: no sign-in or profile request can
      // set it (one that tries gets a 400). Only the platform admin can, through the admin
      // plugin's /admin/set-role, or by hand in the database.
      role: { type: "string", required: false, input: false },
    },
  },

  plugins: [
    organization({
      ac: accessControl,
      roles: { owner, admin: orgAdmin, member: orgMember },
      creatorRole: "owner",

      // Nobody creates a business through Better Auth's own route, the platform admin
      // included: it would make whoever asks the owner. A client's business is made by
      // POST /admin/clients, under the client's login. Item 25 (self-serve) reopens this,
      // together with disableSignUp below and an organizationLimit.
      allowUserToCreateOrganization: false,

      organizationHooks: {
        // Every business gets its first person, named after the business and linked to its
        // owner's login (the client's), so the app knows whose calendar that person is, and
        // its four pipeline stages.
        // Outside Better Auth's writes: if it fails, provision-client.ts removes the business.
        afterCreateOrganization: async ({ organization: createdOrganization, member: owner }) => {
          await db.insert(resource).values({
            id: randomUUID(),
            organizationId: createdOrganization.id,
            name: createdOrganization.name,
            kind: "person",
            userId: owner.userId,
          });
          await seedPipelineStages(createdOrganization.id);
        },
      },
      schema: {
        organization: {
          additionalFields: {
            // The subscription tier. input: false: no request can set it; only Frank, by
            // hand, until Stripe (Phase 9). Unlike user.role, a create that sends a plan
            // is not refused: it silently gets "agency". So a 200 is not proof it took.
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
      // Nobody signs themselves up: every account is one the agency set up
      // (POST /admin/clients).
      // An existing address gets its code as normal; an unknown one is told a code is on
      // its way and gets nothing, so the form can't be used to test who is a customer.
      disableSignUp: true,

      // Better Auth stores codes in plain text by default, readable in the database for
      // five minutes. Hashed, a leaked table gives no one a way in.
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        await sendLoginCode({ email, otp, type });
      },
    }),

    admin(), // the platform admin layer (Frank), above every business
  ],

  databaseHooks: {
    session: {
      create: {
        // Better Auth only picks a business when one is created or switched to, so a
        // returning owner would sign in belonging to nothing. This pre-selects their one
        // business; it never decides access.
        before: async (session) => {
          const memberships = await db
            .select({ organizationId: member.organizationId })
            .from(member)
            .where(eq(member.userId, session.userId));

          // Two or more: pick nothing rather than guess. The home page asks.
          const belongsToExactlyOneBusiness = memberships.length === 1;
          if (!belongsToExactlyOneBusiness) return;

          const onlyBusinessId = memberships[0].organizationId;

          return {
            data: {
              ...session,
              activeOrganizationId: onlyBusinessId,
            },
          };
        },
      },
    },
  },

  advanced: {
    useSecureCookies: isProduction,
    // Production only: share the login cookie between app.<domain> and api.<domain>.
    crossSubDomainCookies: process.env.COOKIE_DOMAIN
      ? { enabled: true, domain: process.env.COOKIE_DOMAIN }
      : undefined,
    defaultCookieAttributes: isProduction
      ? { sameSite: "none", secure: true, partitioned: true }
      : { sameSite: "lax", secure: false },
  },
});

export type AuthType = typeof auth;
