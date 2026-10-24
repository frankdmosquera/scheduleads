// Frontend component: the Texts page of Settings (feature 12g): the texts the business sends its
// customers. Its texting number comes from the agency; until then there is nothing to set.

"use client";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { SettingsSection } from "@/components/settings/settings-section";
import { TextsForm } from "@/components/settings/texts-form";
import { fetchTexts } from "@/lib/api-client/settings/fetch-texts";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function TextsScreen() {
  const { words } = useDashboardWords();
  return (
    <SettingsSection title={words.settingsFrameWords.texts} load={fetchTexts}>
      {({ canEdit, texts }) =>
        texts ? (
          <TextsForm texts={texts} canEdit={canEdit} />
        ) : (
          <CentredCardNotice tone="info">{words.textsWords.notSetUp}</CentredCardNotice>
        )
      }
    </SettingsSection>
  );
}
