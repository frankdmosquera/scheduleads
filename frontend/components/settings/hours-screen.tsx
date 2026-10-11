// Frontend component: the Hours page of Settings (feature 12a): the business's hours, then each
// person's.

"use client";

import { useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { BusinessHoursCard } from "@/components/settings/business-hours-card";
import { PersonHoursCard } from "@/components/settings/person-hours-card";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  fetchHoursSettings,
  type HoursSettingsType,
} from "@/lib/api-client/settings/fetch-hours-settings";

export function HoursScreen() {
  return (
    <SettingsSection title="Hours" load={fetchHoursSettings}>
      {(settings) => <HoursSection settings={settings} />}
    </SettingsSection>
  );
}

function HoursSection({ settings }: { settings: HoursSettingsType }) {
  // Saved here too, so people's cards appear after the business's first save and copy its week.
  const [business, setBusiness] = useState(settings.business);

  return (
    <div className="flex flex-col gap-4">
      {!settings.canEdit ? (
        <CentredCardNotice tone="info">
          Your role cannot change the hours. You can see them here.
        </CentredCardNotice>
      ) : null}
      <BusinessHoursCard initial={business} canEdit={settings.canEdit} onSaved={setBusiness} />

      <h3 className="mt-4 text-sm font-semibold text-foreground">Each person</h3>
      {!business ? (
        <p className="text-sm text-muted-foreground">
          Set the business&apos;s hours first. Then each person can follow them or keep their own.
        </p>
      ) : settings.people.length === 0 ? (
        <p className="text-sm text-muted-foreground">No people yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {settings.people.map((person) => (
            <PersonHoursCard
              key={person.id}
              person={person}
              businessWeek={business.weeklyHours}
              timezone={business.timezone}
              canEdit={settings.canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
