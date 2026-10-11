// Frontend component: the Booking form page of Settings (feature 12f): what the business's booking
// form asks a customer.

"use client";

import { BookingQuestionsCard } from "@/components/settings/booking-questions-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { fetchBookingForm } from "@/lib/api-client/settings/fetch-booking-form";

export function BookingFormScreen() {
  return (
    <SettingsSection title="Booking form" load={fetchBookingForm}>
      {(settings) => <BookingQuestionsCard settings={settings} />}
    </SettingsSection>
  );
}
