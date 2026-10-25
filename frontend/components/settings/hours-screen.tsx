// Frontend component: the Hours page of Settings (feature 12a): the business's hours. Each person's
// are on their card on People.

"use client";

import { useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { BusinessHoursCard } from "@/components/settings/business-hours-card";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  fetchHoursSettings,
  type HoursSettingsType,
} from "@/lib/api-client/settings/fetch-hours-settings";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function HoursScreen() {
  const { words } = useDashboardWords();
  return (
    <SettingsSection title={words.settingsFrameWords.hours} load={fetchHoursSettings}>
      {(settings) => <HoursSection settings={settings} />}
    </SettingsSection>
  );
}

function HoursSection({ settings }: { settings: HoursSettingsType }) {
  // Saved here too, so the card says the zone and the lede of what was saved.
  const [business, setBusiness] = useState(settings.business);
  const { hoursWords } = useDashboardWords().words;
  return (
    <div className="flex flex-col gap-4">
      {!settings.canEdit ? (
        <CentredCardNotice tone="info">{hoursWords.cannotChange}</CentredCardNotice>
      ) : null}
      <BusinessHoursCard initial={business} canEdit={settings.canEdit} onSaved={setBusiness} />
    </div>
  );
}
