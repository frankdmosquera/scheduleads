// IA a la Orden, the agency's own business in Colombia (feature 10; the English AgentsWeb comes
// later). Every value is read from the agency site's Book a call card
// (agency-site-app/data/contactData.ts, contactBookingData) and its base (siteConfig visits.base
// "colombia"). Made first on /admin/client-setup.
// Apply: npm run client:setup --workspace=@scheduleads-app/shared -- client-setups/ia-la-orden.ts --apply

import type { ClientSetupInputType } from "@scheduleads-app/shared/zod-validation";

// The card's days (openWeekdays 1 to 5), first start 8:00 and last start 17:30, so a
// 30-minute call ends by 18:00. Minutes from midnight.
const callHours = [{ startMinute: 8 * 60, endMinute: 18 * 60 }];

export default {
  slug: "ia-la-orden",
  personChoice: "business_assigns", // Frank is the one person, the business's first
  contactRule: "either", // an email or a phone, whichever the visitor leaves
  // The card asks only a name and an email or phone, which the booking window asks itself.
  questions: [],
  hours: {
    weeklyHours: { mon: callHours, tue: callHours, wed: callHours, thu: callHours, fri: callHours },
    timezone: "America/Bogota", // Frank's base now; switched with the site's base
    minimumNoticeMinutes: 0, // the card sets no notice; Frank's to change
    horizonDays: 21, // the card's daysAhead
    closedDates: [],
  },
  people: [],
  services: [
    // A call needs no address.
    { name: "Video call", durationMinutes: 30, slotIntervalMinutes: 30, addressMode: "not_asked" },
    { name: "Phone call", durationMinutes: 30, slotIntervalMinutes: 30, addressMode: "not_asked" },
  ],
} satisfies ClientSetupInputType;
