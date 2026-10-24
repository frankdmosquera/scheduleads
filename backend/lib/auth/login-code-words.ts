// Backend: what the sign-in code email says, in English and Spanish (feature 12j). Spanish is in
// "usted", as the booking emails. One object per language, so a word left out is a type error.

import type { DashboardLanguageType } from "@scheduleads-app/shared/pick-dashboard-language";

type LoginCodeWordsType = {
  subject(otp: string): string;
  text(otp: string): string;
  codeIs: string; // followed by the code, then a full stop
  worksFor: string;
  ignoreIt: string;
};

export const loginCodeWordsOf: Record<DashboardLanguageType, LoginCodeWordsType> = {
  en: {
    subject: (otp) => `Your sign-in code: ${otp}`,
    text: (otp) =>
      `Your sign-in code is ${otp}. It works for 5 minutes.\n\nIf you did not ask for it, ignore this email.`,
    codeIs: "Your sign-in code is",
    worksFor: "It works for 5 minutes.",
    ignoreIt: "If you did not ask for it, ignore this email.",
  },
  es: {
    subject: (otp) => `Su código de acceso: ${otp}`,
    text: (otp) =>
      `Su código de acceso es ${otp}. Sirve durante 5 minutos.\n\nSi usted no lo pidió, ignore este correo.`,
    codeIs: "Su código de acceso es",
    worksFor: "Sirve durante 5 minutos.",
    ignoreIt: "Si usted no lo pidió, ignore este correo.",
  },
};
