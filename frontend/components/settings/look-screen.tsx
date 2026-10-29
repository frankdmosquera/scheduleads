// Frontend component: the Look page of Settings (feature 25e): the business's logo and its colours,
// worn by its booking window, its dashboard and its customers' emails. A login that may not change
// the business only sees them.

"use client";

import { useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { ColoursCard } from "@/components/settings/colours-card";
import { PictureField } from "@/components/settings/picture-field";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  fetchLookSettings,
  type LookSettingsType,
} from "@/lib/api-client/settings/fetch-look-settings";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function LookScreen() {
  const { words } = useDashboardWords();
  return (
    <SettingsSection title={words.settingsFrameWords.look} load={fetchLookSettings}>
      {(settings) => <LookCard settings={settings} />}
    </SettingsSection>
  );
}

function LookCard({ settings }: { settings: LookSettingsType }) {
  const { lookWords } = useDashboardWords().words;
  const [logo, setLogo] = useState(settings.logo);
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card px-4 py-4 md:px-6">
      {settings.canEdit ? null : (
        <CentredCardNotice tone="info">{lookWords.cannotChange}</CentredCardNotice>
      )}
      <PictureField
        target={{ kind: "logo" }}
        label={lookWords.logo}
        hint={lookWords.logoHint}
        emptyLine={lookWords.noLogo}
        alt={settings.name}
        picture={logo}
        longestSide={600}
        canEdit={settings.canEdit}
        onSaved={setLogo}
      />
      <ColoursCard
        colours={settings.colours}
        coloursOn={settings.coloursOn}
        looks={settings.looks}
        canEdit={settings.canEdit}
      />
    </div>
  );
}
