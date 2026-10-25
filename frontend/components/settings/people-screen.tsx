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
import { OwnHoursPart, type OwnHoursPartHandleType } from "@/components/settings/own-hours-part";
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
import { savePersonHours } from "@/lib/api-client/settings/save-person-hours";
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
  const hoursPart = useRef<OwnHoursPartHandleType>(null);
  // While a card saves, no other opens: its answer, a refusal included, is always seen (F-511).
  const [saving, setSaving] = useState(false);
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
    // A second save in the same card adds to the list: each lists only what it newly left outside.
    const listed = new Set(nowOutside.current.map((booking) => booking.bookingId));
    nowOutside.current = [
      ...nowOutside.current,
      ...outside.filter((booking) => !listed.has(booking.bookingId)),
    ];
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
  // It waits for the closed card's Save to end, as a disabled button takes no focus (F-515).
  useEffect(() => {
    if (open !== null || saving || !returnFocus.current) return;
    document.getElementById(returnFocus.current)?.focus();
    returnFocus.current = null;
  }, [open, saving]);
  const close = (focusId: string) => {
    returnFocus.current = focusId;
    setOpen(null);
  };
  const openForm = (which: string | "new") => {
    // A card left open after a refusal still says what its saved parts did.
    const leaving = people.find((resource) => resource.id === open);
    if (!leaving || !reportUnfinished(leaving)) setNotice(null);
    setOpen(which);
  };

  // One Save: every part checks its own fields before anything is sent, then each part saves in
  // its turn; the card itself (name, email, on or off) saves last.
  const beforeSave = async () =>
    ((await hoursPart.current?.check()) ?? true) &&
    (textsPart.current?.check() ?? true) &&
    ((await skillsPart.current?.save()) ?? true) &&
    ((await textsPart.current?.save()) ?? true) &&
    ((await hoursPart.current?.save()) ?? true);

  // A card closed without its whole Save (Cancel, or another card opened after a refusal): the
  // parts saved before the refusal stay saved, so the page still lists the bookings their new hours
  // left outside and says which services nobody offers now. True when it said something.
  const reportUnfinished = (resource: ResourceSettingsType) => {
    const outside = nowOutside.current;
    const left = nobodyOn.current;
    nowOutside.current = [];
    nobodyOn.current = [];
    const timezone = settings.timezone;
    if (outside.length && timezone) {
      setHeld([
        { title: peopleWords.outsideHoursOf(resource.name), list: { bookings: outside, timezone } },
      ]);
    }
    const said = [
      outside.length ? peopleWords.nowOutsideHours(outside.length).trim() : "",
      left.length ? peopleWords.nobodyOffers(left) : "",
    ].filter(Boolean);
    if (said.length) setNotice({ tone: "info", text: said.join(" ") });
    return said.length > 0;
  };
  const cancelled = (resource: ResourceSettingsType) => {
    close(changeButtonId(resource.id));
    reportUnfinished(resource);
  };

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
          onSavingChange={setSaving}
        />
      ) : (
        <div>
          <Button
            id={ADD_BUTTON_ID}
            variant="outline"
            disabled={saving}
            onClick={() => openForm("new")}
          >
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
                onCancel={() => cancelled(resource)}
                beforeSave={beforeSave}
                onSavingChange={setSaving}
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
                  <OwnHoursPart
                    ref={hoursPart}
                    idBase={`person-hours-${resource.id}`}
                    name={resource.name}
                    title={peopleWords.bookableHours}
                    words={{
                      follows: hoursWords.followsBusinessWeek,
                      own: hoursWords.ownWeek,
                      weekLabel: hoursWords.personWeek,
                      datesTitle: hoursWords.personOneOffDates,
                    }}
                    hours={hours.get(resource.id) ?? NO_OWN_HOURS}
                    businessWeek={settings.businessWeek}
                    save={async (next) => {
                      const saved = await savePersonHours(resource.id, next);
                      if (saved.state !== "ok") return saved;
                      const { weeklyHours, dateHours } = saved.answer.person;
                      return {
                        state: "ok",
                        answer: { weeklyHours, dateHours, outsideHours: saved.answer.outsideHours },
                      };
                    }}
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
                disabled={saving}
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
