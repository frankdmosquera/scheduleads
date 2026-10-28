// Backend: a service's photo from its card on Settings > Services (feature 25e): the new one
// uploaded, or none. Found only inside the business; the old upload is deleted from ImageKit once
// the service no longer points at it. null: no such service here.

import { and, eq } from "drizzle-orm";

import { bookingLink } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { deleteFromImageKit } from "../images/delete-from-imagekit.js";
import type { StoredPictureType } from "../images/upload-to-imagekit.js";

export async function replaceServiceImage(
  organizationId: string,
  serviceId: string,
  picture: StoredPictureType | null
): Promise<{ imageUrl: string | null } | null> {
  const here = and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.id, serviceId));
  const old = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ imageFileId: bookingLink.imageFileId })
      .from(bookingLink)
      .where(here)
      .for("update");
    if (!before) return null;
    await tx
      .update(bookingLink)
      .set({ imageUrl: picture?.url ?? null, imageFileId: picture?.fileId ?? null })
      .where(here);
    return { fileId: before.imageFileId };
  });
  if (!old) return null;
  if (old.fileId) await deleteFromImageKit(old.fileId);
  return { imageUrl: picture?.url ?? null };
}
