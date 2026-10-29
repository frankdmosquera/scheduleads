// Frontend component: the Look page's colours (feature 25e): the main colour, the background and the
// text, each picked or left as the window's own, with the business's own website looks first
// (feature 25f) and ready palettes, each filling all three. A sample
// button shows them together; Save sends all three, and text too faint on its background comes
// back refused, under the field. A login that may not change the business only sees them.

"use client";

import { useId, useState } from "react";

import type { BusinessColoursType, BusinessLookType } from "@scheduleads-app/shared/zod-validation";
import { textColorOn } from "@scheduleads-app/shared/text-color-on";

import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { useSetMainColour } from "@/components/dashboard/dashboard-gate";
import { Button } from "@/components/ui/button";
import { saveBusinessColours } from "@/lib/api-client/settings/save-business-colours";
import { COLOUR_PALETTES } from "@/lib/colour-palettes";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

type ColourKeyType = keyof BusinessColoursType;
const WINDOWS_OWN: Record<ColourKeyType, string> = {
  main: "#18181b",
  background: "#ffffff",
  text: "#18181b",
};

// The look whose three colours these are, if any.
const lookOf = (looks: BusinessLookType[], colours: BusinessColoursType) =>
  looks.find(
    (look) =>
      look.main === colours.main &&
      look.background === colours.background &&
      look.text === colours.text
  );

export function ColoursCard({
  colours,
  coloursOn,
  looks,
  canEdit,
}: {
  colours: BusinessColoursType;
  coloursOn: boolean; // false: saved nowhere yet, so not worn
  looks: BusinessLookType[]; // its website's own (feature 25f), offered first
  canEdit: boolean;
}) {
  const { lookWords, settingsFrameWords } = useDashboardWords().words;
  const setMainColour = useSetMainColour();
  const id = useId();
  const [picked, setPicked] = useState(colours);
  const pickedLook = lookOf(looks, picked); // a field changed by hand leaves the look
  const [worn, setWorn] = useState(coloursOn);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const [textError, setTextError] = useState<string | null>(null);

  const pick = (key: ColourKeyType, value: string | null) => {
    setNotice(null);
    setTextError(null);
    setPicked((now) => ({ ...now, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    setTextError(null);
    const saved = await saveBusinessColours({ ...picked, look: pickedLook?.name ?? null });
    setSaving(false);
    if (saved.state === "field") {
      setTextError(saved.message);
      return;
    }
    if (saved.state !== "ok") {
      setNotice({ tone: "error", text: saved.message });
      return;
    }
    setPicked(saved.answer);
    setWorn(!!(saved.answer.main || saved.answer.background || saved.answer.text));
    setMainColour(saved.answer.main);
    setNotice({ tone: "info", text: lookWords.coloursSaved });
  };

  const field = (key: ColourKeyType, label: string, hint?: string) => {
    const value = picked[key];
    const inputId = `${id}-${key}`;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={inputId}
            type="color"
            value={value ?? WINDOWS_OWN[key]}
            disabled={!canEdit || saving}
            onChange={(event) => pick(key, event.target.value)}
            aria-invalid={key === "text" && textError ? true : undefined}
            aria-describedby={key === "text" && textError ? `${id}-text-error` : undefined}
            className="h-10 w-14 cursor-pointer rounded-md border border-input bg-muted p-1 disabled:opacity-60"
          />
          <span className="font-mono text-xs text-muted-foreground">
            {value ?? lookWords.windowsOwn}
          </span>
          {canEdit && value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={lookWords.resetColour(label)}
              title={lookWords.useWindowsOwn(label)}
              onClick={() => pick(key, null)}
            >
              {lookWords.reset}
            </Button>
          ) : null}
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        {key === "text" && textError ? (
          <p id={`${id}-text-error`} className="text-xs text-destructive">
            {textError}
          </p>
        ) : null}
      </div>
    );
  };

  const main = picked.main ?? WINDOWS_OWN.main;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">{lookWords.colours}</h3>
        <p className="text-xs text-muted-foreground">{lookWords.coloursHint}</p>
        {worn ? null : <p className="mt-1 text-xs text-muted-foreground">{lookWords.notWornYet}</p>}
      </div>

      {canEdit && looks.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">{lookWords.yourLooks}</span>
          <div className="flex flex-wrap gap-2">
            {looks.map((look) => (
              <button
                key={look.name}
                type="button"
                aria-pressed={pickedLook?.name === look.name}
                onClick={() => {
                  setNotice(null);
                  setTextError(null);
                  setPicked({ main: look.main, background: look.background, text: look.text });
                }}
                className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-muted aria-pressed:border-primary aria-pressed:bg-[var(--accent-soft)]"
              >
                <span
                  className="size-5 rounded-full border border-border"
                  style={{ background: look.main }}
                  aria-hidden="true"
                />
                {look.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">{lookWords.palettes}</span>
          <div className="flex flex-wrap gap-2">
            {COLOUR_PALETTES.map(({ id: paletteId, ...palette }) => (
              <button
                key={paletteId}
                type="button"
                aria-pressed={
                  picked.main === palette.main &&
                  picked.background === palette.background &&
                  picked.text === palette.text
                }
                onClick={() => {
                  setNotice(null);
                  setTextError(null);
                  setPicked(palette);
                }}
                className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted aria-pressed:border-primary aria-pressed:bg-[var(--accent-soft)]"
              >
                <span className="flex" aria-hidden="true">
                  {[palette.main, palette.background, palette.text].map((colour) => (
                    <span
                      key={colour}
                      className="-ml-1 size-4 rounded-full border border-border first:ml-0"
                      style={{ background: colour }}
                    />
                  ))}
                </span>
                {lookWords.paletteNames[paletteId]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {field("main", lookWords.main, lookWords.mainHint)}
        {field("background", lookWords.background)}
        {field("text", lookWords.text)}
      </div>

      <div
        className="flex items-center gap-3 rounded-lg border border-border p-4"
        style={{
          background: picked.background ?? WINDOWS_OWN.background,
          color: picked.text ?? WINDOWS_OWN.text,
        }}
        aria-hidden="true"
      >
        <span className="text-sm">Aa</span>
        <span
          className="rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ background: main, color: pickedLook?.ink ?? textColorOn(main) }}
        >
          {lookWords.sample}
        </span>
      </div>

      {canEdit ? (
        <div>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? settingsFrameWords.saving : lookWords.saveColours}
          </Button>
        </div>
      ) : null}
      <SaveNotice notice={notice} />
    </div>
  );
}
