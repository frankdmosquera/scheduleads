// Frontend component: one person's bookable hours, on their card on the People page (feature 12a):
// the shared own-hours card, in a person's words, saved as their bookable hours.

"use client";

import type { PersonHoursType, WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

import { OwnHoursCard } from "@/components/settings/own-hours-card";
import { savePersonHours } from "@/lib/api-client/settings/save-person-hours";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function PersonHoursCard({
  person,
  businessWeek,
  timezone,
  canEdit,
  onSaved,
}: {
  person: { id: string; name: string } & PersonHoursType;
  businessWeek: WeeklyHoursType; // copied in when the person starts their own week
  timezone: string; // the business's, for the times of the bookings listed after a save
  canEdit: boolean;
  onSaved: (hours: PersonHoursType) => void; // so the card reopens on what was saved
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
        if (saved.state !== "ok") return saved;
        const { weeklyHours, dateHours } = saved.answer.person;
        onSaved({ weeklyHours, dateHours });
        return {
          state: "ok",
          answer: { weeklyHours, dateHours, outsideHours: saved.answer.outsideHours },
        };
      }}
      businessWeek={businessWeek}
      timezone={timezone}
      canEdit={canEdit}
    />
  );
}
