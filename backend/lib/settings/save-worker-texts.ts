// Backend: saves one person's worker texts from the owner's People page (feature 12g): on with a
// phone and their three choices, or off, which removes them. Only a person of this business; a
// place gets no texts. A phone that is a business's texting number is refused (8c, decision 6).

import { and, eq } from "drizzle-orm";

import { resource, workerTextSettings } from "@scheduleads-app/shared/db";
import type { SaveWorkerTextsType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { findTextingBusiness } from "../text/find-texting-business.js";
import type { WorkerTextSettingsRowType } from "../text/find-worker-text-settings.js";
import { lockBusinessResources } from "./lock-business-resources.js";

export type SaveWorkerTextsResultType =
  | { ok: true; texts: WorkerTextSettingsRowType | null }
  | { ok: false; reason: "not_found" | "a_place" | "texting_number" };

export async function saveWorkerTexts(
  organizationId: string,
  personId: string,
  { texts }: SaveWorkerTextsType
): Promise<SaveWorkerTextsResultType> {
  return db.transaction(async (tx) => {
    await lockBusinessResources(tx, organizationId);
    const [person] = await tx
      .select({ kind: resource.kind })
      .from(resource)
      .where(and(eq(resource.organizationId, organizationId), eq(resource.id, personId)))
      .limit(1);
    if (!person) return { ok: false, reason: "not_found" } as const;
    if (person.kind !== "person") return { ok: false, reason: "a_place" } as const;

    if (!texts) {
      await tx
        .delete(workerTextSettings)
        .where(
          and(
            eq(workerTextSettings.organizationId, organizationId),
            eq(workerTextSettings.personId, personId)
          )
        );
      return { ok: true, texts: null } as const;
    }
    // Texted from that number, the person would never get it, or another business would.
    if (await findTextingBusiness(texts.phone)) {
      return { ok: false, reason: "texting_number" } as const;
    }
    await tx
      .insert(workerTextSettings)
      .values({ personId, organizationId, ...texts })
      .onConflictDoUpdate({ target: workerTextSettings.personId, set: texts });
    return { ok: true, texts } as const;
  });
}
