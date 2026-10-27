// Frontend component: a service's price on its card (feature 25d), typed as it is read, "150" or
// "12.50", and kept in hundredths; "Starts from" when it can cost more. Without the business's
// currency it is closed, with the reason, as no price could be shown.

"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

// "150" is 15000, "12.5" is 1250; empty is no price; anything else is NaN, which the schema refuses.
export function centsOf(typed: string): number | null {
  const text = typed.trim().replace(",", ".");
  if (text === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return Number.NaN;
  return Math.round(Number(text) * 100);
}

const typedOf = (cents: number | null) =>
  cents === null || Number.isNaN(cents) ? "" : (cents / 100).toFixed(cents % 100 ? 2 : 0);

export function ServicePriceField({
  idBase,
  currency,
  cents,
  from,
  onCents,
  onFrom,
  priceError,
  fromError,
  disabled,
}: {
  idBase: string;
  currency: string | null; // the business's; null closes the field
  cents: number | null;
  from: boolean;
  onCents: (cents: number | null) => void;
  onFrom: (from: boolean) => void;
  priceError?: string;
  fromError?: string;
  disabled: boolean;
}) {
  const { servicesWords } = useDashboardWords().words;
  const [typed, setTyped] = useState(() => typedOf(cents));
  const id = `${idBase}-price`;
  const closed = disabled || currency === null;
  const describedBy = priceError ? `${id}-error` : `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{servicesWords.priceOptional}</Label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input
            id={id}
            inputMode="decimal"
            value={typed}
            disabled={closed}
            onChange={(event) => {
              setTyped(event.target.value);
              const next = centsOf(event.target.value);
              onCents(next);
              if (next === null) onFrom(false); // no amount, nothing to start from
            }}
            aria-invalid={priceError ? true : undefined}
            aria-describedby={describedBy}
            className="h-10 w-32 bg-muted px-3"
          />
          {currency ? <span className="text-sm text-muted-foreground">{currency}</span> : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={from}
            disabled={closed || cents === null}
            onChange={(event) => onFrom(event.target.checked)}
            aria-invalid={fromError ? true : undefined}
            className="size-4 accent-[var(--primary)]"
          />
          {servicesWords.startsFrom}
        </label>
      </div>
      {priceError || fromError ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {priceError ?? fromError}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {currency === null ? servicesWords.priceNeedsCurrency : servicesWords.priceHint}
        </p>
      )}
    </div>
  );
}
