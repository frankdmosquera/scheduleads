// Frontend component: English | Español (feature 12j). Signed in, it saves the login's own pick
// and the screen changes once saved; signed out, on the sign-in page, it is kept in this browser.

"use client";

import { useState } from "react";

import type { DashboardLanguageType } from "@scheduleads-app/shared/pick-dashboard-language";

import { saveMyLanguage } from "@/lib/api-client/dashboard/save-my-language";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import { saveSignInLanguagePick } from "@/lib/dashboard-words/sign-in-language-pick";

// Each language named in its own words, so either reader finds theirs.
const CHOICES: { language: DashboardLanguageType; name: string }[] = [
  { language: "en", name: "English" },
  { language: "es", name: "Español" },
];

export function LanguageSwitch() {
  const { language, words, signedIn, showLoginLanguage } = useDashboardWords();
  const [saving, setSaving] = useState(false);
  const [notSaved, setNotSaved] = useState(false);

  async function pick(next: DashboardLanguageType) {
    setNotSaved(false);
    if (!signedIn) return saveSignInLanguagePick(next);

    setSaving(true);
    const saved = await saveMyLanguage(next);
    setSaving(false);
    if (saved) showLoginLanguage(next);
    else setNotSaved(true);
  }

  return (
    <div>
      <div role="group" aria-label={words.languageSwitchLabel} className="flex gap-1">
        {CHOICES.map((choice) => (
          <button
            key={choice.language}
            type="button"
            lang={choice.language}
            aria-pressed={choice.language === language}
            disabled={saving}
            onClick={() => void pick(choice.language)}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground"
          >
            {choice.name}
          </button>
        ))}
      </div>
      {notSaved ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {words.languageNotSaved}
        </p>
      ) : null}
    </div>
  );
}
