// Backend: a person or place as the People page shows and saves it, read from its row.

import { resource } from "@scheduleads-app/shared/db";

export type ResourceSettingsType = {
  id: string;
  name: string;
  kind: "person" | "place";
  active: boolean;
  workEmail: string | null; // a person's only (12d.4)
};

// The columns the page shows and saves, so a read and a save answer the same shape.
export const resourceSettingsColumns = {
  id: resource.id,
  name: resource.name,
  kind: resource.kind,
  active: resource.active,
  workEmail: resource.workEmail,
};

// The database's check keeps kind to these two; anything else is a corrupt row, a real fault.
// Takes any row with an id and a kind, so the Services page's shorter rows read the same way.
export function resourceSettingsOf<Row extends { id: string; kind: string }>(
  row: Row
): Omit<Row, "kind"> & { kind: ResourceSettingsType["kind"] } {
  if (row.kind !== "person" && row.kind !== "place") {
    throw new Error(`resource ${row.id} has an unknown kind.`);
  }
  return { ...row, kind: row.kind };
}
