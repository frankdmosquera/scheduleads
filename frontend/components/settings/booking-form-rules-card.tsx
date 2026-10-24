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
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function BookingFormRulesCard({ settings }: { settings: BookingFormSettingsType }) {
  const { canEdit } = settings;
  const { words } = useDashboardWords();
  const formWords = words.bookingFormWords;
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
      setNotice({ tone: "info", text: formWords.rulesSaved });
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
          {formWords.rulesTitle}
        </h3>
        <p className="text-sm text-muted-foreground">{formWords.rulesLede}</p>
      </div>
      {!canEdit ? (
        <CentredCardNotice tone="info">{formWords.cannotChange}</CentredCardNotice>
      ) : null}

      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <ChoiceField
          name="contact-rule"
          legend={formWords.customerMustLeave}
          choices={[
            { value: "either", label: formWords.emailOrPhone },
            { value: "email", label: formWords.anEmail },
            { value: "phone", label: formWords.aPhone },
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
            legend={formWords.askLaterTextsYes}
            choices={[
              { value: true, label: formWords.yesShowTheBox },
              { value: false, label: formWords.no },
            ]}
            value={askLaterTextsYes}
            onChange={(value) => {
              setNotice(null);
              setAskLaterTextsYes(value);
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{formWords.laterTextsOnceSetUp}</p>
        )}
        <ChoiceField
          name="business-language"
          legend={formWords.emailsComeIn}
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
        <p className="-mt-2 text-sm text-muted-foreground">{formWords.customersGetTheirs}</p>
      </fieldset>

      <SaveNotice notice={notice} />
      {canEdit ? (
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? words.settingsFrameWords.saving : words.settingsFrameWords.save}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
