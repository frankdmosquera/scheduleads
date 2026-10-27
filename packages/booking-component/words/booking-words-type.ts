// Booking component: everything the window says, one entry per thing (feature 12i). Each language
// is one object of this type, so a word left out of one is a type error, never a blank on screen.

import type { BookingLanguageType } from "@scheduleads-app/shared/zod-validation";

import type { BookingProblemType } from "../api-client/problem-from-api-answer.js";

export type BookingWordsType = {
  language: BookingLanguageType;
  close: string;
  bookOnline: string;
  bookWith(businessName: string): string;
  loading: string;
  chooseService: string;
  minutes(count: number): string;
  priceFrom(price: string): string; // "From $150": the service can cost more (feature 25d)
  tryAgain: string;
  call(phone: string): string;
  problems: Record<BookingProblemType, string>;
  backToServices: string;
  backToTimes: string;
  pickDateAndTime: string;
  backToCalendar: string; // a phone's way back from a day's times
  previousMonth: string;
  nextMonth: string;
  weekdays: [string, string, string, string, string, string, string]; // Monday first
  timesIn(zoneName: string): string;
  findingTimes: string;
  noTimesLeftIn(monthName: string): string;
  next: string;
  nextAt(dayName: string, time: string): string;
  whoWouldYouLike: string;
  anyAvailable: string;
  yourDetails: string;
  withPerson(personName: string): string;
  nameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  addressLabel: string;
  detailsLabel: string;
  eitherHint: string;
  book: string;
  booking: string;
  checkingBooking: string;
  noAnswer: string;
  tooManyWhileUnsure: string;
  // The API's own words are English; a window in another language says these instead.
  timeTaken: string;
  refused: string;
  timesUnreadable: string;
  youreBooked: string;
  confirmationOnItsWay(email: string): string;
  checkSpamFolder: string;
  // A form error as the window shows it, from the shared rules' English message.
  formError(englishMessage: string): string;
};
