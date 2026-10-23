import { describe, expect, test } from "vitest";

import { setupDatabase } from "./setup-database.js";

const tunnel = "postgresql://postgres:secret@127.0.0.1:5433/railway";
const local = "postgresql://postgres:secret@127.0.0.1:5432/scheduleads_dev";

describe("the setup command's database", () => {
  test("without --live, only the local *_dev database", () => {
    expect(setupDatabase(local, { live: false })).toBe("127.0.0.1:5432/scheduleads_dev");
    expect(() => setupDatabase(tunnel, { live: false })).toThrow(
      "Refusing to set a business up (add --live for the live database) against 127.0.0.1:5433/railway"
    );
  });

  test("with --live, the live database, named without its password", () => {
    expect(setupDatabase(tunnel, { live: true })).toBe("127.0.0.1:5433/railway");
  });

  test("no DATABASE_URL is refused either way", () => {
    expect(() => setupDatabase(undefined, { live: true })).toThrow("DATABASE_URL is not set");
    expect(() => setupDatabase(undefined, { live: false })).toThrow("DATABASE_URL is not set");
  });
});
