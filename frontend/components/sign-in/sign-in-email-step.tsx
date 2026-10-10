// Frontend component: sign-in's first step, the email the code goes to.

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { signInEmailValidationSchema } from "@scheduleads-app/shared/zod-validation";

import { CentredCard } from "@/components/centred-card/centred-card";
import { CentredCardField } from "@/components/centred-card/centred-card-field";
import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignInEmailStep({
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

  async function requestSignInCode({ email }: { email: string }) {
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
    <CentredCard
      title="Sign in"
      lede="Enter your email and we will send you a code. No password to remember."
    >
      <form
        onSubmit={form.handleSubmit(requestSignInCode)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <CentredCardField
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
        {refusal ? <CentredCardNotice>{refusal}</CentredCardNotice> : null}
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Sending…" : "Send me a code"}
        </Button>
      </form>
    </CentredCard>
  );
}
