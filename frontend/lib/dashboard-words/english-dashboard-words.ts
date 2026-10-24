// Frontend: the dashboard's words in English (feature 12j).

import type { DashboardWordsType } from "@/lib/dashboard-words/dashboard-words-type";
import { englishLeadsWords } from "@/lib/dashboard-words/leads-words";
import { englishScheduleWords } from "@/lib/dashboard-words/schedule-words";
import { englishHoursWords } from "@/lib/dashboard-words/hours-words";
import { englishDaysOffWords } from "@/lib/dashboard-words/days-off-words";
import { englishPeopleWords } from "@/lib/dashboard-words/people-words";
import { englishServicesWords } from "@/lib/dashboard-words/services-words";
import { englishBookingFormWords } from "@/lib/dashboard-words/booking-form-words";
import { englishTextsWords } from "@/lib/dashboard-words/texts-words";
import { englishCalendarSettingsWords } from "@/lib/dashboard-words/calendar-settings-words";
import { englishSettingsFrameWords } from "@/lib/dashboard-words/settings-frame-words";
import { englishSetupCardsWords } from "@/lib/dashboard-words/setup-cards-words";

export const englishDashboardWords: DashboardWordsType = {
  intlLocale: "en-CA",
  languageSwitchLabel: "Language",
  languageNotSaved: "Your language could not be saved. Try again.",
  signIn: "Sign in",
  signInLede: "Enter your email and we will send you a code. No password to remember.",
  emailLabel: "Email",
  emailPlaceholder: "you@yourbusiness.com",
  sending: "Sending…",
  sendMeACode: "Send me a code",
  codeNotSent: "That code could not be sent. Try again.",
  checkYourEmail: "Check your email",
  codeOnItsWay: (length) => `A ${length} digit code is on its way to`,
  useADifferentEmail: "Use a different email",
  loginCodeLabel: "Login code",
  checking: "Checking…",
  codeNotRight: "That code is not right. Request a new one.",
  codeExpired: "That code has expired. Request a new one.",
  codeTriedTooOften: "That code was tried too many times. Request a new one.",
  tooManyTries: "Too many tries. Wait a minute and try again.",
  signOut: "Sign out",
  oneMoment: "One moment",
  loadingYourBusiness: "Loading your business…",
  takingYouToSignIn: "Taking you to sign in",
  oneMomentEllipsis: "One moment…",
  needsAttention: "This account needs attention",
  planNotRecognisedLede:
    "Your business is on a plan this dashboard does not recognise, so there is nothing safe to show you.",
  nothingLost: "Nothing is lost. Get in touch and we will put the account back on the right plan.",
  cannotReachTheApi: "Cannot reach the API",
  tryAgain: "Try again",
  lookingUpBusinesses: "Looking up your businesses…",
  businessesNotLoaded: "Could not load your businesses.",
  businessNotOpened: "That business could not be opened.",
  noBusinessYet: "Your login has no business yet",
  noBusinessYetLede:
    "The agency sets up your business for you. Get in touch with them and it will be here the next time you sign in.",
  nothingUntilThen: "There is nothing to show until then.",
  whichBusiness: "Which business?",
  whichBusinessLede:
    "You belong to more than one, so we will not guess. Pick the one you are working in.",
  screensLabel: "Screens",
  leads: "Leads",
  calendar: "Calendar",
  settings: "Settings",
  setup: "Setup",
  signedInAs: "Signed in as",
  yourRole: "Your role",
  roleName: (role) => role,
  address: "Address",
  plan: "Plan",
  included: "Included",
  nothingIncluded: "nothing",
  homeNote:
    "Every figure above came from one call to the API, scoped to this business by your session. Every lead is on the Leads screen.",
  setUpAClient: "Set up a client",
  signInEnded: "Your sign-in has ended.",
  signInAgain: "Sign in again",
  leadsWords: englishLeadsWords,
  scheduleWords: englishScheduleWords,
  hoursWords: englishHoursWords,
  daysOffWords: englishDaysOffWords,
  peopleWords: englishPeopleWords,
  servicesWords: englishServicesWords,
  bookingFormWords: englishBookingFormWords,
  textsWords: englishTextsWords,
  calendarSettingsWords: englishCalendarSettingsWords,
  settingsFrameWords: englishSettingsFrameWords,
  setupCardsWords: englishSetupCardsWords,
};
