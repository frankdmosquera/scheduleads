// Frontend component: the Booking form page of Settings (feature 12f): what the business's booking
// form asks a customer.

"use client";

import { BookingFormRulesCard } from "@/components/settings/booking-form-rules-card";
import { BookingQuestionsCard } from "@/components/settings/booking-questions-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { fetchBookingForm } from "@/lib/api-client/settings/fetch-booking-form";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function BookingFormScreen() {
  const { words } = useDashboardWords();
  return (
    <SettingsSection title={words.settingsFrameWords.bookingForm} load={fetchBookingForm}>
      {(settings) => (
        <div className="flex flex-col gap-6">
          <BookingFormRulesCard settings={settings} />
          <BookingQuestionsCard settings={settings} />
        </div>
      )}
    </SettingsSection>
  );
}
