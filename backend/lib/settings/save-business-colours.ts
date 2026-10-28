// Backend: the business's colours from Settings > Look (feature 25e): the main colour (the one its
// emails already use), the background and the text of its booking window.

import { eq } from "drizzle-orm";

import { organization } from "@scheduleads-app/shared/db";
import type { BusinessColoursType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";

export async function saveBusinessColours(
  organizationId: string,
  { main, background, text }: BusinessColoursType
): Promise<BusinessColoursType> {
  const [saved] = await db
    .update(organization)
    // Saved here, the colours are worn; all three taken off, the window and dashboard go back.
    .set({
      brandColor: main,
      backgroundColor: background,
      textColor: text,
      coloursOn: !!(main || background || text),
    })
    .where(eq(organization.id, organizationId))
    .returning({
      main: organization.brandColor,
      background: organization.backgroundColor,
      text: organization.textColor,
    });
  return saved;
}
