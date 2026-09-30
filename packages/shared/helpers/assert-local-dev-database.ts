// Shared helper: the guard in front of everything that writes throwaway rows or reads with
// real keys in development (the seed, the route tests, calendar:check).

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// Two conditions, not one: the Railway tunnel ALSO listens on 127.0.0.1, so a host check
// alone would pass the real database. The name must end in _dev too (Railway's is "railway").
// Returns the database's name; `refusedAction` finishes "Refusing to ...".
export function assertLocalDevDatabase(url: string | undefined, refusedAction: string): string {
  if (!url) {
    throw new Error("DATABASE_URL is not set. It is read from the root .env.");
  }

  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, "");

  if (!LOOPBACK.has(parsed.hostname) || !database.endsWith("_dev")) {
    throw new Error(
      `Refusing to ${refusedAction} against ${parsed.hostname}:${parsed.port || "5432"}/${database}. ` +
        "Only a database on this machine whose name ends in _dev is allowed. " +
        "Check which DATABASE_URL line is active in .env."
    );
  }

  return database;
}
