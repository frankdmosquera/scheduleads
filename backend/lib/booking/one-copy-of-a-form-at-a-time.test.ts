// Copies of one form run one after the other; different forms do not wait for each other.

import { describe, expect, test } from "vitest";

import { oneCopyOfAFormAtATime } from "./one-copy-of-a-form-at-a-time.js";

const pause = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("one copy of a form at a time", () => {
  test("a second copy starts only once the first has finished", async () => {
    const steps: string[] = [];
    const copy = (name: string) => async () => {
      steps.push(`${name} starts`);
      await pause();
      steps.push(`${name} ends`);
    };
    await Promise.all([
      oneCopyOfAFormAtATime("form-1", copy("first")),
      oneCopyOfAFormAtATime("form-1", copy("second")),
    ]);
    expect(steps).toEqual(["first starts", "first ends", "second starts", "second ends"]);
  });

  test("different forms, and bookings with no form key, run side by side", async () => {
    const steps: string[] = [];
    const copy = (name: string) => async () => {
      steps.push(`${name} starts`);
      await pause();
      steps.push(`${name} ends`);
    };
    await Promise.all([
      oneCopyOfAFormAtATime("form-1", copy("one")),
      oneCopyOfAFormAtATime("form-2", copy("two")),
      oneCopyOfAFormAtATime(null, copy("owner")),
    ]);
    expect(steps.slice(0, 3).every((step) => step.endsWith("starts"))).toBe(true);
  });

  test("a copy that fails does not stop the next one, and each gets its own answer", async () => {
    const first = oneCopyOfAFormAtATime("form-3", async () => {
      throw new Error("The first copy failed.");
    });
    const second = oneCopyOfAFormAtATime("form-3", async () => "booked");
    await expect(first).rejects.toThrow("The first copy failed.");
    await expect(second).resolves.toBe("booked");
  });
});
