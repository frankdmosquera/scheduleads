// Frontend: how a 409 for a booking that can no longer move is told apart.

import type { RefusalType } from "@/lib/api-client/refusal-type";

// A 409 for a booking that can no longer move: started, or cancelled meanwhile.
export function moveRefusalState(refusal: RefusalType): {
  state: "already-started" | "already-cancelled";
} {
  return refusal.error?.code === "already_cancelled"
    ? { state: "already-cancelled" }
    : { state: "already-started" };
}
