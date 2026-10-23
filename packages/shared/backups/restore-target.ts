// Shared: where a backup copy may be restored (12c). Only a scratch database on this laptop whose
// name ends in _restore_dev, so neither the working database nor another project's _dev one is
// ever dropped (F-445). Returns the target's URL: the working server's address and login, the
// target's name, and nothing else.

import { assertLocalDevDatabase } from "../helpers/assert-local-dev-database.js";
import { parseDatabaseUrl } from "../helpers/parse-database-url.js";

export function restoreTargetUrl(workingUrl: string | undefined, into: string): string {
  // The name goes into DROP and CREATE DATABASE, so nothing but the characters it needs.
  if (!/^[a-z0-9_]+_restore_dev$/.test(into)) {
    throw new Error(
      `Refusing to restore into "${into}": the name must end in _restore_dev, ` +
        "with lowercase letters, digits and _ only (for example scheduleads_restore_dev)."
    );
  }
  assertLocalDevDatabase(workingUrl, "restore a backup");

  // libpq would take a host, port or database from the query string past the checks (F-446).
  const target = parseDatabaseUrl(workingUrl as string);
  if (target.search || target.hash) {
    throw new Error(
      "Refusing to restore: DATABASE_URL carries options after the name. Remove them."
    );
  }
  target.pathname = `/${into}`;
  assertLocalDevDatabase(target.toString(), "restore a backup");
  return target.toString();
}
