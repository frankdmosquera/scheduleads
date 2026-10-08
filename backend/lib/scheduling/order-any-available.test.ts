import { describe, expect, test } from "vitest";

import { countBookingsThatDay } from "./count-bookings-that-day.js";
import { orderAnyAvailable } from "./order-any-available.js";

const person = (resourceId: string, name: string, bookingsThatDay: number) => ({
  resourceId,
  name,
  bookingsThatDay,
});

// Who a booking goes to: the first choice in the order, or null when there is none.
const firstChoice = (...args: Parameters<typeof orderAnyAvailable>) =>
  orderAnyAvailable(...args)[0] ?? null;

describe("the order any available tries", () => {
  test("fewest bookings first, a tie by name, each person with the rooms by name", () => {
    const people = [
      person("p-sofia", "Sofia", 1),
      person("p-mei", "Mei", 0),
      person("p-ana", "Ana", 1),
    ];
    const rooms = [
      { resourceId: "r-4", name: "Room 4" },
      { resourceId: "r-3", name: "Room 3" },
    ];
    expect(orderAnyAvailable(people, rooms)).toEqual([
      { personId: "p-mei", placeId: "r-3" },
      { personId: "p-mei", placeId: "r-4" },
      { personId: "p-ana", placeId: "r-3" },
      { personId: "p-ana", placeId: "r-4" },
      { personId: "p-sofia", placeId: "r-3" },
      { personId: "p-sofia", placeId: "r-4" },
    ]);
  });

  test("no room needed pairs each person with none; nobody, or no free room, gives no choice", () => {
    expect(orderAnyAvailable([person("p-ana", "Ana", 0)], null)).toEqual([
      { personId: "p-ana", placeId: null },
    ]);
    expect(orderAnyAvailable([], null)).toEqual([]);
    expect(orderAnyAvailable([person("p-ana", "Ana", 0)], [])).toEqual([]);
  });
});

// The six cases of the any-available simulation (explorable-any-available.html in the build log), one test
// each, named as on the page: who is free at 2:00 on Monday Oct 5, with their bookings and time off
// that day, and which rooms are free.
const MONDAY = "2026-10-05";
const ZONE = "America/Edmonton"; // UTC-6

type CasePersonType = { name: string; bookings: number; timeOff?: number; free?: boolean };

function choose(people: CasePersonType[], rooms: { name: string; free: boolean }[] | null) {
  // Each booking and stretch of time off as the commitment rows free times reads, all on Monday.
  const commitments = people.flatMap((person) => [
    ...Array.from({ length: person.bookings }, (_, i) => ({
      resourceId: person.name,
      kind: "booking",
      startsAt: new Date(`2026-10-05T${15 + i}:00:00Z`), // 9:00, 10:00... in Edmonton
    })),
    ...Array.from({ length: person.timeOff ?? 0 }, (_, i) => ({
      resourceId: person.name,
      kind: "time_off",
      startsAt: new Date(`2026-10-05T${15 + i}:30:00Z`),
    })),
  ]);
  const counts = countBookingsThatDay(commitments, MONDAY, ZONE);
  const free = people
    .filter((person) => person.free !== false)
    .map((person) => ({
      resourceId: person.name,
      name: person.name,
      bookingsThatDay: counts.get(person.name) ?? 0,
    }));
  const freeRooms =
    rooms === null
      ? null
      : rooms
          .filter((room) => room.free)
          .map((room) => ({ resourceId: room.name, name: room.name }));
  return firstChoice(free, freeRooms);
}

describe('who gets "any available"', () => {
  test("the fewest bookings that day wins", () => {
    expect(
      choose(
        [
          { name: "Ana", bookings: 2 },
          { name: "Mei", bookings: 0 },
          { name: "Sofia", bookings: 1 },
        ],
        null
      )
    ).toEqual({
      personId: "Mei",
      placeId: null,
    });
  });

  test("time off does not count as a booking", () => {
    // Counted with her time off, Mei would have 3; she has 1 booking, so she still beats Ana's 2.
    expect(
      choose(
        [
          { name: "Ana", bookings: 2 },
          { name: "Mei", bookings: 1, timeOff: 2 },
        ],
        null
      )
    ).toEqual({
      personId: "Mei",
      placeId: null,
    });
  });

  test("a tie goes by name, then by id", () => {
    expect(
      choose(
        [
          { name: "Sofia", bookings: 1 },
          { name: "Mei", bookings: 1 },
        ],
        null
      )
    ).toEqual({
      personId: "Mei",
      placeId: null,
    });
  });

  test("the first free room by name", () => {
    expect(
      choose(
        [{ name: "Ana", bookings: 0 }],
        [
          { name: "Room 4", free: true },
          { name: "Room 2", free: false },
          { name: "Room 3", free: true },
        ]
      )
    ).toEqual({ personId: "Ana", placeId: "Room 3" });
  });

  test("nobody free gives nobody", () => {
    expect(
      choose(
        [
          { name: "Ana", bookings: 0, free: false },
          { name: "Mei", bookings: 0, free: false },
        ],
        null
      )
    ).toBeNull();
  });

  test("a needed room with none free gives nobody", () => {
    expect(choose([{ name: "Ana", bookings: 0 }], [{ name: "Room 3", free: false }])).toBeNull();
  });
});

describe("the edges of choosing", () => {
  test("a tie goes by name before id", () => {
    const people = [
      { resourceId: "a", name: "Sofia", bookingsThatDay: 0 },
      { resourceId: "b", name: "Mei", bookingsThatDay: 0 },
    ];
    const rooms = [
      { resourceId: "a", name: "Room 5" },
      { resourceId: "b", name: "Room 1" },
    ];
    expect(firstChoice(people, rooms)).toEqual({ personId: "b", placeId: "b" });
  });

  test("two people with the same name and bookings go by id", () => {
    const twins = [
      { resourceId: "person-b", name: "Ana", bookingsThatDay: 1 },
      { resourceId: "person-a", name: "Ana", bookingsThatDay: 1 },
    ];
    expect(firstChoice(twins, null)?.personId).toBe("person-a");
  });

  test("the order people and rooms arrive in does not matter", () => {
    const people = [
      { resourceId: "s", name: "Sofia", bookingsThatDay: 0 },
      { resourceId: "a", name: "Ana", bookingsThatDay: 0 },
    ];
    const rooms = [
      { resourceId: "r5", name: "Room 5" },
      { resourceId: "r1", name: "Room 1" },
    ];
    expect(firstChoice(people, rooms)).toEqual({ personId: "a", placeId: "r1" });
    expect(firstChoice([...people].reverse(), [...rooms].reverse())).toEqual({
      personId: "a",
      placeId: "r1",
    });
  });
});
