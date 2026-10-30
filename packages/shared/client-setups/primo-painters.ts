// Primo Painters, interior painting in Calgary, the first paying client (feature 13). Every value
// is read from his live Calendly on 2026-10-29 (calendly.com/primo-painting/30min, its public
// event and its open times for 60 days), so the switch changes nothing he did not choose.
// Made first on /admin/client-setup.
// Apply: npm run client:setup --workspace=@scheduleads-app/shared -- client-setups/primo-painters.ts --apply

import type { ClientSetupInputType } from "@scheduleads-app/shared/zod-validation";

// Calendly's last starts are 14:30, 16:30 and 11:30, so a 30-minute estimate ends by these.
// Minutes from midnight.
const weekdayHours = [{ startMinute: 9 * 60, endMinute: 15 * 60 }];

export default {
  slug: "primo-painters",
  personChoice: "business_assigns", // Frank handles his bookings; his crews come with item 19
  // An email and a phone, both required, as his Calendly (Frank, Oct 29; the rule is feature 13).
  contactRule: "both",
  look: {
    logo: "https://www.primopainters.ca/primo-painters-logo-400.png",
    colours: { main: "#0d378d", background: null, text: null }, // his site's blue
  },
  // His Calendly's required question, in its words, as the window's own project box (feature 13).
  detailsBox: { label: "Tell us about your project", required: true },
  questions: [],
  hours: {
    weeklyHours: {
      mon: weekdayHours,
      tue: weekdayHours,
      wed: weekdayHours,
      thu: weekdayHours,
      fri: weekdayHours,
      sat: [{ startMinute: 9 * 60, endMinute: 17 * 60 }],
      sun: [{ startMinute: 9 * 60, endMinute: 12 * 60 }],
    },
    // His Calgary clock. His Calendly counts in America/Denver, which falls back an hour on
    // Nov 1 while Alberta stays on UTC-6, so from Nov 2 it offers 10:00 to 15:30 (open question 6).
    timezone: "America/Edmonton",
    // Provisional (open question 5): Calendly's open times only pin it between 4.5 and 23 hours.
    minimumNoticeMinutes: 12 * 60,
    horizonDays: 60, // Calendly's 86,400 minutes, a moving window
    // Canada's days his Calendly closes that Alberta's list does not hold: Boxing Day, and the
    // Day for Truth and Reconciliation (the plan, Sep 18). A closed date does not repeat.
    closedDates: ["2026-12-26", "2027-09-30"],
    holidayCountry: "CA",
    holidayRegion: "AB",
    // His Calendly closes Canada's list, with Family Day open (plan). Remembrance Day and
    // Christmas Day are seen closed in his live calendar; the rest to match on open question 5.
    closedHolidays: [
      "New Year's Day",
      "Good Friday",
      "Victoria Day",
      "Canada Day",
      "Labour Day",
      "Thanksgiving",
      "Remembrance Day",
      "Christmas Day",
    ],
  },
  people: [],
  services: [
    {
      name: "Free Estimate", // his Calendly event's name
      // His Calendly event has none: the first line of his own /booking page. No photo: it made the
      // window taller with nothing to book (Frank, Oct 29).
      description: "Your estimate is completely free with no obligation.",
      durationMinutes: 30,
      slotIntervalMinutes: 30,
      addressMode: "required", // Calendly asks the invitee where; a painter travels to the job
    },
  ],
} satisfies ClientSetupInputType;
