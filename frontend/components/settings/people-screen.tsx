// Frontend component: the People page of Settings (feature 12d): every person, on or off, and one
// form at a time to add or change one. Turning one off lists the bookings they hold. A person's
// worker texts (feature 12g) and what they can do (feature 12k) are part of their card, saved by its
// one Save; their bookable hours sit under it with their own Save (feature 12k). Places have their
// own page.

"use client";

import { useEffect, useRef, useState } from "react";

import type { PersonHoursType } from "@scheduleads-app/shared/zod-validation";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { AddResourceForm } from "@/components/settings/add-resource-form";
import { ChangeResourceForm } from "@/components/settings/change-resource-form";
import { ListedBookings, type ListedBookingsType } from "@/components/settings/listed-bookings";
import { PersonHoursCard } from "@/components/settings/person-hours-card";
import {
  PersonSkillsPart,
  type PersonSkillsPartHandleType,
  type PersonSkillsType,
} from "@/components/settings/person-skills-part";
import {
  PersonTextsPart,
  textsCanGo,
  type PersonTextsPartHandleType,
  type WorkerTextsType,
} from "@/components/settings/person-texts-part";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import {
  fetchPeopleSettings,
  type PeopleSettingsType,
  type ResourceSettingsType,
} from "@/lib/api-client/settings/fetch-people-settings";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function PeopleScreen() {
  const { words } = useDashboardWords();
  return (
    <SettingsSection title={words.settingsFrameWords.people} load={fetchPeopleSettings}>
      {(settings) => <PeopleList settings={settings} />}
    </SettingsSection>
  );
}

const ADD_BUTTON_ID = "add-resource";
const changeButtonId = (resourceId: string) => `change-resource-${resourceId}`;
const byName = (a: ResourceSettingsType, b: ResourceSettingsType) => a.name.localeCompare(b.name);

function PeopleList({ settings }: { settings: PeopleSettingsType }) {
  const [people, setPeople] = useState(settings.people);
  const { peopleWords, hoursWords } = useDashboardWords().words;
  const textsPart = useRef<PersonTextsPartHandleType>(null); // the open card's texts
  const skillsPart = useRef<PersonSkillsPartHandleType>(null); // the open card's skills
  const [skills, setSkills] = useState(
    () =>
      new Map<string, PersonSkillsType>(
        settings.skills.map(({ personId, ...personSkills }) => [personId, personSkills])
      )
  );
  // Services a skills save left with nobody on, said with the save's notice.
  const nobodyOn = useRef<string[]>([]);
  const skillsSaved = (personId: string, saved: PersonSkillsType, left: string[]) => {
    setSkills((map) => new Map(map).set(personId, saved));
    nobodyOn.current = left;
  };
  const [hours, setHours] = useState(
    () =>
      new Map<string, PersonHoursType>(
        settings.hours.map(({ personId, ...personHours }) => [personId, personHours])
      )
  );
  const hoursSaved = (personId: string, saved: PersonHoursType) =>
    setHours((map) => new Map(map).set(personId, saved));
  // Their bookable hours: on their card for whoever may change them, under their row read-only for
  // the rest. An off person has none to change until they are on.
  const hoursCardOf = (resource: ResourceSettingsType) =>
    !resource.active ? null : settings.businessWeek && settings.timezone ? (
      <PersonHoursCard
        person={{
          id: resource.id,
          name: resource.name,
          ...(hours.get(resource.id) ?? { weeklyHours: null, dateHours: [] }),
        }}
        businessWeek={settings.businessWeek}
        timezone={settings.timezone}
        canEdit={settings.canEdit}
        onSaved={(saved) => hoursSaved(resource.id, saved)}
      />
    ) : (
      <p className="text-sm text-muted-foreground">{hoursWords.setBusinessHoursFirst}</p>
    );
  // The live services a person is on for, as customers see them.
  const bookedFor = (resource: ResourceSettingsType) => {
    const onFor = resource.active ? (skills.get(resource.id)?.onFor ?? []) : [];
    const names = settings.services
      .filter((service) => service.active && onFor.includes(service.id))
      .map((service) => service.name);
    return names.length ? peopleWords.bookedFor(names) : peopleWords.notBooked;
  };
  const [workerTexts, setWorkerTexts] = useState(
    () =>
      new Map<string, WorkerTextsType>(
        settings.workerTexts.map(({ personId, ...texts }) => [personId, texts])
      )
  );
  const textsSaved = (personId: string, texts: WorkerTextsType | null) =>
    setWorkerTexts((map) => {
      const next = new Map(map);
      if (texts) next.set(personId, texts);
      else next.delete(personId);
      return next;
    });
  const [open, setOpen] = useState<string | "new" | null>(null); // which form is open
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  // Stays until the next save or the page is left, so the owner can call each customer.
  const [held, setHeld] = useState<{ name: string; list: ListedBookingsType } | null>(null);
  // Where the keyboard goes once a form closes: back to the button that opened it, never the top.
  const returnFocus = useRef<string | null>(null);
  useEffect(() => {
    if (open !== null || !returnFocus.current) return;
    document.getElementById(returnFocus.current)?.focus();
    returnFocus.current = null;
  }, [open]);
  const close = (focusId: string) => {
    returnFocus.current = focusId;
    setOpen(null);
  };
  const openForm = (which: string | "new") => {
    setNotice(null);
    nobodyOn.current = [];
    setOpen(which);
  };

  const saved = (resource: ResourceSettingsType, upcoming: ListedBookingsType["bookings"]) => {
    setPeople((list) =>
      [...list.filter((existing) => existing.id !== resource.id), resource].sort(byName)
    );
    close(changeButtonId(resource.id));
    // Bookings carry the business's zone; a business with none yet has no bookings to list.
    setHeld(
      upcoming.length && settings.timezone
        ? { name: resource.name, list: { bookings: upcoming, timezone: settings.timezone } }
        : null
    );
    const savedText = resource.active
      ? peopleWords.savedOn(resource.name)
      : peopleWords.savedOff(resource.name, upcoming.length);
    const left = nobodyOn.current;
    nobodyOn.current = [];
    setNotice({
      tone: "info",
      text: left.length ? `${savedText} ${peopleWords.nobodyOffers(left)}` : savedText,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {!settings.canEdit ? (
        <CentredCardNotice tone="info">{peopleWords.cannotChange}</CentredCardNotice>
      ) : open === "new" ? (
        <AddResourceForm
          kind="person"
          onSaved={(added) => saved(added, [])}
          onCancel={() => close(ADD_BUTTON_ID)}
        />
      ) : (
        <div>
          <Button id={ADD_BUTTON_ID} variant="outline" onClick={() => openForm("new")}>
            {peopleWords.addButton}
          </Button>
        </div>
      )}
      <SaveNotice notice={notice} />
      <ListedBookings
        list={held?.list ?? null}
        title={held ? peopleWords.upcomingBookingsOf(held.name) : ""}
        Heading="h3"
      />

      <ul className="flex flex-col gap-2">
        {people.map((resource) =>
          open === resource.id ? (
            <li key={resource.id} className="flex flex-col gap-2">
              <ChangeResourceForm
                resource={resource}
                senderDomain={settings.senderDomain}
                onSaved={(answer) => saved(answer.resource, answer.upcomingBookings)}
                onCancel={() => close(changeButtonId(resource.id))}
                beforeSave={async () =>
                  ((await skillsPart.current?.save()) ?? true) &&
                  ((await textsPart.current?.save()) ?? true)
                }
              >
                <PersonSkillsPart
                  ref={skillsPart}
                  personId={resource.id}
                  personName={resource.name}
                  services={settings.services}
                  skills={skills.get(resource.id) ?? { serviceIds: [], onFor: [] }}
                  onSaved={(saved, left) => skillsSaved(resource.id, saved, left)}
                />
                <PersonTextsPart
                  ref={textsPart}
                  personId={resource.id}
                  personName={resource.name}
                  texts={workerTexts.get(resource.id) ?? null}
                  textsSetUp={settings.textsSetUp}
                  onSaved={(texts) => textsSaved(resource.id, texts)}
                />
              </ChangeResourceForm>
              {hoursCardOf(resource)}
            </li>
          ) : (
            <li key={resource.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 md:px-6">
                <span className="font-medium text-foreground">{resource.name}</span>
                <span
                  className={
                    resource.active
                      ? "rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-primary"
                      : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {resource.active ? peopleWords.on : peopleWords.off}
                </span>
                <span className="text-sm text-muted-foreground">{bookedFor(resource)}</span>
                {textsCanGo(workerTexts.get(resource.id), settings.textsSetUp) ? (
                  <span className="text-xs text-muted-foreground">{peopleWords.getsTexts}</span>
                ) : null}
                {settings.canEdit ? (
                  <Button
                    id={changeButtonId(resource.id)}
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    aria-label={peopleWords.changeOf(resource.name)}
                    onClick={() => openForm(resource.id)}
                  >
                    {peopleWords.change}
                  </Button>
                ) : null}
              </div>
              {settings.canEdit ? null : hoursCardOf(resource)}
            </li>
          )
        )}
      </ul>
    </div>
  );
}
