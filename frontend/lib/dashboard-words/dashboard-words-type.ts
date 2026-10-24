// Frontend: everything the dashboard says, as one type (feature 12j). english-dashboard-words.ts
// and spanish-dashboard-words.ts each fill it whole, so a word left out of one is a type error.
// Words a business typed itself (its services, people, questions) are never in here.

import type { DashboardLanguageType } from "@scheduleads-app/shared/pick-dashboard-language";

import type { LeadsWordsType } from "@/lib/dashboard-words/leads-words";
import type { ScheduleWordsType } from "@/lib/dashboard-words/schedule-words";
import type { HoursWordsType } from "@/lib/dashboard-words/hours-words";
import type { DaysOffWordsType } from "@/lib/dashboard-words/days-off-words";
import type { PeopleWordsType } from "@/lib/dashboard-words/people-words";
import type { ServicesWordsType } from "@/lib/dashboard-words/services-words";
import type { BookingFormWordsType } from "@/lib/dashboard-words/booking-form-words";
import type { TextsWordsType } from "@/lib/dashboard-words/texts-words";
import type { CalendarSettingsWordsType } from "@/lib/dashboard-words/calendar-settings-words";
import type { SettingsFrameWordsType } from "@/lib/dashboard-words/settings-frame-words";
import type { SetupCardsWordsType } from "@/lib/dashboard-words/setup-cards-words";

export type { DashboardLanguageType };

export type DashboardWordsType = {
  intlLocale: string;
  // The language switch
  languageSwitchLabel: string;
  languageNotSaved: string;
  // Sign-in
  signIn: string;
  signInLede: string;
  emailLabel: string;
  sending: string;
  sendMeACode: string;
  codeNotSent: string;
  checkYourEmail: string;
  codeOnItsWay(length: number): string; // followed by the address, then a full stop
  useADifferentEmail: string;
  loginCodeLabel: string;
  checking: string;
  codeNotRight: string;
  signOut: string;
  // Before a business opens
  oneMoment: string;
  loadingYourBusiness: string;
  takingYouToSignIn: string;
  oneMomentEllipsis: string;
  needsAttention: string;
  planNotRecognisedLede: string;
  nothingLost: string;
  cannotReachTheApi: string;
  tryAgain: string;
  lookingUpBusinesses: string;
  businessesNotLoaded: string;
  businessNotOpened: string;
  noBusinessYet: string;
  noBusinessYetLede: string;
  nothingUntilThen: string;
  whichBusiness: string;
  whichBusinessLede: string;
  // The frame
  screensLabel: string;
  leads: string;
  calendar: string;
  settings: string;
  setup: string;
  // Setup, the home screen
  signedInAs: string;
  yourRole: string;
  roleName(role: string): string; // owner, admin, member; anything else as it is
  address: string;
  plan: string;
  included: string;
  nothingIncluded: string;
  homeNote: string;
  setUpAClient: string;
  // A screen whose sign-in has ended
  signInEnded: string;
  signInAgain: string;
  // Each area's own words
  leadsWords: LeadsWordsType;
  scheduleWords: ScheduleWordsType;
  hoursWords: HoursWordsType;
  daysOffWords: DaysOffWordsType;
  peopleWords: PeopleWordsType;
  servicesWords: ServicesWordsType;
  bookingFormWords: BookingFormWordsType;
  textsWords: TextsWordsType;
  calendarSettingsWords: CalendarSettingsWordsType;
  settingsFrameWords: SettingsFrameWordsType;
  setupCardsWords: SetupCardsWordsType;
};
