// Backend: who gets an "any available" booking: the first choice in orderAnyAvailable's order,
// or null when nobody is free, or a room is needed and none is free. No database.

import {
  type AnyAvailableChoiceType,
  type AnyAvailablePersonType,
  type AnyAvailableRoomType,
  orderAnyAvailable,
} from "./order-any-available.js";

export function chooseAnyAvailable(
  people: AnyAvailablePersonType[], // only the people free at that time
  rooms: AnyAvailableRoomType[] | null // only the free rooms; null = the service needs no room
): AnyAvailableChoiceType | null {
  return orderAnyAvailable(people, rooms)[0] ?? null;
}
