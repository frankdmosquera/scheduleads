// Frontend component: the People page of Settings (feature 12d): every person and place, on or
// off, and one form at a time to add or change one. Turning one off lists the bookings they hold.
// A person's worker texts (feature 12g) are part of their card, saved by its one Save.

"use client";

import { useEffect, useRef, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { AddResourceForm } from "@/components/settings/add-resource-form";
import { ChangeResourceForm } from "@/components/settings/change-resource-form";
import { ListedBookings, type ListedBookingsType } from "@/components/settings/listed-bookings";
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
  const { peopleWords } = useDashboardWords().words;
  const textsPart = useRef<PersonTextsPartHandleType>(null); // the open card's texts
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
    setNotice({
      tone: "info",
      text: resource.active
        ? peopleWords.savedOn(resource.name)
        : peopleWords.savedOff(resource.name, upcoming.length),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {!settings.canEdit ? (
        <CentredCardNotice tone="info">{peopleWords.cannotChange}</CentredCardNotice>
      ) : open === "new" ? (
        <AddResourceForm
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
            <li key={resource.id}>
              <ChangeResourceForm
                resource={resource}
                senderDomain={settings.senderDomain}
                onSaved={(answer) => saved(answer.resource, answer.upcomingBookings)}
                onCancel={() => close(changeButtonId(resource.id))}
                beforeSave={
                  resource.kind === "person"
                    ? async () => (await textsPart.current?.save()) ?? true
                    : undefined
                }
              >
                {resource.kind === "person" ? (
                  <PersonTextsPart
                    ref={textsPart}
                    personId={resource.id}
                    personName={resource.name}
                    texts={workerTexts.get(resource.id) ?? null}
                    textsSetUp={settings.textsSetUp}
                    onSaved={(texts) => textsSaved(resource.id, texts)}
                  />
                ) : null}
              </ChangeResourceForm>
            </li>
          ) : (
            <li
              key={resource.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 md:px-6"
            >
              <span className="font-medium text-foreground">{resource.name}</span>
              <span className="text-sm text-muted-foreground">
                {resource.kind === "person" ? peopleWords.person : peopleWords.place}
              </span>
              <span
                className={
                  resource.active
                    ? "rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-primary"
                    : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                }
              >
                {resource.active ? peopleWords.on : peopleWords.off}
              </span>
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
            </li>
          )
        )}
      </ul>
    </div>
  );
}
