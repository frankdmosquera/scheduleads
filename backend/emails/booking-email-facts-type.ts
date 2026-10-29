// Backend: everything the two booking emails say, for one booking, read from the database inside
// the booking's own business.

export type BookingEmailFactsType = {
  business: {
    name: string;
    logo: string | null; // an absolute https:// image URL
    phone: string | null;
    website: string | null;
    brandColor: string | null; // #rrggbb
    brandInk?: string | null; // its look's own text on brandColor (feature 25f); none: worked out
    timezone: string; // the business's own, from its bookable hours
    language: "en" | "es"; // the owner's emails are written in it (feature 12i)
  };
  language: "en" | "es"; // the booking's, kept from its window: the customer's emails are in it
  service: string;
  // Its price when the email goes (feature 25d); null when it has none or the business no currency.
  price: { cents: number; from: boolean; currency: string } | null;
  startsAt: Date;
  personName: string; // who was booked
  location: string | null; // the customer's address, as they typed it; null when none was asked
  customer: {
    name: string;
    email: string | null; // a phone-only booking has none
    phone: string | null;
    details: string | null; // the customer's own words
    // Their answers to the business's own questions, as asked (feature 9); empty when none.
    answers: { question: string; answer: string }[];
  };
};
