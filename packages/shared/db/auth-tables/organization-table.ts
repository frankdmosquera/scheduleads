// Shared: Better Auth's organization table, one row per business.

import { sql } from "drizzle-orm";
import { boolean, check, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { BusinessLookType } from "../../zod-validation/booking-links-validation-schemas/business-looks-validation-schema.js";

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    // ImageKit's id for the logo uploaded on Settings > Look (feature 25e), to delete it when it is
    // replaced or removed; null for a logo set by address, or none.
    logoFileId: text("logoFileId"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    metadata: text("metadata"),

    // The subscription tier. No request can set it (input: false in auth-server.ts); only
    // Frank, by hand, until Stripe. A value subscription-limits.ts doesn't know unlocks nothing.
    plan: text("plan").notNull().default("agency"),

    // What the business's emails need (feature 6). Set at client setup; empty means not yet, and
    // no email goes without the two addresses (decision 4). The business's own Resend key is
    // never here: Better Auth's routes return this row to members (email_sending_key, decision 6).
    senderEmail: text("senderEmail"), // the address its emails come from, at its verified domain
    notifyEmail: text("notifyEmail"), // where its booking notifications go; the owner's to start
    phone: text("phone"), // for the call button
    website: text("website"), // https://
    brandColor: text("brandColor"), // #rrggbb: email clients ignore CSS variables
    // Its booking window's other two colours (feature 25e), #rrggbb; the main one is brandColor.
    backgroundColor: text("backgroundColor"),
    textColor: text("textColor"),
    // Whether the owner saved her colours on Settings > Look. Until then the window and the
    // dashboard keep their own look, even with a brandColor set long before for the emails.
    coloursOn: boolean("coloursOn").notNull().default(false),
    // Its website's own looks (feature 25f), offered first on Settings > Look; from its setup file.
    looks: jsonb("looks").$type<BusinessLookType[]>().notNull().default([]),
    // The text on the main colour when the saved colours are one of its looks, as its site has it;
    // null: worked out for contrast. Cleared by any other save.
    mainInkColor: text("mainInkColor"),
    // The one currency its prices are in (feature 25d), an ISO 4217 code; none: no price shows.
    currency: text("currency"),

    // Which way to reach the customer the booking form requires (feature 12f; "both" since feature
    // 13). Better Auth makes the row, so a new business starts at either one, the least it can ask;
    // the setup file says it.
    contactRule: text("contactRule", { enum: ["email", "phone", "either", "both"] })
      .notNull()
      .default("either"),
    // The booking form's project box (feature 13): its words, null for the window's own ("What
    // would you like done?", in the window's language), and whether a customer must fill it.
    detailsLabel: text("detailsLabel"),
    detailsRequired: boolean("detailsRequired").notNull().default(false),

    // The language of the owner's booking emails, and of a booking that came with none (the
    // owner's own, an older window). A setting (feature 12i); every business before it is English.
    language: text("language", { enum: ["en", "es"] })
      .notNull()
      .default("en"),
  },
  (table) => [
    check("organization_brand_color_check", sql`${table.brandColor} ~ '^#[0-9a-f]{6}$'`),
    check("organization_background_color_check", sql`${table.backgroundColor} ~ '^#[0-9a-f]{6}$'`),
    check("organization_text_color_check", sql`${table.textColor} ~ '^#[0-9a-f]{6}$'`),
    check("organization_main_ink_color_check", sql`${table.mainInkColor} ~ '^#[0-9a-f]{6}$'`),
    check(
      "organization_contact_rule_check",
      sql`${table.contactRule} in ('email', 'phone', 'either', 'both')`
    ),
    check(
      "organization_details_label_check",
      sql`char_length(${table.detailsLabel}) between 1 and 80`
    ),
    check("organization_language_check", sql`${table.language} in ('en', 'es')`),
    check("organization_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ]
);
