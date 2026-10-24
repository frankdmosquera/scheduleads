// Frontend component: the Booking form page of Settings (feature 12f): what the business's booking
// form asks a customer.

"use client";

import { useState } from "react";

import { BookingFormRulesCard } from "@/components/settings/booking-form-rules-card";
import { BookingQuestionsCard } from "@/components/settings/booking-questions-card";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  fetchBookingForm,
  type BookingFormSettingsType,
} from "@/lib/api-client/settings/fetch-booking-form";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function BookingFormScreen() {
  const { words } = useDashboardWords();
  return (
    <SettingsSection title={words.settingsFrameWords.bookingForm} load={fetchBookingForm}>
      {(settings) => <BookingFormCards settings={settings} />}
    </SettingsSection>
  );
}

// The business's language as last saved, so the ready-made questions follow a save without a reload.
function BookingFormCards({ settings }: { settings: BookingFormSettingsType }) {
  const [businessLanguage, setBusinessLanguage] = useState(settings.language);
  return (
    <div className="flex flex-col gap-6">
      <BookingFormRulesCard settings={settings} onLanguageSaved={setBusinessLanguage} />
      <BookingQuestionsCard settings={settings} businessLanguage={businessLanguage} />
    </div>
  );
}
