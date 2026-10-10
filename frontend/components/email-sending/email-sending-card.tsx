// Frontend: the dashboard home's "Email sending" card. The owner sets where the business's
// emails come from, where its booking notifications go, and pastes the key of its own Resend
// account (feature 6, decisions 6 and 9). The key is never shown again: the card only says when
// one was saved, and saving with a key sends a test email first.

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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

const emailSendingFields = [
  {
    name: "senderEmail",
    label: "Emails come from",
    placeholder: "bookings@yourbusiness.com",
    type: "email",
  },
  {
    name: "notifyEmail",
    label: "Booking notifications go to",
    placeholder: "you@yourbusiness.com",
    type: "email",
  },
  {
    name: "key",
    label: "Resend key (send-only)",
    placeholder: "Paste a new key, or leave empty to keep the saved one",
    type: "password",
  },
] as const;

// "Key saved Oct 2", in the reader's own words for the date.
const formatSavedOn = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));

function emailSendingStatusWords(state: EmailSendingStateType): string {
  if (!state.senderEmail) return "Not set up. Booking emails are not sent yet.";
  if (!state.keySavedAt) return `Sending from ${state.senderEmail} once a key is saved.`;
  return `Sending from ${state.senderEmail}. Key saved ${formatSavedOn(state.keySavedAt)}.`;
}

export function EmailSendingCard() {
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
      <h2 className="text-base font-semibold tracking-tight text-foreground">Email sending</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Booking emails go out from your own address, through your own Resend account. Nobody can
        read the key once it is saved.
      </p>
      <div className="mt-6">
        {!result ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
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
  const [state, setState] = useState(initial);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const form = useForm<EmailSendingInputType>({
    resolver: zodResolver(emailSendingValidationSchema),
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
          ? `Saved. A test email went to ${saved.answer.notifyEmail}.`
          : "Saved. Paste a key to start sending.",
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
      <p className="text-sm text-foreground">{emailSendingStatusWords(state)}</p>
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
              label={field.label}
              type={field.type}
              placeholder={field.placeholder}
              autoComplete={field.type === "password" ? "new-password" : "email"}
              error={fieldState.error?.message}
            />
          )}
        />
      ))}
      {notice ? <CentredCardNotice tone={notice.tone}>{notice.text}</CentredCardNotice> : null}
      <div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving and testing…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
