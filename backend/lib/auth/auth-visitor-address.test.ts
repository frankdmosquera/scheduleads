// Better Auth's own limits (the login code) count each visitor by the header our limits trust, in
// production only. Wrong or missing, it silently puts every visitor in one shared limit (F-433).

import { afterEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

import { VISITOR_ADDRESS_HEADER } from "../rate-limit/visitor-address-header.js";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the auth visitor address test");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// A fresh copy of the auth setup, read as the API reads it when it starts with this NODE_ENV.
async function ipAddressSettingOn(nodeEnv: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  const { auth } = await import("./auth-server.js");
  const { db } = await import("../../database.js");
  await db.$client.end(); // this copy never queries
  return auth.options.advanced?.ipAddress;
}

describe("Better Auth finds the visitor", () => {
  test("in production, by the header Railway's proxy sets", async () => {
    expect(await ipAddressSettingOn("production")).toEqual({
      ipAddressHeaders: [VISITOR_ADDRESS_HEADER],
    });
  });

  test("anywhere else, by its own default, since anyone could send that header", async () => {
    expect(await ipAddressSettingOn("development")).toBeUndefined();
  });
});
