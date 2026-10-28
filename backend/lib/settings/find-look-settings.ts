// Backend: what the owner's Look page shows (feature 25e): the business's name, its logo and its
// three colours.

import { eq } from "drizzle-orm";

import { organization } from "@scheduleads-app/shared/db";
import type { BusinessColoursType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";

export async function findLookSettings(organizationId: string): Promise<{
  name: string;
  logo: string | null;
  colours: BusinessColoursType;
  coloursOn: boolean; // false: not worn yet, even with a colour saved earlier for the emails
}> {
  const [row] = await db
    .select({
      name: organization.name,
      logo: organization.logo,
      main: organization.brandColor,
      background: organization.backgroundColor,
      text: organization.textColor,
      coloursOn: organization.coloursOn,
    })
    .from(organization)
    .where(eq(organization.id, organizationId));
  return {
    name: row?.name ?? "",
    logo: row?.logo ?? null,
    coloursOn: row?.coloursOn ?? false,
    colours: {
      main: row?.main ?? null,
      background: row?.background ?? null,
      text: row?.text ?? null,
    },
  };
}
