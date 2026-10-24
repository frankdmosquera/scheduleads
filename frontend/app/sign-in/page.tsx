// Frontend page /sign-in: email, then the 6-digit code sent to it. No passwords anywhere.
// Sign-in only: signup is closed, so only accounts the agency created can get in.

"use client";

import { useEffect, useState } from "react";

import { SignInCodeStep } from "@/components/sign-in/sign-in-code-step";
import { SignInEmailStep } from "@/components/sign-in/sign-in-email-step";
import { DashboardLanguageFrame } from "@/lib/dashboard-words/dashboard-language-frame";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export default function SignInPage() {
  // The address the code went to, once sent. Lowercased, the one Better Auth looks up.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState(""); // kept, so "Use a different email" starts from it

  // Reached from an ended sign-in without a reload too, so drop the last login's language here.
  const { forgetLoginLanguage } = useDashboardWords();
  useEffect(() => forgetLoginLanguage(), [forgetLoginLanguage]);

  return (
    <DashboardLanguageFrame>
      {sentTo ? (
        <SignInCodeStep email={sentTo} onDifferentEmail={() => setSentTo(null)} />
      ) : (
        <SignInEmailStep
          initialEmail={lastEmail}
          onSent={(email) => {
            setLastEmail(email);
            setSentTo(email);
          }}
        />
      )}
    </DashboardLanguageFrame>
  );
}
