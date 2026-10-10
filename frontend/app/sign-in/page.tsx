// Frontend page /sign-in: email, then the 6-digit code sent to it. No passwords anywhere.
// Sign-in only: signup is closed, so only accounts the agency created can get in.

"use client";

import { useState } from "react";

import { SignInCodeStep } from "@/components/sign-in/sign-in-code-step";
import { SignInEmailStep } from "@/components/sign-in/sign-in-email-step";

export default function SignInPage() {
  // The address the code went to, once sent. Lowercased, the one Better Auth looks up.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState(""); // kept, so "Use a different email" starts from it

  if (sentTo) return <SignInCodeStep email={sentTo} onDifferentEmail={() => setSentTo(null)} />;
  return (
    <SignInEmailStep
      initialEmail={lastEmail}
      onSent={(email) => {
        setLastEmail(email);
        setSentTo(email);
      }}
    />
  );
}
