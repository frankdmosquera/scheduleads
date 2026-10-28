// Frontend component: the Services page's "Prices in" (feature 25d): the one currency every price
// of the business is in, from every currency the browser knows, named in the dashboard's language.
// Saved on pick. None picked: customers see no prices, and the prices stay saved.

"use client";

import { useId, useMemo, useState } from "react";

import { Label } from "@/components/ui/label";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { saveServicesCurrency } from "@/lib/api-client/settings/save-services-currency";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

const selectClass =
  "h-10 rounded-lg border border-input bg-muted px-3 text-sm aria-invalid:border-destructive disabled:opacity-60";

export function ServicesCurrencyPicker({
  currency,
  canEdit,
  onSaved,
}: {
  currency: string | null;
  canEdit: boolean;
  onSaved: (currency: string | null) => void;
}) {
  const { words, language } = useDashboardWords();
  const { servicesWords } = words;
  const id = useId();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  // "Canadian dollar (CAD)", sorted by name in the dashboard's language.
  const currencies = useMemo(() => {
    const names = new Intl.DisplayNames(language, { type: "currency" });
    return Intl.supportedValuesOf("currency")
      .map((code) => ({ code, name: `${names.of(code) ?? code} (${code})` }))
      .sort((a, b) => a.name.localeCompare(b.name, language));
  }, [language]);

  const pick = async (picked: string) => {
    setSaving(true);
    setNotice(null);
    const saved = await saveServicesCurrency(picked || null);
    setSaving(false);
    if (saved.state !== "ok") {
      setNotice({ tone: "error", text: saved.message });
      return;
    }
    onSaved(saved.answer.currency);
    setNotice({
      tone: "info",
      text: saved.answer.currency
        ? servicesWords.currencySaved(saved.answer.currency)
        : servicesWords.currencyOff,
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{servicesWords.pricesIn}</Label>
      <select
        id={id}
        value={currency ?? ""}
        disabled={!canEdit || saving}
        onChange={(event) => void pick(event.target.value)}
        className={`${selectClass} max-w-sm`}
      >
        <option value="">{servicesWords.pickACurrency}</option>
        {currencies.map(({ code, name }) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      {currency ? null : (
        <p className="text-xs text-muted-foreground">{servicesWords.noCurrencyYet}</p>
      )}
      <SaveNotice notice={notice} />
    </div>
  );
}
