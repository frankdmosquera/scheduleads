// Frontend component: how much notice the business needs, as a number and a unit, kept in minutes.

"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const UNITS = [
  { key: "minutes", label: "minutes", minutes: 1 },
  { key: "hours", label: "hours", minutes: 60 },
  { key: "days", label: "days", minutes: 1440 },
] as const;

type UnitType = (typeof UNITS)[number];

// The largest unit the saved notice fills exactly: 240 reads as 4 hours, 90 as 90 minutes.
function unitOf(minutes: number): UnitType {
  if (Number.isNaN(minutes) || minutes === 0) return UNITS[1];
  return [...UNITS].reverse().find((unit) => minutes % unit.minutes === 0) ?? UNITS[0];
}

export function NoticeField({
  id,
  minutes,
  onChange,
  error,
}: {
  id: string;
  minutes: number; // NaN while empty
  onChange: (minutes: number) => void;
  error?: string;
}) {
  const [unit, setUnit] = useState<UnitType>(() => unitOf(minutes));
  const amount = Number.isNaN(minutes) ? "" : minutes / unit.minutes;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Least notice you accept</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="number"
          min={0}
          value={amount}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? Number.NaN : Number(event.target.value) * unit.minutes
            )
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-10 min-w-0 flex-1 bg-muted px-3"
        />
        <select
          aria-label="Notice unit"
          value={unit.key}
          onChange={(event) => {
            const next = UNITS.find((one) => one.key === event.target.value) ?? UNITS[0];
            setUnit(next);
            // The number on screen stays; what it means changes with the unit.
            if (amount !== "") onChange(amount * next.minutes);
          }}
          className="h-10 rounded-lg border border-input bg-muted px-2 text-sm"
        >
          {UNITS.map((one) => (
            <option key={one.key} value={one.key}>
              {one.label}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
