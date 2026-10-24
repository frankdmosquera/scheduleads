// Frontend component: which language the dashboard speaks, and its words, for every page below the
// root layout (feature 12j). Signed in, the login's own pick (from GET /me, or the switch once
// saved); with none, or signed out, the language picked on the sign-in page, else the browser's.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  pickDashboardLanguage,
  type DashboardLanguageType,
} from "@scheduleads-app/shared/pick-dashboard-language";

import type { DashboardWordsType } from "@/lib/dashboard-words/dashboard-words-type";
import { englishDashboardWords } from "@/lib/dashboard-words/english-dashboard-words";
import {
  readSignInLanguagePick,
  subscribeToSignInLanguagePick,
} from "@/lib/dashboard-words/sign-in-language-pick";
import { spanishDashboardWords } from "@/lib/dashboard-words/spanish-dashboard-words";

const dashboardWordsOf: Record<DashboardLanguageType, DashboardWordsType> = {
  en: englishDashboardWords,
  es: spanishDashboardWords,
};

type DashboardWordsContextType = {
  language: DashboardLanguageType;
  words: DashboardWordsType;
  signedIn: boolean; // whether the switch saves to the login or to this browser
  showLoginLanguage: (saved: DashboardLanguageType | null) => void; // signed in: its own pick
  forgetLoginLanguage: () => void; // signed out
};

const DashboardWordsContext = createContext<DashboardWordsContextType | null>(null);

export function useDashboardWords(): DashboardWordsContextType {
  const context = useContext(DashboardWordsContext);
  if (!context) throw new Error("useDashboardWords ran outside DashboardWordsProvider.");
  return context;
}

// Nothing to subscribe to: the browser's language is read once, after the server's English.
const subscribeToNothing = () => () => {};
const readBrowserLanguage = () => navigator.languages[0] ?? navigator.language;

export function DashboardWordsProvider({ children }: { children: ReactNode }) {
  // undefined: not signed in (or not known yet); null: signed in, never picked.
  const [loginLanguage, setLoginLanguage] = useState<DashboardLanguageType | null | undefined>();
  const browserLanguage = useSyncExternalStore(subscribeToNothing, readBrowserLanguage, () => "");
  const signInPick = useSyncExternalStore(
    subscribeToSignInLanguagePick,
    readSignInLanguagePick,
    () => null
  );

  const showLoginLanguage = useCallback(
    (saved: DashboardLanguageType | null) => setLoginLanguage(saved),
    []
  );
  const forgetLoginLanguage = useCallback(() => setLoginLanguage(undefined), []);

  const value = useMemo(() => {
    const browserLanguages = [signInPick ?? browserLanguage].filter((tag) => tag !== "");
    const language = pickDashboardLanguage(loginLanguage ?? null, browserLanguages);
    return {
      language,
      words: dashboardWordsOf[language],
      signedIn: loginLanguage !== undefined,
      showLoginLanguage,
      forgetLoginLanguage,
    };
  }, [loginLanguage, browserLanguage, signInPick, showLoginLanguage, forgetLoginLanguage]);

  return <DashboardWordsContext.Provider value={value}>{children}</DashboardWordsContext.Provider>;
}
