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

import { db } from "../database.js";
import { sendLoginCode } from "./send-login-code.js";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET is not set. Copy .env.example to .env at the repo root and fill it in."
  );
}

const isProduction = process.env.NODE_ENV === "production";

// A setting that may default to localhost in development only. In production a missing
// value stops the server from starting, rather than quietly trusting localhost.
// An empty string counts as missing.
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

// The dashboard's address: the only site allowed to hold a session. Read once here and
// exported, so server.ts's CORS rule can never drift from Better Auth's.
export const appOrigin = settingWithDevDefault("APP_ORIGIN", "http://localhost:3000");

// Every action a business role can be granted. Written out instead of importing Better
// Auth's defaultStatements, which adds `team` and `ac` rows we don't use.
const customStatements = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
} as const;

const accessControl = createAccessControl(customStatements);

// No organization "delete": deleting a business destroys its leads and bookings, so only
// the platform admin can (item 23 builds that screen).
const owner = accessControl.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
});

const orgAdmin = accessControl.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
});

const orgMember = accessControl.newRole({
  organization: [],
  member: [],
  invitation: [],
});

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  // The API's own address (not the dashboard's). Better Auth builds cookie and callback
  // URLs from it.
  baseURL: settingWithDevDefault("BETTER_AUTH_URL", "http://localhost:3001"),
  basePath: "/api/auth",

  // Schema passed explicitly, so a missing table fails at boot, not at the first query.
  database: drizzleAdapter(db, { provider: "pg", schema }),

  trustedOrigins: [appOrigin], // the dashboard is always a different origin from the API

  user: {
    additionalFields: {
      // The platform admin role (Frank). input: false: no request can set it; it is set by
      // hand in the database until item 23. A request that tries gets a 400.
      role: { type: "string", required: false, input: false },
    },
  },

  plugins: [
    organization({
      ac: accessControl,
      roles: { owner, admin: orgAdmin, member: orgMember },
      creatorRole: "owner",

      // Only the platform admin creates a business. Better Auth's default lets anyone
      // signed in create unlimited businesses on the paid plan. Item 25 (self-serve)
      // changes this line and disableSignUp below, together.
      allowUserToCreateOrganization: async (user) =>
        (user as { role?: string | null }).role === "admin",

      organizationHooks: {
        // Every business gets its first person, so the database always has someone to
        // hold a booking. Named after the business, never after whoever clicked create:
        // today that is the platform admin. The owner renames it in settings (feature 12).
        // Runs after the business is saved, not in its transaction; if it fails, the
        // business has no person and cannot take a booking, which fails safe.
        afterCreateOrganization: async ({ organization: createdOrganization }) => {
          await db.insert(resource).values({
            id: randomUUID(),
            organizationId: createdOrganization.id,
            name: createdOrganization.name,
            kind: "person",
          });
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
      // Nobody signs themselves up: every account is one the agency created (item 3b).
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
        // Runs just before a login session is saved. Better Auth only picks a business
        // when one is created or switched to, so without this a returning owner would
        // sign in belonging to nothing. Pre-selects only when there is exactly one.
        before: async (session) => {
          // Only pre-selects. It never decides access: every business the
          // user belongs to is still listed and reachable from the home page.
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
      ? { sameSite: "none", secure: true, partitioned: true } // A: production
      : { sameSite: "lax", secure: false }, // B: development
  },
});

export type AuthType = typeof auth;
