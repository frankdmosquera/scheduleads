// Frontend component: one person's worker texts on the People page (feature 12g): off, or on with
// the phone they are texted on and whether they hear when a booking is added to their day, moved,
// or taken off it. None of the three is picked until the owner picks it.

"use client";

import { useRef, useState } from "react";

import { ChoiceField } from "@/components/settings/choice-field";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PeopleSettingsType } from "@/lib/api-client/settings/fetch-people-settings";
import { saveWorkerTexts } from "@/lib/api-client/settings/save-worker-texts";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

export type WorkerTextsType = Omit<PeopleSettingsType["workerTexts"][number], "personId">;
type SwitchType = "addedOn" | "movedOn" | "removedOn";

const SWITCHES: { name: SwitchType; legend: string }[] = [
  { name: "addedOn", legend: "A booking is added to their day" },
  { name: "movedOn", legend: "Their booking moves to a new time" },
  { name: "removedOn", legend: "A booking is taken off their day" },
];

export function PersonTextsForm({
  personId,
  personName,
  texts,
  onSaved,
}: {
  personId: string;
  personName: string;
  texts: WorkerTextsType | null; // null: no texts
  onSaved: (texts: WorkerTextsType | null) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [on, setOn] = useState(texts !== null);
  const [phone, setPhone] = useState(texts?.phone ?? "");
  const [choices, setChoices] = useState<Partial<Record<SwitchType, boolean>>>(
    texts ? { addedOn: texts.addedOn, movedOn: texts.movedOn, removedOn: texts.removedOn } : {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const [saving, setSaving] = useState(false);
  const idBase = `person-texts-${personId}`;

  const edited = () => {
    setNotice(null);
    setErrors({});
  };

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const saved = await saveWorkerTexts(personId, {
      // Unpicked choices are sent as they are: the API names the first one left to pick.
      texts: on ? ({ phone, ...choices } as WorkerTextsType) : null,
    });
    setSaving(false);
    if (saved.state === "ok") {
      onSaved(saved.answer.texts);
      setNotice({
        tone: "info",
        text: saved.answer.texts ? `Saved. ${personName} gets texts.` : `Saved. Texts off.`,
      });
      return;
    }
    if (saved.state === "field") {
      setErrors({ [saved.field.replace(/^texts\./, "")]: saved.message });
      focusFirstInvalid();
      return;
    }
    setNotice({ tone: "error", text: saved.message });
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={save}
      aria-labelledby={`${idBase}-title`}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <h4 id={`${idBase}-title`} className="text-sm font-semibold text-foreground">
        Texts to {personName} about their day
      </h4>
      <ChoiceField
        name={`${idBase}-on`}
        legend="Texts"
        choices={[
          { value: false, label: "Off" },
          { value: true, label: "On" },
        ]}
        value={on}
        onChange={(value) => {
          edited();
          setOn(value);
        }}
      />
      {on ? (
        <>
          <div className="flex flex-col gap-1.5 sm:max-w-sm">
            <Label htmlFor={`${idBase}-phone`}>Their phone</Label>
            <Input
              id={`${idBase}-phone`}
              type="tel"
              value={phone}
              onChange={(event) => {
                edited();
                setPhone(event.target.value);
              }}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? `${idBase}-phone-error` : undefined}
              className="h-10 bg-muted px-3"
            />
            {errors.phone ? (
              <p id={`${idBase}-phone-error`} className="text-xs text-destructive">
                {errors.phone}
              </p>
            ) : null}
          </div>
          {SWITCHES.map(({ name, legend }) => (
            <ChoiceField
              key={name}
              name={`${idBase}-${name}`}
              legend={legend}
              choices={[
                { value: true, label: "Text them" },
                { value: false, label: "No" },
              ]}
              value={choices[name]}
              onChange={(value) => {
                edited();
                setChoices({ ...choices, [name]: value });
              }}
              error={errors[name]}
            />
          ))}
        </>
      ) : null}
      <SaveNotice notice={notice} />
      <div>
        <Button type="submit" variant="outline" disabled={saving}>
          {saving ? "Saving…" : "Save texts"}
        </Button>
      </div>
    </form>
  );
}
