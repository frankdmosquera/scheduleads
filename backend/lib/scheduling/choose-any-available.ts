// Backend: who gets an "any available" booking (decision 2, Frank, 2026-10-02). Among the people
// free at that time, the fewest bookings that day; a tie goes by name, then id, so two runs never
// disagree. A room goes to the first free one by name. 5d calls it when it books. No database.

export type AnyAvailablePersonType = { resourceId: string; name: string; bookingsThatDay: number };
export type AnyAvailableRoomType = { resourceId: string; name: string };
export type AnyAvailableChoiceType = { personId: string; placeId: string | null };

const byNameThenId = (
  a: { name: string; resourceId: string },
  b: { name: string; resourceId: string }
) =>
  a.name.localeCompare(b.name, "en") ||
  (a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0);

export function chooseAnyAvailable(
  people: AnyAvailablePersonType[], // only the people free at that time
  rooms: AnyAvailableRoomType[] | null // only the free rooms; null = the service needs no room
): AnyAvailableChoiceType | null {
  if (people.length === 0) return null;
  if (rooms !== null && rooms.length === 0) return null; // a room is needed and none is free

  // Sorted here, never trusted to arrive sorted.
  const [person] = [...people].sort(
    (a, b) => a.bookingsThatDay - b.bookingsThatDay || byNameThenId(a, b)
  );
  const room = rooms === null ? null : [...rooms].sort(byNameThenId)[0];
  return { personId: person.resourceId, placeId: room ? room.resourceId : null };
}
