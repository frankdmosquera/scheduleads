"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { emailSchema, loginCodeSchema, OTP_LENGTH } from "@scheduleads-app/shared/validation";

import { AuthCard, Field, Notice } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/**
 * Sign in, in two steps: the email, then the code that was sent to it.
 *
 * There is no password anywhere in this product. A business owner
 * checking leads between jobs does not want another password, and one
 * that is never stored cannot be leaked. Better Auth's emailOTP plugin
 * creates the account on first successful code, so this one screen is
 * both sign-in and sign-up; there is no separate registration page and
 * no "no account?" dead end.
 *
 * Outside production the code is printed to the API's console rather
 * than emailed. Real delivery is build-plan item 6.
 */

type Step = "email" | "code";

export default function SignInPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);
    setRefusal(null);

    // The same schema the API validates against, so the form cannot
    // accept something the server will then reject without explanation.
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    setBusy(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: parsed.data,
      type: "sign-in",
    });
    setBusy(false);

    if (error) {
      setRefusal(error.message ?? "That code could not be sent. Try again.");
      return;
    }

    // An address with no account reaches this line too, and that is not a
    // bug. Signup is disabled on the server, so better-auth answers an
    // unknown address with { success: true } and sends nothing; the screen
    // then says a code is on its way and no code ever arrives. Deliberate:
    // telling the visitor the account does not exist would turn this form
    // into a way to test whether any given address is a customer. Do not
    // "fix" it by branching on whether the account exists. The only
    // legitimate way in is the agency creating the account, which is
    // build-plan item 3b.
    //
    // Hold the normalised address, not what was typed. Better Auth
    // lowercases before looking the account up, so sending the raw
    // string on step two can fail a lookup that step one succeeded at.
    setEmail(parsed.data);
    setCode("");
    setStep("code");
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);
    setRefusal(null);

    const parsed = loginCodeSchema.safeParse(code);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter the code from your email.");
      return;
    }

    setBusy(true);
    const { error } = await authClient.signIn.emailOtp({
      email,
      otp: parsed.data,
    });
    setBusy(false);

    if (error) {
      // Better Auth answers a wrong code and an unknown account with the
      // same refusal on purpose, so this message must not speculate
      // about which it was.
      setRefusal(error.message ?? "That code is not right. Request a new one.");
      return;
    }

    // Where the session lands is the dashboard's decision, not this
    // screen's: it reads /me and sends the user on from there, including
    // to create-organization when they have no business yet.
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
