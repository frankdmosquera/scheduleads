// Frontend component: sign-in's second step, the code sent to that email.

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { OTP_LENGTH, signInCodeValidationSchema } from "@scheduleads-app/shared/zod-validation";

import { CentredCard } from "@/components/centred-card/centred-card";
import { CentredCardField } from "@/components/centred-card/centred-card-field";
import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignInCodeStep({
  email,
  onDifferentEmail,
}: {
  email: string;
  onDifferentEmail: () => void;
}) {
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(signInCodeValidationSchema),
    defaultValues: { code: "" },
  });

  async function submitSignInCode({ code }: { code: string }) {
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
    <CentredCard
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
      <form
        onSubmit={form.handleSubmit(submitSignInCode)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <CentredCardField
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
        {refusal ? <CentredCardNotice>{refusal}</CentredCardNotice> : null}
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Checking…" : "Sign in"}
        </Button>
      </form>
    </CentredCard>
  );
}
