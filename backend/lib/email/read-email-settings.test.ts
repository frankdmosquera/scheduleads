// The agency's email settings, checked when the API starts.

import { describe, expect, test } from "vitest";

import { readEmailSettings } from "./read-email-settings.js";

const production = { NODE_ENV: "production" };

describe("the email settings", () => {
  test("development with nothing set: no key, no sender, no refusal", () => {
    expect(readEmailSettings({ NODE_ENV: "development" })).toEqual({
      agencyApiKey: null,
      loginFrom: null,
    });
  });

  test("production with both set is accepted, a named sender too", () => {
    expect(
      readEmailSettings({
        ...production,
        RESEND_API_KEY: " re_agency ",
        LOGIN_EMAIL_FROM: "Agents Web <login@agentsweb.com>",
      })
    ).toEqual({ agencyApiKey: "re_agency", loginFrom: "Agents Web <login@agentsweb.com>" });
  });

  test.each([
    ["no key", { LOGIN_EMAIL_FROM: "login@agentsweb.com" }],
    ["no login sender", { RESEND_API_KEY: "re_agency" }],
    ["neither", {}],
  ])("production with %s refuses to start", (_name, env) => {
    expect(() => readEmailSettings({ ...production, ...env })).toThrow(
      "RESEND_API_KEY and LOGIN_EMAIL_FROM must both be set in production"
    );
  });

  test.each([["not an address"], ["Agents Web <not an address>"], ["login@nodot"]])(
    "a login sender that is not an address is refused: %s",
    (loginFrom) => {
      expect(() => readEmailSettings({ LOGIN_EMAIL_FROM: loginFrom })).toThrow(
        'LOGIN_EMAIL_FROM must be an address, or "Name <address>".'
      );
    }
  );
});
