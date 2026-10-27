// Frontend: the dashboard home's "Email sending" card (feature 25a). The owner may set where the
// business's emails come from and where its booking notices go; either left empty is picked for
// it. The card says which sender and notice address are in use right now.

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
] as const;

// What is in use right now, the same rule the emails use.
function emailSendingStatusWords(state: EmailSendingStateType, words: SetupCardsWordsType) {
  return [
    state.fromOwnDomain
      ? words.sendingFromOwnDomain(state.sendingFrom)
      : words.sendingFromAgencyDomain(state.sendingFrom),
    state.noticesTo ? words.noticesGoTo(state.noticesTo) : words.noticesGoNowhere,
  ];
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
    },
  });

  async function saveEmailSendingSettings(input: EmailSendingInputType) {
    setNotice(null);
    const saved = await saveEmailSending(input);
    if (saved.state === "ok") {
      setState(saved.answer);
      form.reset(input);
      setNotice({ tone: "info", text: cardWords.saved });
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
      {emailSendingStatusWords(state, cardWords).map((line) => (
        <p key={line} className="text-sm text-foreground">
          {line}
        </p>
      ))}
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
              autoComplete="email"
              error={fieldState.error?.message}
            />
          )}
        />
      ))}
      {notice ? <CentredCardNotice tone={notice.tone}>{notice.text}</CentredCardNotice> : null}
      <div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? cardWords.saving : cardWords.save}
        </Button>
      </div>
    </form>
  );
}
