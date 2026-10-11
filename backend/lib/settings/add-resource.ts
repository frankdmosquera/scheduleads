// Backend: adds a person or a place from the owner's People page (feature 12d). A new person has no
// hours row, so they follow the business's week (12a).

import { randomUUID } from "node:crypto";

import { resource } from "@scheduleads-app/shared/db";
import type { AddResourceType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { lockBusinessResources } from "./lock-business-resources.js";
import { nameTaken } from "./name-taken.js";
import {
  resourceSettingsColumns,
  resourceSettingsOf,
  type ResourceSettingsType,
} from "./resource-settings-of.js";

export type AddResourceResultType =
  { ok: true; resource: ResourceSettingsType } | { ok: false; reason: "name_taken" };

export async function addResource(
  organizationId: string,
  added: AddResourceType
): Promise<AddResourceResultType> {
  return db.transaction(async (tx) => {
    await lockBusinessResources(tx, organizationId);
    if (await nameTaken(tx, organizationId, added.name, null)) {
      return { ok: false, reason: "name_taken" } as const;
    }
    const [row] = await tx
      .insert(resource)
      .values({ id: randomUUID(), organizationId, name: added.name, kind: added.kind })
      .returning(resourceSettingsColumns);
    return { ok: true, resource: resourceSettingsOf(row) } as const;
  });
}
