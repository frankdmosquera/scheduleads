// Shared helper: which database a URL points at, as host:port/name, never its password.

import { parseDatabaseUrl } from "./parse-database-url.js";

export function databaseLabel(url: string): string {
  const parsed = parseDatabaseUrl(url);
  return `${parsed.hostname}:${parsed.port || "5432"}/${parsed.pathname.replace(/^\//, "")}`;
}
