// Backend: a person or place as the People page shows and saves it, read from its row.

import { resource } from "@scheduleads-app/shared/db";

export type ResourceSettingsType = {
  id: string;
  name: string;
  kind: "person" | "place";
  active: boolean;
};

// The columns the page shows and saves, so a read and a save answer the same shape.
export const resourceSettingsColumns = {
  id: resource.id,
  name: resource.name,
  kind: resource.kind,
  active: resource.active,
};

// The database's check keeps kind to these two; anything else is a corrupt row, a real fault.
export function resourceSettingsOf(row: {
  id: string;
  name: string;
  kind: string;
  active: boolean;
}): ResourceSettingsType {
  if (row.kind !== "person" && row.kind !== "place") {
    throw new Error(`resource ${row.id} has an unknown kind.`);
  }
  return { ...row, kind: row.kind };
}
