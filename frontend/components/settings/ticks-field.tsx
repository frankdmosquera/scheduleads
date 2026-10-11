// Frontend component: one list of ticks on a service's form (feature 12d): the people who do it, or
// the places it needs. A turned-off one can stay ticked, shown as off; it is never offered.

"use client";

import Link from "next/link";

import type { ServicesSettingsType } from "@/lib/api-client/settings/fetch-services-settings";

type TickableType = ServicesSettingsType["people"][number];

export function TicksField({
  name,
  legend,
  noneTicked,
  allTickedOff,
  noneToTick,
  choices,
  value,
  onChange,
  error,
}: {
  name: string;
  legend: string;
  noneTicked: string; // what nobody ticked means
  allTickedOff: string; // what it means when every one ticked is off
  noneToTick: string;
  choices: TickableType[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const ticked = choices.filter((choice) => value.includes(choice.id));
  const hint = !ticked.length
    ? noneTicked
    : ticked.every((choice) => !choice.active)
      ? allTickedOff
      : null;
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...value, id] : value.filter((tickedId) => tickedId !== id));

  return (
    <div
      role="group"
      aria-labelledby={`${name}-legend`}
      aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
      className="flex flex-col gap-2"
    >
      <p id={`${name}-legend`} className="text-sm font-medium text-foreground">
        {legend}
      </p>
      {choices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {noneToTick}{" "}
          <Link href="/settings/people" className="text-primary underline underline-offset-2">
            Add them on People
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {choices.map((choice, index) => (
            <label key={choice.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.includes(choice.id)}
                onChange={(event) => toggle(choice.id, event.target.checked)}
                // The first box carries a refused save, so the focus lands in the list.
                aria-invalid={error && index === 0 ? true : undefined}
                className="size-4 accent-[var(--primary)]"
              />
              <span className={choice.active ? undefined : "text-muted-foreground"}>
                {choice.name}
                {choice.active ? null : " (off)"}
              </span>
            </label>
          ))}
        </div>
      )}
      {error ? (
        <p id={`${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint && choices.length ? (
        <p
          id={`${name}-hint`}
          className={ticked.length ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
