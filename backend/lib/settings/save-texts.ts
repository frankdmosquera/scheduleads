// Backend: saves the business's text choices from the owner's Texts page (feature 12g): whether the
// confirmation goes, its reminders and where replies go. The texting number is the agency's and is
// never changed here. A reminder added also reaches the upcoming bookings already made; one removed
// stops, since each reminder's job reads the settings again when it runs.

import { and, eq, gt } from "drizzle-orm";

import { booking, textSettings } from "@scheduleads-app/shared/db";
import type { TextChoicesType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { enqueueBookingReminder } from "../jobs/enqueue-booking-reminder.js";
import { findTextingBusiness } from "../text/find-texting-business.js";
import { findTextsSettings, type TextsSettingsType } from "./find-texts-settings.js";
import { lockBusinessResources } from "./lock-business-resources.js";

export type SaveTextsResultType =
  | { ok: true; texts: TextsSettingsType }
  | { ok: false; reason: "no_text_settings" }
  | { ok: false; reason: "texting_number" }; // the reply phone is a business's texting number

export async function saveTexts(
  organizationId: string,
  choices: TextChoicesType,
  now: Date
): Promise<SaveTextsResultType> {
  return db.transaction(async (tx) => {
    await lockBusinessResources(tx, organizationId);
    const saved = await findTextsSettings(tx, organizationId);
    if (!saved) return { ok: false, reason: "no_text_settings" } as const;
    // Its own number or another business's: a reply sent there is lost, or reaches that business.
    if (choices.replyPhone && (await findTextingBusiness(choices.replyPhone))) {
      return { ok: false, reason: "texting_number" } as const;
    }

    const reminders = [...choices.reminderMinutesBefore].sort((a, b) => b - a);
    await tx
      .update(textSettings)
      .set({ ...choices, reminderMinutesBefore: reminders })
      .where(eq(textSettings.organizationId, organizationId));

    const added = reminders.filter((minutes) => !saved.reminderMinutesBefore.includes(minutes));
    if (added.length) {
      const upcoming = await tx
        .select({ id: booking.id, sequence: booking.sequence, startsAt: booking.startsAt })
        .from(booking)
        .where(
          and(
            eq(booking.organizationId, organizationId),
            eq(booking.status, "confirmed"),
            gt(booking.startsAt, now)
          )
        );
      for (const { id, sequence, startsAt } of upcoming) {
        for (const minutesBefore of added) {
          await enqueueBookingReminder(tx, {
            organizationId,
            bookingId: id,
            sequence,
            startsAt,
            minutesBefore,
            now,
          });
        }
      }
    }

    const texts = await findTextsSettings(tx, organizationId);
    if (!texts) throw new Error(`The texts of business ${organizationId} went missing.`);
    return { ok: true, texts } as const;
  });
}
