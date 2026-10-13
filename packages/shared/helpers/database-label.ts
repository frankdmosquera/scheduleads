// Shared helper: which database a URL points at, as host:port/name, never its password.

export function databaseLabel(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || "5432"}/${parsed.pathname.replace(/^\//, "")}`;
}
