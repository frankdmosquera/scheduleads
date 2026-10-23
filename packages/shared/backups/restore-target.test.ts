// Where a backup may be restored (12c.2): a scratch database on this laptop, never the working one.

import { describe, expect, test } from "vitest";

import { restoreTargetUrl } from "./restore-target.js";

const WORKING = "postgresql://postgres:local-pass@127.0.0.1:5432/scheduleads_dev";

describe("the database a backup is restored into", () => {
  test("a scratch _dev database on this laptop is accepted, on the working server and login", () => {
    const target = new URL(restoreTargetUrl(WORKING, "scheduleads_restore_dev"));
    expect(target.hostname).toBe("127.0.0.1");
    expect(target.port).toBe("5432");
    expect(target.username).toBe("postgres");
    expect(target.pathname).toBe("/scheduleads_restore_dev");
  });

  test("the working database itself is refused", () => {
    expect(() => restoreTargetUrl(WORKING, "scheduleads_dev")).toThrow(/working database/);
  });

  test("a name that does not end in _dev is refused", () => {
    expect(() => restoreTargetUrl(WORKING, "scheduleads_restore")).toThrow(/Refusing to restore/);
  });

  test("a database that is not on this laptop is refused, the Railway tunnel included", () => {
    const remote = "postgresql://postgres:x@db.example.com:5432/scheduleads_dev";
    expect(() => restoreTargetUrl(remote, "scheduleads_restore_dev")).toThrow(/Refusing to restore/);
    const tunnel = "postgresql://postgres:x@127.0.0.1:5433/railway";
    expect(() => restoreTargetUrl(tunnel, "scheduleads_restore_dev")).toThrow(/Refusing to restore/);
  });

  test("a name with anything but lowercase letters, digits and _ is refused", () => {
    expect(() => restoreTargetUrl(WORKING, 'x_dev"; drop database scheduleads_dev; --_dev')).toThrow(
      /not a database name/
    );
  });

  test("no DATABASE_URL is refused", () => {
    expect(() => restoreTargetUrl(undefined, "scheduleads_restore_dev")).toThrow(/DATABASE_URL is not set/);
  });
});
