// Frontend component: what the business's booking form requires, on the Booking form page (feature
// 12f): which way to reach the customer it must have, and whether it asks the customer's yes to
// later texts, which only a business with text settings can ask; and the business's language
// (feature 12i): its owner's emails, while customers get theirs in the language they booked in.

"use client";

import { useState } from "react";

import type { ContactRuleType } from "@scheduleads-app/shared/zod-validation";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { ChoiceField } from "@/components/settings/choice-field";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import type { BookingFormSettingsType } from "@/lib/api-client/settings/fetch-booking-form";
import { saveBookingFormRules } from "@/lib/api-client/settings/save-booking-form-rules";

export function BookingFormRulesCard({ settings }: { settings: BookingFormSettingsType }) {
  const { canEdit } = settings;
  const [contactRule, setContactRule] = useState<ContactRuleType>(settings.contactRule);
  const [askLaterTextsYes, setAskLaterTextsYes] = useState(settings.askLaterTextsYes); // null: no text settings
  const [language, setLanguage] = useState(settings.language);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    // The yes to later texts only when the page showed it, so a save never changes what was not seen.
    const saved = await saveBookingFormRules(
      askLaterTextsYes === null
        ? { contactRule, language }
        : { contactRule, askLaterTextsYes, language }
    );
    setSaving(false);
    if (saved.state === "ok") {
      setContactRule(saved.answer.contactRule);
      setAskLaterTextsYes(saved.answer.askLaterTextsYes);
      setLanguage(saved.answer.language);
      setNotice({ tone: "info", text: "Saved what the form requires and its language." });
      return;
    }
    setNotice({ tone: "error", text: saved.message });
  }

  return (
    <form
      noValidate
      onSubmit={save}
      aria-labelledby="rules-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h3 id="rules-title" className="text-base font-semibold tracking-tight text-foreground">
          What the form requires
        </h3>
        <p className="text-sm text-muted-foreground">
          Every booking needs a name. Whether each service asks the address is set on Services.
        </p>
      </div>
      {!canEdit ? (
        <CentredCardNotice tone="info">
          Your role cannot change the booking form. You can see it here.
        </CentredCardNotice>
      ) : null}

      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <ChoiceField
          name="contact-rule"
          legend="A customer must leave"
          choices={[
            { value: "either", label: "An email or a phone, either one" },
            { value: "email", label: "An email" },
            { value: "phone", label: "A phone" },
          ]}
          value={contactRule}
          onChange={(value) => {
            setNotice(null);
            setContactRule(value);
          }}
        />
        {askLaterTextsYes !== null ? (
          <ChoiceField
            name="later-texts-yes"
            legend="Ask the customer's yes to later texts (offers, reminders to book again)"
            choices={[
              { value: true, label: "Yes, show the box" },
              { value: false, label: "No" },
            ]}
            value={askLaterTextsYes}
            onChange={(value) => {
              setNotice(null);
              setAskLaterTextsYes(value);
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            The form can ask the customer&apos;s yes to later texts once texts are set up for this
            business.
          </p>
        )}
        <ChoiceField
          name="business-language"
          legend="Your booking emails come in"
          choices={[
            { value: "en", label: "English" },
            { value: "es", label: "Español" },
          ]}
          value={language}
          onChange={(value) => {
            setNotice(null);
            setLanguage(value);
          }}
        />
        <p className="-mt-2 text-sm text-muted-foreground">
          Customers get theirs in the language they booked in: a Spanish site&apos;s window books in
          Spanish.
        </p>
      </fieldset>

      <SaveNotice notice={notice} />
      {canEdit ? (
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
