// Backend: the order "any available" tries people and rooms in. Among the people free at that
// time, the fewest bookings that day first; a tie goes by name, then id, so two runs never
// disagree. Each person is paired with the free rooms by name, then id. No database.

export type AnyAvailablePersonType = { resourceId: string; name: string; bookingsThatDay: number };
export type AnyAvailableRoomType = { resourceId: string; name: string };
export type AnyAvailableChoiceType = { personId: string; placeId: string | null };

const byNameThenId = (
  a: { name: string; resourceId: string },
  b: { name: string; resourceId: string }
) =>
  a.name.localeCompare(b.name, "en") ||
  (a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0);

export function orderAnyAvailable(
  people: AnyAvailablePersonType[], // only the people free at that time
  rooms: AnyAvailableRoomType[] | null // only the free rooms; null = the service needs no room
): AnyAvailableChoiceType[] {
  // Sorted here, never trusted to arrive sorted.
  const orderedPeople = [...people].sort(
    (a, b) => a.bookingsThatDay - b.bookingsThatDay || byNameThenId(a, b)
  );
  const placeIds =
    rooms === null ? [null] : [...rooms].sort(byNameThenId).map((room) => room.resourceId);
  return orderedPeople.flatMap((person) =>
    placeIds.map((placeId) => ({ personId: person.resourceId, placeId }))
  );
}
