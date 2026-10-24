// Frontend component: sign-in's second step, the code sent to that email.

"use client";

import { dashboardFormResolver } from "@/lib/dashboard-form-resolver";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { OTP_LENGTH, signInCodeValidationSchema } from "@scheduleads-app/shared/zod-validation";

import { CentredCard } from "@/components/centred-card/centred-card";
import { CentredCardField } from "@/components/centred-card/centred-card-field";
import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { LanguageSwitch } from "@/components/language-switch/language-switch";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function SignInCodeStep({
  email,
  onDifferentEmail,
}: {
  email: string;
  onDifferentEmail: () => void;
}) {
  const router = useRouter();
  const { words } = useDashboardWords();
  const [refusal, setRefusal] = useState<string | null>(null);
  const form = useForm({
    resolver: dashboardFormResolver(signInCodeValidationSchema),
    defaultValues: { code: "" },
  });

  async function submitSignInCode({ code }: { code: string }) {
    setRefusal(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp: code });

    if (error) {
      // The page's own words, never Better Auth's English "Invalid OTP". A wrong code and an
      // unknown account get the same answer on purpose; don't guess which.
      setRefusal(
        error.status === 429
          ? words.tooManyTries
          : error.code === "OTP_EXPIRED"
            ? words.codeExpired
            : error.code === "TOO_MANY_ATTEMPTS"
              ? words.codeTriedTooOften
              : words.codeNotRight
      );
      return;
    }

    // The home page reads /me and decides where the user goes from there.
    router.push("/");
    router.refresh();
  }

  return (
    <CentredCard
      title={words.checkYourEmail}
      lede={
        <>
          {words.codeOnItsWay(OTP_LENGTH)}{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </>
      }
      footer={
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={onDifferentEmail}
          >
            {words.useADifferentEmail}
          </button>
          <LanguageSwitch />
        </div>
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
              label={words.loginCodeLabel}
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
          {form.formState.isSubmitting ? words.checking : words.signIn}
        </Button>
      </form>
    </CentredCard>
  );
}
