// Frontend: everything the dashboard says, as one type (feature 12j). english-dashboard-words.ts
// and spanish-dashboard-words.ts each fill it whole, so a word left out of one is a type error.
// Words a business typed itself (its services, people, questions) are never in here.

import type { DashboardLanguageType } from "@scheduleads-app/shared/pick-dashboard-language";

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
};
