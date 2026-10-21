// Shared helper: reads DATABASE_URL. Node's own error for a bad URL carries the whole input,
// password included, so it is replaced before it can be printed.

export function parseDatabaseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL. Check which line is active in .env.");
  }
}
