import { describe, expect, test } from "vitest";

import { orderAnyAvailable } from "./order-any-available.js";

const person = (resourceId: string, name: string, bookingsThatDay: number) => ({
  resourceId,
  name,
  bookingsThatDay,
});

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
