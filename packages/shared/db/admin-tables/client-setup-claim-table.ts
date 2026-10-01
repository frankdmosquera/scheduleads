// Shared: the client_setup_claim table. A setup in progress claims its client's email and
// its business's address, so a second setup for either at the same moment (a double click)
// is told to wait instead of racing it. Removed when the setup ends; a claim older than five
// minutes belongs to a setup that died, and the next setup clears it.

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const clientSetupClaim = pgTable("client_setup_claim", {
  // "email:<address>" or "slug:<address>". The primary key is what makes a claim exclusive.
  key: text("key").primaryKey(),
  // Which setup holds it, so a setup only ever removes its own claims.
  claimId: text("claimId").notNull(),
  claimedAt: timestamp("claimedAt", { withTimezone: true }).notNull().defaultNow(),
});
