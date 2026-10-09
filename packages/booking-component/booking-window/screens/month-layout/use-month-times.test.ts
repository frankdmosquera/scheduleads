// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { hc } from "hono/client";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PublicAppType } from "backend/app-type";

import type {
  BookingAvailabilityType,
  BookingBusinessType,
  BookingServiceDetailsType,
} from "../../../api-client/booking-api-types.js";
import { MonthServiceScreen } from "./month-service-screen.js";
import { useMonthTimes } from "./use-month-times.js";

// One free time as the times route sends it.
const at = (startsAt: string, date: string, time: string) => ({
  startsAt,
  date,
  time,
  when: `${date} at ${time}`,
});

const answerWith = (times: ReturnType<typeof at>[]) =>
  new Response(
    JSON.stringify({
      timezone: "America/Edmonton",
      people: [
        { id: "ana", name: "Ana" },
        { id: "mei", name: "Mei" },
      ],
      startTimes: times.map((time) => time.startsAt),
      localStartTimes: times,
    }),
    { status: 200 }
  );

// The real typed client over a fake fetch that holds each answer until the test lets it go, keyed
// by the person asked for ("any" for any available).
function clientWithHeldAnswers() {
  const held = new Map<string, (response: Response) => void>();
  const apiClient = hc<PublicAppType>("https://api.example.com", {
    fetch: (input: RequestInfo | URL) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      return new Promise<Response>((resolve) => {
        held.set(url.searchParams.get("person") ?? "any", resolve);
      });
    },
  });
  const answer = async (person: string, response: Response) => {
    await waitFor(() => expect(held.has(person)).toBe(true));
    await act(async () => held.get(person)?.(response));
  };
  return { apiClient, answer };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useMonthTimes", () => {
  it("drops a late answer for a person no longer shown (F-280)", async () => {
    const { apiClient, answer } = clientWithHeldAnswers();
    const question = {
      apiClient,
      slug: "clinic-dev",
      bookingLinkId: "facial",
      dates: { from: "2026-10-09", to: "2026-10-31" },
    };
    const { result, rerender } = renderHook(
      (personId: string) => useMonthTimes({ ...question, personId }),
      {
        initialProps: "ana",
      }
    );

    rerender("mei"); // the customer picks Mei while Ana's times are still on their way
    await answer("mei", answerWith([at("2026-10-14T16:00:00.000Z", "2026-10-14", "10:00 a.m.")]));
    await answer("ana", answerWith([at("2026-10-15T15:00:00.000Z", "2026-10-15", "9:00 a.m.")]));

    expect(result.current.times).toEqual({
      state: "ok",
      days: new Map([["2026-10-14", [at("2026-10-14T16:00:00.000Z", "2026-10-14", "10:00 a.m.")]]]),
    });
  });
});

describe("the month layout's screen one", () => {
  it("shows the first day with a time when a month loads, not today (F-280)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z")); // Friday, October 9 in Edmonton
    const { apiClient, answer } = clientWithHeldAnswers();

    render(
      createElement(MonthServiceScreen, {
        apiClient,
        slug: "clinic-dev",
        business: {
          name: "Riverbend Clinic",
          logo: null,
          phone: null,
          questions: [],
        } as BookingBusinessType,
        service: {
          id: "facial",
          name: "Hydra Spa Facial",
          description: null,
          durationMinutes: 60,
          personChoice: "business_assigns",
        } as unknown as BookingServiceDetailsType,
        availability: { timezone: "America/Edmonton", horizonDays: 120 } as BookingAvailabilityType,
        place: null,
        titleId: "title",
        onBack: null,
        onTimeChosen: () => {},
      })
    );
    await answer(
      "any",
      answerWith([
        at("2026-10-14T16:00:00.000Z", "2026-10-14", "10:00 a.m."),
        at("2026-10-16T15:00:00.000Z", "2026-10-16", "9:00 a.m."),
      ])
    );

    expect(await screen.findByText("Wednesday, October 14")).toBeDefined();
    expect(screen.getByRole("button", { name: "10:00 a.m." })).toBeDefined();
    expect(screen.queryByRole("button", { name: "9:00 a.m." })).toBeNull();
  });
});
