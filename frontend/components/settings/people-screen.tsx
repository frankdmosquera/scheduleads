// Frontend component: the People page of Settings (feature 12d): every person, on or off, one box
// each, and one card open at a time to add or change one. A person's card holds everything about
// them: what they can do (feature 12k), their bookable hours, their worker texts (feature 12g),
// all saved by its one Save. Turning one off lists the bookings they hold; new hours list the
// bookings now outside them. A login that may not change the business sees the card read-only.
// Places have their own page.

"use client";

import { useEffect, useRef, useState } from "react";

import type { PersonHoursType } from "@scheduleads-app/shared/zod-validation";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { AddResourceForm } from "@/components/settings/add-resource-form";
import { ChangeResourceForm } from "@/components/settings/change-resource-form";
import { ListedBookings, type ListedBookingsType } from "@/components/settings/listed-bookings";
import { ownHoursLine } from "@/components/settings/own-hours-fields";
import {
  PersonHoursPart,
  type PersonHoursPartHandleType,
} from "@/components/settings/person-hours-part";
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
const NO_OWN_HOURS: PersonHoursType = { weeklyHours: null, dateHours: [] };

type HeldType = { title: string; list: ListedBookingsType }; // a list of bookings to call about

function PeopleList({ settings }: { settings: PeopleSettingsType }) {
  const [people, setPeople] = useState(settings.people);
  const { peopleWords, hoursWords } = useDashboardWords().words;
  const skillsPart = useRef<PersonSkillsPartHandleType>(null); // the open card's parts
  const textsPart = useRef<PersonTextsPartHandleType>(null);
  const hoursPart = useRef<PersonHoursPartHandleType>(null);
  const [skills, setSkills] = useState(
    () =>
      new Map<string, PersonSkillsType>(
        settings.skills.map(({ personId, ...personSkills }) => [personId, personSkills])
      )
  );
  // Said with the save's notice: services a skills save left with nobody on, and the bookings an
  // hours save left outside.
  const nobodyOn = useRef<string[]>([]);
  const nowOutside = useRef<ListedBookingsType["bookings"]>([]);
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
  const hoursSaved = (
    personId: string,
    saved: PersonHoursType,
    outside: ListedBookingsType["bookings"]
  ) => {
    setHours((map) => new Map(map).set(personId, saved));
    nowOutside.current = outside;
  };
  // Their hours are theirs to change only while they are on, and only once the business has its own.
  const hasHours = (resource: ResourceSettingsType) =>
    resource.active && !!settings.businessWeek && !!settings.timezone;
  const hoursLine = (resource: ResourceSettingsType) => {
    const own = hours.get(resource.id) ?? NO_OWN_HOURS;
    return ownHoursLine(
      hoursWords,
      { follows: hoursWords.followsBusinessWeek, ownDays: hoursWords.ownWeekDays },
      own.weeklyHours,
      own.dateHours
    );
  };
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
  const [open, setOpen] = useState<string | "new" | null>(null); // which card is open
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  // Stay until the next save or the page is left, so the owner can call each customer.
  const [held, setHeld] = useState<HeldType[]>([]);
  // Where the keyboard goes once a card closes: back to the button that opened it, never the top.
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
    nowOutside.current = [];
    setOpen(which);
  };

  // One Save: every part checks its own fields before anything is sent, then each part saves in
  // its turn; the card itself (name, email, on or off) saves last.
  const beforeSave = async () =>
    ((await hoursPart.current?.check()) ?? true) &&
    ((await skillsPart.current?.save()) ?? true) &&
    ((await textsPart.current?.save()) ?? true) &&
    ((await hoursPart.current?.save()) ?? true);

  const saved = (resource: ResourceSettingsType, upcoming: ListedBookingsType["bookings"]) => {
    setPeople((list) =>
      [...list.filter((existing) => existing.id !== resource.id), resource].sort(byName)
    );
    close(changeButtonId(resource.id));
    const outside = nowOutside.current;
    const left = nobodyOn.current;
    nowOutside.current = [];
    nobodyOn.current = [];
    // Bookings carry the business's zone; a business with none yet has no bookings to list.
    const timezone = settings.timezone;
    setHeld(
      timezone
        ? [
            { title: peopleWords.upcomingBookingsOf(resource.name), bookings: upcoming },
            { title: peopleWords.outsideHoursOf(resource.name), bookings: outside },
          ]
            .filter((one) => one.bookings.length)
            .map(({ title, bookings }) => ({ title, list: { bookings, timezone } }))
        : []
    );
    const savedText = resource.active
      ? peopleWords.savedOn(resource.name)
      : peopleWords.savedOff(resource.name, upcoming.length);
    setNotice({
      tone: "info",
      text:
        savedText +
        (outside.length ? peopleWords.nowOutsideHours(outside.length) : "") +
        (left.length ? ` ${peopleWords.nobodyOffers(left)}` : ""),
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
      {settings.businessWeek ? null : (
        <p className="text-sm text-muted-foreground">{hoursWords.setBusinessHoursFirst}</p>
      )}
      <SaveNotice notice={notice} />
      {held.map((one) => (
        <ListedBookings key={one.title} list={one.list} title={one.title} Heading="h3" />
      ))}

      <ul className="flex flex-col gap-2">
        {people.map((resource) =>
          open === resource.id ? (
            <li key={resource.id}>
              <ChangeResourceForm
                resource={resource}
                senderDomain={settings.senderDomain}
                canEdit={settings.canEdit}
                onSaved={(answer) => saved(answer.resource, answer.upcomingBookings)}
                onCancel={() => close(changeButtonId(resource.id))}
                beforeSave={beforeSave}
              >
                <PersonSkillsPart
                  ref={skillsPart}
                  personId={resource.id}
                  personName={resource.name}
                  services={settings.services}
                  skills={skills.get(resource.id) ?? { serviceIds: [], onFor: [] }}
                  onSaved={(saved, left) => skillsSaved(resource.id, saved, left)}
                />
                {hasHours(resource) && settings.businessWeek ? (
                  <PersonHoursPart
                    ref={hoursPart}
                    personId={resource.id}
                    personName={resource.name}
                    hours={hours.get(resource.id) ?? NO_OWN_HOURS}
                    businessWeek={settings.businessWeek}
                    onSaved={(saved, outside) => hoursSaved(resource.id, saved, outside)}
                  />
                ) : null}
                <PersonTextsPart
                  ref={textsPart}
                  personId={resource.id}
                  personName={resource.name}
                  texts={workerTexts.get(resource.id) ?? null}
                  textsSetUp={settings.textsSetUp}
                  onSaved={(texts) => textsSaved(resource.id, texts)}
                />
              </ChangeResourceForm>
            </li>
          ) : (
            <li
              key={resource.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 md:px-6"
            >
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
              {hasHours(resource) ? (
                <span className="text-sm text-muted-foreground">{hoursLine(resource)}</span>
              ) : null}
              {textsCanGo(workerTexts.get(resource.id), settings.textsSetUp) ? (
                <span className="text-xs text-muted-foreground">{peopleWords.getsTexts}</span>
              ) : null}
              <Button
                id={changeButtonId(resource.id)}
                variant="ghost"
                size="sm"
                className="ml-auto"
                aria-label={
                  settings.canEdit
                    ? peopleWords.changeOf(resource.name)
                    : peopleWords.seeOf(resource.name)
                }
                onClick={() => openForm(resource.id)}
              >
                {settings.canEdit ? peopleWords.change : peopleWords.see}
              </Button>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
