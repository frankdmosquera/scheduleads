// Frontend component: what a person can do, a part of their card on the People page (feature 12k):
// one tick per service. A service ticked here lists them on it, offering it; the service's own
// page turns them off when they are not taking it. The card's one Save calls `save()` first.

"use client";

import { forwardRef, useImperativeHandle, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import type { PeopleSettingsType } from "@/lib/api-client/settings/fetch-people-settings";
import { savePersonSkills } from "@/lib/api-client/settings/save-person-skills";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export type PersonSkillsType = Omit<PeopleSettingsType["skills"][number], "personId">;

export type PersonSkillsPartHandleType = {
  save: () => Promise<boolean>; // true when saved, or nothing changed; false when refused
};

export const PersonSkillsPart = forwardRef<
  PersonSkillsPartHandleType,
  {
    personId: string;
    personName: string;
    services: PeopleSettingsType["services"];
    skills: PersonSkillsType;
    onSaved: (skills: PersonSkillsType, nobodyOn: string[]) => void;
  }
>(function PersonSkillsPart({ personId, personName, services, skills, onSaved }, ref) {
  const { peopleWords } = useDashboardWords().words;
  const [ticked, setTicked] = useState(skills.serviceIds);
  const [failed, setFailed] = useState<string | null>(null);
  const idBase = `person-skills-${personId}`;
  const unchanged =
    ticked.length === skills.serviceIds.length &&
    ticked.every((id) => skills.serviceIds.includes(id));

  useImperativeHandle(ref, () => ({
    async save() {
      if (unchanged) return true;
      const saved = await savePersonSkills(personId, { serviceIds: ticked });
      if (saved.state === "ok") {
        const { nobodyOn, ...answer } = saved.answer;
        onSaved(answer, nobodyOn);
        return true;
      }
      setFailed(saved.message);
      return false;
    },
  }));

  const toggle = (id: string, on: boolean) => {
    setFailed(null);
    setTicked((list) => (on ? [...list, id] : list.filter((tickedId) => tickedId !== id)));
  };

  return (
    <div
      role="group"
      aria-labelledby={`${idBase}-title`}
      aria-describedby={`${idBase}-hint`}
      className="flex flex-col gap-3 border-t border-border pt-4"
    >
      <h4 id={`${idBase}-title`} className="text-sm font-semibold text-foreground">
        {peopleWords.canDoTitle(personName)}
      </h4>
      <p id={`${idBase}-hint`} className="text-xs text-muted-foreground">
        {peopleWords.canDoHint}
      </p>
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">{peopleWords.noServicesYet}</p>
      ) : (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {services.map((service) => (
            <label key={service.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ticked.includes(service.id)}
                onChange={(event) => toggle(service.id, event.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              <span className={service.active ? undefined : "text-muted-foreground"}>
                {service.name}
                {service.active ? null : peopleWords.hiddenService}
              </span>
            </label>
          ))}
        </div>
      )}
      {failed ? <CentredCardNotice>{failed}</CentredCardNotice> : null}
    </div>
  );
});
