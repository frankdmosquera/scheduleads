// Backend: the business's logo from Settings > Look (feature 25e): the new one uploaded, or none.
// The old upload is deleted from ImageKit once the business no longer points at it.

import { eq } from "drizzle-orm";

import { organization } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { deleteFromImageKit } from "../images/delete-from-imagekit.js";
import type { StoredPictureType } from "../images/upload-to-imagekit.js";

export async function replaceBusinessLogo(
  organizationId: string,
  picture: StoredPictureType | null
): Promise<{ logo: string | null }> {
  const oldFileId = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ logoFileId: organization.logoFileId })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .for("update");
    await tx
      .update(organization)
      .set({ logo: picture?.url ?? null, logoFileId: picture?.fileId ?? null })
      .where(eq(organization.id, organizationId));
    return before?.logoFileId ?? null;
  });
  if (oldFileId) await deleteFromImageKit(oldFileId);
  return { logo: picture?.url ?? null };
}
