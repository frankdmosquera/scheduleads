// The line every database command prints first: which database, never its password (F-434).

import { describe, expect, test } from "vitest";

import { databaseLabel } from "./database-label.js";

describe("the database a command names", () => {
  test("is host:port/name, with the default port when the URL has none", () => {
    expect(databaseLabel("postgresql://postgres:secret-pass@127.0.0.1:5433/railway")).toBe(
      "127.0.0.1:5433/railway"
    );
    expect(databaseLabel("postgresql://postgres:secret-pass@db.example.com/scheduleads")).toBe(
      "db.example.com:5432/scheduleads"
    );
  });

  test("a URL that does not parse is refused without its password", () => {
    // A "#" in a password ends the URL early, so Node cannot read the port that follows.
    const broken = "postgresql://postgres:pa#ss-secret@127.0.0.1:5433/railway";
    expect(() => new URL(broken)).toThrow(); // Node's own error, which carries the input
    let message = "";
    try {
      databaseLabel(broken);
    } catch (error) {
      message = `${(error as Error).message} ${JSON.stringify(error)}`;
    }
    expect(message).toContain("DATABASE_URL is not a valid URL");
    expect(message).not.toContain("ss-secret");
  });
});
