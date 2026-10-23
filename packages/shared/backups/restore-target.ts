// Shared: where a backup copy may be restored (12c). Only a database on this laptop whose name ends
// in _dev, and never the working one DATABASE_URL names, so a restore never replaces real work.
// Returns the target's URL: the working server's address and login, the target's name.

import { assertLocalDevDatabase } from "../helpers/assert-local-dev-database.js";
import { parseDatabaseUrl } from "../helpers/parse-database-url.js";

export function restoreTargetUrl(workingUrl: string | undefined, into: string): string {
  // The name goes into CREATE DATABASE, so nothing but the characters a _dev name needs.
  if (!/^[a-z0-9_]+$/.test(into)) {
    throw new Error(`"${into}" is not a database name: lowercase letters, digits and _ only.`);
  }
  const working = assertLocalDevDatabase(workingUrl, "restore a backup");
  if (into === working) {
    throw new Error(
      `Refusing to restore over ${into}, the working database DATABASE_URL names. ` +
        "Pick another name ending in _dev, such as scheduleads_restore_dev."
    );
  }

  const target = parseDatabaseUrl(workingUrl as string);
  target.pathname = `/${into}`;
  assertLocalDevDatabase(target.toString(), "restore a backup");
  return target.toString();
}
