// Frontend component: one person's worker texts, a part of their card on the People page (feature
// 12g): off, or on with the phone they are texted on and whether they hear when a booking is added
// to their day, moved, or taken off it. None of the three is picked until the owner picks it. The
// card's one Save calls `save()` before saving the person, so typed texts are never left behind.

"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { ChoiceField } from "@/components/settings/choice-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PeopleSettingsType } from "@/lib/api-client/settings/fetch-people-settings";
import { saveWorkerTexts } from "@/lib/api-client/settings/save-worker-texts";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export type WorkerTextsType = Omit<PeopleSettingsType["workerTexts"][number], "personId">;
type SwitchType = "addedOn" | "movedOn" | "removedOn";

// Each choice with the word its question reads from.
const SWITCHES: {
  name: SwitchType;
  legend: "addedToTheirDay" | "theirBookingMoves" | "takenOffTheirDay";
}[] = [
  { name: "addedOn", legend: "addedToTheirDay" },
  { name: "movedOn", legend: "theirBookingMoves" },
  { name: "removedOn", legend: "takenOffTheirDay" },
];

// True when a person with these texts can be texted at all: the business has a texting number and
// at least one choice is yes.
export const textsCanGo = (texts: WorkerTextsType | null | undefined, textsSetUp: boolean) =>
  textsSetUp && !!texts && (texts.addedOn || texts.movedOn || texts.removedOn);

export type PersonTextsPartHandleType = {
  save: () => Promise<boolean>; // true when saved, or nothing changed; false when refused
};

export const PersonTextsPart = forwardRef<
  PersonTextsPartHandleType,
  {
    personId: string;
    personName: string;
    texts: WorkerTextsType | null; // null: no texts
    textsSetUp: boolean; // the business has a texting number
    onSaved: (texts: WorkerTextsType | null) => void;
  }
>(function PersonTextsPart({ personId, personName, texts, textsSetUp, onSaved }, ref) {
  const { peopleWords } = useDashboardWords().words;
  const partRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(texts !== null);
  const [phone, setPhone] = useState(texts?.phone ?? "");
  const [choices, setChoices] = useState<Partial<Record<SwitchType, boolean>>>(
    texts ? { addedOn: texts.addedOn, movedOn: texts.movedOn, removedOn: texts.removedOn } : {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const idBase = `person-texts-${personId}`;

  // After a refusal, the first part marked invalid takes the focus once React has drawn it.
  useEffect(() => {
    if (focusRequest === 0) return;
    partRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  const edited = () => {
    setErrors({});
    setFailed(null);
  };
  const unchanged =
    on === (texts !== null) &&
    (!on ||
      (phone === texts?.phone && SWITCHES.every(({ name }) => choices[name] === texts?.[name])));

  useImperativeHandle(ref, () => ({
    async save() {
      if (unchanged) return true;
      // Everything missing is marked at once, before anything is sent.
      if (on) {
        const missing: Record<string, string> = {};
        if (!phone.trim()) missing.phone = peopleWords.enterTheirPhone;
        for (const { name } of SWITCHES)
          if (choices[name] === undefined) missing[name] = peopleWords.pickYesOrNo;
        if (Object.keys(missing).length) {
          setErrors(missing);
          setFocusRequest((count) => count + 1);
          return false;
        }
      }
      const saved = await saveWorkerTexts(personId, {
        texts: on ? ({ phone, ...choices } as WorkerTextsType) : null,
      });
      if (saved.state === "ok") {
        onSaved(saved.answer.texts);
        return true;
      }
      if (saved.state === "field") {
        setErrors({ [saved.field.replace(/^texts\./, "")]: saved.message });
        setFocusRequest((count) => count + 1);
        return false;
      }
      setFailed(saved.message);
      return false;
    },
  }));

  const allNo = on && SWITCHES.every(({ name }) => choices[name] === false);

  return (
    <div
      ref={partRef}
      role="group"
      aria-labelledby={`${idBase}-title`}
      className="flex flex-col gap-4 border-t border-border pt-4"
    >
      <h4 id={`${idBase}-title`} className="text-sm font-semibold text-foreground">
        {peopleWords.textsTo(personName)}
      </h4>
      {!textsSetUp ? (
        <p className="text-sm text-muted-foreground">{peopleWords.noTextingNumber}</p>
      ) : null}
      <ChoiceField
        name={`${idBase}-on`}
        legend={peopleWords.texts}
        choices={[
          { value: false, label: peopleWords.textsOff },
          { value: true, label: peopleWords.textsOn },
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
            <Label htmlFor={`${idBase}-phone`}>{peopleWords.theirPhone}</Label>
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
              legend={peopleWords[legend]}
              choices={[
                { value: true, label: peopleWords.textThem },
                { value: false, label: peopleWords.no },
              ]}
              value={choices[name]}
              onChange={(value) => {
                edited();
                setChoices({ ...choices, [name]: value });
              }}
              error={errors[name]}
            />
          ))}
          {allNo ? (
            <p className="text-sm text-muted-foreground">{peopleWords.everyChoiceIsNo}</p>
          ) : null}
        </>
      ) : null}
      {failed ? <CentredCardNotice>{failed}</CentredCardNotice> : null}
    </div>
  );
});
