// Frontend page /sign-in: email, then the 6-digit code sent to it. No passwords anywhere.
// Sign-in only: signup is closed, so only accounts the agency created can get in.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  OTP_LENGTH,
  signInCodeValidationSchema,
  signInEmailValidationSchema,
} from "@scheduleads-app/shared/zod-validation";

import { AuthCard, Field, Notice } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export type StepType = "email" | "code";

export default function SignInPage() {
  const router = useRouter();

  const [step, setStep] = useState<StepType>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);
    setRefusal(null);

    // Same rules as the API, so the form never accepts what the server would reject.
    const parsed = signInEmailValidationSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    setBusy(true);
    // In development the code prints in the API's console; real email is item 6.
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: parsed.data.email,
      type: "sign-in",
    });
    setBusy(false);

    if (error) {
      setRefusal(error.message ?? "That code could not be sent. Try again.");
      return;
    }

    // An unknown address also lands here and simply never gets a code. On purpose: saying
    // "no such account" would let anyone test who is a customer. Don't "fix" this.
    setEmail(parsed.data.email); // keep the lowercased address, the one Better Auth looks up
    setCode("");
    setStep("code");
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);
    setRefusal(null);

    const parsed = signInCodeValidationSchema.safeParse({ code });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter the code from your email.");
      return;
    }

    setBusy(true);
    const { error } = await authClient.signIn.emailOtp({
      email,
      otp: parsed.data.code,
    });
    setBusy(false);

    if (error) {
      // A wrong code and an unknown account get the same answer on purpose; don't guess which.
      setRefusal(error.message ?? "That code is not right. Request a new one.");
      return;
    }

    // The home page reads /me and decides where the user goes from there.
    router.push("/");
    router.refresh();
  }

  if (step === "code") {
    return (
      <AuthCard
        title="Check your email"
        lede={
          <>
            A {OTP_LENGTH} digit code is on its way to{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </>
        }
        footer={
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => {
              setStep("email");
              setFieldError(null);
              setRefusal(null);
            }}
          >
            Use a different email
          </button>
        }
      >
        <form onSubmit={submitCode} className="flex flex-col gap-4">
          <Field
            id="code"
            label="Login code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={OTP_LENGTH}
            placeholder={"0".repeat(OTP_LENGTH)}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            error={fieldError ?? undefined}
            className="font-mono tracking-[0.3em]"
          />
          {refusal ? <Notice>{refusal}</Notice> : null}
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Checking…" : "Sign in"}
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Sign in"
      lede="Enter your email and we will send you a code. No password to remember."
    >
      <form onSubmit={requestCode} className="flex flex-col gap-4">
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@yourbusiness.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError ?? undefined}
        />
        {refusal ? <Notice>{refusal}</Notice> : null}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Sending…" : "Send me a code"}
        </Button>
      </form>
    </AuthCard>
  );
}
