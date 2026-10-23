// Where a backup may be restored: a scratch _restore_dev database on this laptop only.

import { describe, expect, test } from "vitest";

import { restoreTargetUrl } from "./restore-target.js";

const WORKING = "postgresql://postgres:local-pass@127.0.0.1:5432/scheduleads_dev";

describe("the database a backup is restored into", () => {
  test("a scratch _restore_dev database on this laptop is accepted, on the working server and login", () => {
    const target = new URL(restoreTargetUrl(WORKING, "scheduleads_restore_dev"));
    expect(target.hostname).toBe("127.0.0.1");
    expect(target.port).toBe("5432");
    expect(target.username).toBe("postgres");
    expect(target.pathname).toBe("/scheduleads_restore_dev");
    expect(target.search).toBe("");
  });

  test("the working database itself is refused", () => {
    expect(() => restoreTargetUrl(WORKING, "scheduleads_dev")).toThrow(/_restore_dev/);
  });

  test("another project's _dev database is refused", () => {
    expect(() => restoreTargetUrl(WORKING, "list_board_dev")).toThrow(/_restore_dev/);
  });

  test("a database that is not on this laptop is refused, the Railway tunnel included", () => {
    const remote = "postgresql://postgres:x@db.example.com:5432/scheduleads_dev";
    expect(() => restoreTargetUrl(remote, "scheduleads_restore_dev")).toThrow(
      /Refusing to restore/
    );
    const tunnel = "postgresql://postgres:x@127.0.0.1:5433/railway";
    expect(() => restoreTargetUrl(tunnel, "scheduleads_restore_dev")).toThrow(
      /Refusing to restore/
    );
  });

  test("a DATABASE_URL with options after the name is refused, so none can redirect pg_restore", () => {
    expect(() =>
      restoreTargetUrl(`${WORKING}?port=5433&dbname=railway`, "scheduleads_restore_dev")
    ).toThrow(/options after the name/);
  });

  test("a name with anything but lowercase letters, digits and _ is refused", () => {
    expect(() =>
      restoreTargetUrl(WORKING, 'x"; drop database scheduleads_dev; --_restore_dev')
    ).toThrow(/Refusing to restore/);
  });

  test("no DATABASE_URL is refused", () => {
    expect(() => restoreTargetUrl(undefined, "scheduleads_restore_dev")).toThrow(
      /DATABASE_URL is not set/
    );
  });
});
