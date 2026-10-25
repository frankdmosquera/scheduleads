// Frontend component: when one service runs, under its row or form on the Services page (feature
// 12k): the shared own-hours card, in a service's words. Its own week narrows who does it, never
// widens.

"use client";

import type { PersonHoursType, WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

import { OwnHoursCard } from "@/components/settings/own-hours-card";
import { saveServiceHours } from "@/lib/api-client/settings/save-service-hours";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function ServiceHoursCard({
  service,
  hours,
  businessWeek,
  timezone,
  canEdit,
  onSaved,
}: {
  service: { id: string; name: string };
  hours: PersonHoursType; // a service with no row runs whenever the business is open
  businessWeek: WeeklyHoursType; // copied in when the service starts its own week
  timezone: string; // the business's, for the times of the bookings listed after a save
  canEdit: boolean;
  onSaved: (hours: PersonHoursType) => void;
}) {
  const { servicesWords } = useDashboardWords().words;
  return (
    <OwnHoursCard
      owner={{ ...service, ...hours }}
      rowsName="service-hours"
      words={{
        follows: servicesWords.runsWhenOpen,
        own: servicesWords.runsOwnWeek,
        ownDays: servicesWords.runsOwnWeekDays,
        weekLabel: servicesWords.whenItRuns,
        datesTitle: servicesWords.itsOneOffDates,
        save: servicesWords.saveWhenItRuns,
        saved: servicesWords.savedWhenItRuns,
        outsideTitle: servicesWords.outsideItsHours,
      }}
      save={async (next) => {
        const saved = await saveServiceHours(service.id, next);
        if (saved.state !== "ok") return saved;
        const { weeklyHours, dateHours } = saved.answer.hours;
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
