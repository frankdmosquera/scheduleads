import { describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "./assert-local-dev-database.js";

describe("assertLocalDevDatabase", () => {
  test("a local database named *_dev passes and gives back its name", () => {
    expect(
      assertLocalDevDatabase("postgresql://postgres:pw@127.0.0.1:5432/scheduleads_dev", "seed")
    ).toBe("scheduleads_dev");
    expect(assertLocalDevDatabase("postgresql://postgres@localhost/scheduleads_dev", "seed")).toBe(
      "scheduleads_dev"
    );
    expect(assertLocalDevDatabase("postgresql://postgres@[::1]:5432/other_dev", "seed")).toBe(
      "other_dev"
    );
  });

  test("the Railway tunnel is refused although it listens on this machine", () => {
    expect(() =>
      assertLocalDevDatabase("postgresql://postgres:pw@127.0.0.1:5433/railway", "seed")
    ).toThrow("Refusing to seed against 127.0.0.1:5433/railway");
  });

  test("a *_dev database on another machine is refused", () => {
    expect(() =>
      assertLocalDevDatabase("postgresql://postgres:pw@db.example.com:5432/scheduleads_dev", "seed")
    ).toThrow("Refusing to seed");
  });

  test("a missing DATABASE_URL is refused", () => {
    expect(() => assertLocalDevDatabase(undefined, "seed")).toThrow("DATABASE_URL is not set");
    expect(() => assertLocalDevDatabase("", "seed")).toThrow("DATABASE_URL is not set");
  });
});
