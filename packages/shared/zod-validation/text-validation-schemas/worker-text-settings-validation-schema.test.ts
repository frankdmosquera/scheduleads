import { describe, expect, test } from "vitest";

import { workerTextSettingsValidationSchema } from "./worker-text-settings-validation-schema.js";

const pedro = { phone: "403 555 0161", addedOn: true, movedOn: true, removedOn: true };

const refused = (changes: Record<string, unknown>) =>
  workerTextSettingsValidationSchema.safeParse({ ...pedro, ...changes }).success === false;

describe("a person's worker-text settings", () => {
  test.each([
    ["403 555 0161"],
    ["(403) 555-0161"],
    ["403-555-0161"],
    ["4035550161"],
    ["1 403 555 0161"],
    ["+1 403 555 0161"],
  ])("a phone typed as %s is kept as Twilio texts it", (phone) => {
    expect(workerTextSettingsValidationSchema.parse({ ...pedro, phone }).phone).toBe(
      "+14035550161"
    );
  });

  test("each switch is kept as given, off included", () => {
    expect(
      workerTextSettingsValidationSchema.parse({
        ...pedro,
        addedOn: false,
        movedOn: true,
        removedOn: false,
      })
    ).toEqual({ phone: "+14035550161", addedOn: false, movedOn: true, removedOn: false });
  });

  test("a phone outside North America is refused, saying why", () => {
    expect(
      workerTextSettingsValidationSchema.safeParse({ ...pedro, phone: "+44 20 7946 0958" }).error
        ?.issues[0]?.message
    ).toBe("Use a Canadian or US number, like 403 555 0148.");
  });

  test.each([["addedOn"], ["movedOn"], ["removedOn"]])(
    "a missing %s is refused: no switch is on by default",
    (name) => {
      const { [name as keyof typeof pedro]: _left, ...rest } = pedro;
      expect(workerTextSettingsValidationSchema.safeParse(rest).success).toBe(false);
    }
  );

  test("a missing phone is refused", () => {
    expect(refused({ phone: undefined })).toBe(true);
  });
});
