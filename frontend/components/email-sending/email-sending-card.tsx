// Frontend: the dashboard home's "Email sending" card. The owner sets where the business's
// emails come from, where its booking notifications go, and pastes the key of its own Resend
// account (feature 6, decisions 6 and 9). The key is never shown again: the card only says when
// one was saved, and saving with a key sends a test email first.

"use client";

import { dashboardFormResolver } from "@/lib/dashboard-form-resolver";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  emailSendingValidationSchema,
  type EmailSendingInputType,
} from "@scheduleads-app/shared/zod-validation";

import { CentredCardField } from "@/components/centred-card/centred-card-field";
import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { Button } from "@/components/ui/button";
import {
  fetchEmailSending,
  type EmailSendingResultType,
  type EmailSendingStateType,
} from "@/lib/api-client/email-sending/fetch-email-sending";
import { saveEmailSending } from "@/lib/api-client/email-sending/save-email-sending";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import type { SetupCardsWordsType } from "@/lib/dashboard-words/setup-cards-words";

const emailSendingFields = [
  { name: "senderEmail", label: "senderLabel", placeholder: "senderPlaceholder", type: "email" },
  { name: "notifyEmail", label: "notifyLabel", placeholder: "notifyPlaceholder", type: "email" },
  { name: "key", label: "keyLabel", placeholder: "keyPlaceholder", type: "password" },
] as const;

// "Key saved Oct 2", in the dashboard's language for the date.
const formatSavedOn = (iso: string, intlLocale: string) =>
  new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric" }).format(new Date(iso));

function emailSendingStatusWords(
  state: EmailSendingStateType,
  words: SetupCardsWordsType,
  intlLocale: string
): string {
  if (!state.senderEmail) return words.notSetUp;
  if (!state.keySavedAt) return words.sendingOnceKeySaved(state.senderEmail);
  return words.sendingFrom(state.senderEmail, formatSavedOn(state.keySavedAt, intlLocale));
}

export function EmailSendingCard() {
  const { words } = useDashboardWords();
  const cardWords = words.setupCardsWords;
  const [result, setResult] = useState<EmailSendingResultType | null>(null);

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;
    fetchEmailSending().then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-md)]">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {cardWords.emailSending}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{cardWords.emailSendingLede}</p>
      <div className="mt-6">
        {!result ? (
          <p className="text-sm text-muted-foreground">{cardWords.loading}</p>
        ) : result.state === "unreachable" ? (
          <CentredCardNotice>{result.message}</CentredCardNotice>
        ) : (
          <EmailSendingForm initial={result.answer} />
        )}
      </div>
    </section>
  );
}

function EmailSendingForm({ initial }: { initial: EmailSendingStateType }) {
  const { words } = useDashboardWords();
  const cardWords = words.setupCardsWords;
  const [state, setState] = useState(initial);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const form = useForm<EmailSendingInputType>({
    resolver: dashboardFormResolver(emailSendingValidationSchema),
    defaultValues: {
      senderEmail: initial.senderEmail ?? "",
      notifyEmail: initial.notifyEmail ?? "",
      key: "",
    },
  });

  async function saveEmailSendingSettings(input: EmailSendingInputType) {
    setNotice(null);
    const saved = await saveEmailSending(input);
    if (saved.state === "ok") {
      setState(saved.answer);
      form.reset({ ...input, key: "" }); // the key never stays on screen
      setNotice({
        tone: "info",
        text: saved.answer.keySavedAt
          ? cardWords.savedTestSent(saved.answer.notifyEmail ?? "")
          : cardWords.savedPasteAKey,
      });
      return;
    }
    if (saved.state === "field") {
      form.setError(saved.field, { message: saved.message }, { shouldFocus: true });
      return;
    }
    setNotice({ tone: "error", text: saved.message });
  }

  return (
    <form
      onSubmit={form.handleSubmit(saveEmailSendingSettings)}
      noValidate
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-foreground">
        {emailSendingStatusWords(state, cardWords, words.intlLocale)}
      </p>
      {emailSendingFields.map((field) => (
        <Controller
          key={field.name}
          name={field.name}
          control={form.control}
          render={({ field: input, fieldState }) => (
            <CentredCardField
              {...input}
              value={input.value ?? ""}
              id={`email-sending-${field.name}`}
              label={cardWords[field.label]}
              type={field.type}
              placeholder={cardWords[field.placeholder]}
              autoComplete={field.type === "password" ? "new-password" : "email"}
              error={fieldState.error?.message}
            />
          )}
        />
      ))}
      {notice ? <CentredCardNotice tone={notice.tone}>{notice.text}</CentredCardNotice> : null}
      <div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? cardWords.savingAndTesting : cardWords.save}
        </Button>
      </div>
    </form>
  );
}
