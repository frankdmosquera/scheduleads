// Shared: the database the setup command may use. The local *_dev one by default, so a wrong
// .env line is still refused; any database only when --live says so (10b).
// Returns host:port/name, which the command prints before it reads anything.

import { assertLocalDevDatabase } from "../helpers/assert-local-dev-database.js";
import { databaseLabel } from "../helpers/database-label.js";

export function setupDatabase(url: string | undefined, { live }: { live: boolean }): string {
  if (!live) assertLocalDevDatabase(url, "set a business up (add --live for the live database)");
  if (!url) throw new Error("DATABASE_URL is not set. It is read from the root .env.");
  return databaseLabel(url);
}
