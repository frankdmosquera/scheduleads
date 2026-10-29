// Backend: the business's colours from Settings > Look (feature 25e): the main colour (the one its
// emails already use), the background and the text of its booking window. Picked from one of its
// own looks (feature 25f), they keep that look's ink, but only while all three are the look's own:
// any other colours clear it, and the text on the main colour is worked out again.

import { eq } from "drizzle-orm";

import { organization } from "@scheduleads-app/shared/db";
import type {
  BusinessColoursType,
  SaveBusinessColoursType,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";

export async function saveBusinessColours(
  organizationId: string,
  { main, background, text, look: lookName }: SaveBusinessColoursType
): Promise<BusinessColoursType> {
  return db.transaction(async (tx) => {
    const [business] = await tx
      .select({ looks: organization.looks })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .for("update");
    const look = lookName
      ? business?.looks.find(
          (each) =>
            each.name === lookName &&
            each.main === main &&
            each.background === background &&
            each.text === text
        )
      : undefined;
    const [saved] = await tx
      .update(organization)
      // Saved here, the colours are worn; all three taken off, the window and dashboard go back.
      .set({
        brandColor: main,
        backgroundColor: background,
        textColor: text,
        coloursOn: !!(main || background || text),
        mainInkColor: look?.ink ?? null,
      })
      .where(eq(organization.id, organizationId))
      .returning({
        main: organization.brandColor,
        background: organization.backgroundColor,
        text: organization.textColor,
      });
    return saved;
  });
}
