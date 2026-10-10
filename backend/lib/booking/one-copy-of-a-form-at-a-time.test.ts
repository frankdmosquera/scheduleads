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
      oneCopyOfAFormAtATime.book("form-1", copy("first")),
      oneCopyOfAFormAtATime.book("form-1", copy("second")),
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
      oneCopyOfAFormAtATime.book("form-1", copy("one")),
      oneCopyOfAFormAtATime.book("form-2", copy("two")),
      oneCopyOfAFormAtATime.book(null, copy("owner")),
    ]);
    expect(steps.slice(0, 3).every((step) => step.endsWith("starts"))).toBe(true);
  });

  test("every form is cleared from memory once its copies end: booked, failed, or two at once", async () => {
    await oneCopyOfAFormAtATime.book("form-4", async () => "booked");
    expect(oneCopyOfAFormAtATime.formsInHand()).toBe(0);

    await expect(
      oneCopyOfAFormAtATime.book("form-5", async () => {
        throw new Error("It failed.");
      })
    ).rejects.toThrow("It failed.");
    expect(oneCopyOfAFormAtATime.formsInHand()).toBe(0);

    const copies = [1, 2].map(() => oneCopyOfAFormAtATime.book("form-6", pause));
    expect(oneCopyOfAFormAtATime.formsInHand()).toBe(1); // in hand while its copies run
    await Promise.all(copies);
    expect(oneCopyOfAFormAtATime.formsInHand()).toBe(0);
  });

  test("a copy that fails does not stop the next one, and each gets its own answer", async () => {
    const first = oneCopyOfAFormAtATime.book("form-3", async () => {
      throw new Error("The first copy failed.");
    });
    const second = oneCopyOfAFormAtATime.book("form-3", async () => "booked");
    await expect(first).rejects.toThrow("The first copy failed.");
    await expect(second).resolves.toBe("booked");
  });
});
