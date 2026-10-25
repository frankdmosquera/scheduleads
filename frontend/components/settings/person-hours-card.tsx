// Frontend component: one person's row of hours on Settings (feature 12a): the shared own-hours
// card, in a person's words, saved as their bookable hours.

"use client";

import type { WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

import { OwnHoursCard } from "@/components/settings/own-hours-card";
import type { HoursSettingsType } from "@/lib/api-client/settings/fetch-hours-settings";
import { savePersonHours } from "@/lib/api-client/settings/save-person-hours";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function PersonHoursCard({
  person,
  businessWeek,
  timezone,
  canEdit,
}: {
  person: HoursSettingsType["people"][number];
  businessWeek: WeeklyHoursType; // copied in when the person starts their own week
  timezone: string; // the business's, for the times of the bookings listed after a save
  canEdit: boolean;
}) {
  const { hoursWords } = useDashboardWords().words;
  return (
    <OwnHoursCard
      owner={person}
      rowsName="people"
      words={{
        follows: hoursWords.followsBusinessWeek,
        own: hoursWords.ownWeek,
        ownDays: hoursWords.ownWeekDays,
        weekLabel: hoursWords.personWeek,
        datesTitle: hoursWords.personOneOffDates,
        save: hoursWords.savePersonHours,
        saved: hoursWords.savedPersonHours,
        outsideTitle: hoursWords.outsideYourHours,
      }}
      save={async (hours) => {
        const saved = await savePersonHours(person.id, hours);
        return saved.state === "ok"
          ? {
              state: "ok",
              answer: { ...saved.answer.person, outsideHours: saved.answer.outsideHours },
            }
          : saved;
      }}
      businessWeek={businessWeek}
      timezone={timezone}
      canEdit={canEdit}
    />
  );
}
