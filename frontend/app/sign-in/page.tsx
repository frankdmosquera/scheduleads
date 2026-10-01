// Frontend page /sign-in: email, then the 6-digit code sent to it. No passwords anywhere.
// Sign-in only: signup is closed, so only accounts the agency created can get in.

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  OTP_LENGTH,
  signInCodeValidationSchema,
  signInEmailValidationSchema,
} from "@scheduleads-app/shared/zod-validation";

import { AuthCard, Field, Notice } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  // The address the code went to, once sent. Lowercased, the one Better Auth looks up.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState(""); // kept, so "Use a different email" starts from it

  if (sentTo) return <CodeStep email={sentTo} onDifferentEmail={() => setSentTo(null)} />;
  return (
    <EmailStep
      initialEmail={lastEmail}
      onSent={(email) => {
        setLastEmail(email);
        setSentTo(email);
      }}
    />
  );
}

function EmailStep({
  initialEmail,
  onSent,
}: {
  initialEmail: string;
  onSent: (email: string) => void;
}) {
  const [refusal, setRefusal] = useState<string | null>(null);
  // Checked here before sending; Better Auth checks the address again with its own rule.
  const form = useForm({
    resolver: zodResolver(signInEmailValidationSchema),
    defaultValues: { email: initialEmail },
  });

  async function requestCode({ email }: { email: string }) {
    setRefusal(null);
    // In development the code prints in the API's console; real email is feature 6.
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });

    if (error) {
      setRefusal(error.message ?? "That code could not be sent. Try again.");
      return;
    }

    // An unknown address also lands here and simply never gets a code. On purpose: saying
    // "no such account" would let anyone test who is a customer. Don't "fix" this.
    onSent(email);
  }

  return (
    <AuthCard
      title="Sign in"
      lede="Enter your email and we will send you a code. No password to remember."
    >
      <form onSubmit={form.handleSubmit(requestCode)} noValidate className="flex flex-col gap-4">
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field
              {...field}
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@yourbusiness.com"
              error={fieldState.error?.message}
            />
          )}
        />
        {refusal ? <Notice>{refusal}</Notice> : null}
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Sending…" : "Send me a code"}
        </Button>
      </form>
    </AuthCard>
  );
}

function CodeStep({ email, onDifferentEmail }: { email: string; onDifferentEmail: () => void }) {
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(signInCodeValidationSchema),
    defaultValues: { code: "" },
  });

  async function submitCode({ code }: { code: string }) {
    setRefusal(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp: code });

    if (error) {
      // A wrong code and an unknown account get the same answer on purpose; don't guess which.
      setRefusal(error.message ?? "That code is not right. Request a new one.");
      return;
    }

    // The home page reads /me and decides where the user goes from there.
    router.push("/");
    router.refresh();
  }

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
          onClick={onDifferentEmail}
        >
          Use a different email
        </button>
      }
    >
      <form onSubmit={form.handleSubmit(submitCode)} noValidate className="flex flex-col gap-4">
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field
              {...field}
              id="code"
              label="Login code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={OTP_LENGTH}
              placeholder={"0".repeat(OTP_LENGTH)}
              error={fieldState.error?.message}
              className="font-mono tracking-[0.3em]"
            />
          )}
        />
        {refusal ? <Notice>{refusal}</Notice> : null}
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Checking…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
