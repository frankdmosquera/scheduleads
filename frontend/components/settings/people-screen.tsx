// Frontend component: the People page of Settings (feature 12d): every person and place, on or
// off, and one form at a time to add or change one. Turning one off lists the bookings they hold.

"use client";

import { useEffect, useRef, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { AddResourceForm } from "@/components/settings/add-resource-form";
import { ChangeResourceForm } from "@/components/settings/change-resource-form";
import { ListedBookings, type ListedBookingsType } from "@/components/settings/listed-bookings";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import {
  fetchPeopleSettings,
  type PeopleSettingsType,
  type ResourceSettingsType,
} from "@/lib/api-client/settings/fetch-people-settings";

export function PeopleScreen() {
  return (
    <SettingsSection title="People" load={fetchPeopleSettings}>
      {(settings) => <PeopleList settings={settings} />}
    </SettingsSection>
  );
}

const ADD_BUTTON_ID = "add-resource";
const changeButtonId = (resourceId: string) => `change-resource-${resourceId}`;
const byName = (a: ResourceSettingsType, b: ResourceSettingsType) => a.name.localeCompare(b.name);

function PeopleList({ settings }: { settings: PeopleSettingsType }) {
  const [people, setPeople] = useState(settings.people);
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
        ? `Saved. ${resource.name} is on.`
        : `Saved. ${resource.name} is off: no new bookings.${
            upcoming.length
              ? ` ${upcoming.length === 1 ? "One booking stays" : `${upcoming.length} bookings stay`}, listed below.`
              : ""
          }`,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {!settings.canEdit ? (
        <CentredCardNotice tone="info">
          Your role cannot change the people and places. You can see them here.
        </CentredCardNotice>
      ) : open === "new" ? (
        <AddResourceForm
          onSaved={(added) => saved(added, [])}
          onCancel={() => close(ADD_BUTTON_ID)}
        />
      ) : (
        <div>
          <Button id={ADD_BUTTON_ID} variant="outline" onClick={() => openForm("new")}>
            + Add a person or a place
          </Button>
        </div>
      )}
      <SaveNotice notice={notice} />
      <ListedBookings
        list={held?.list ?? null}
        title={held ? `${held.name}'s upcoming bookings` : ""}
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
              />
            </li>
          ) : (
            <li
              key={resource.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 md:px-6"
            >
              <span className="font-medium text-foreground">{resource.name}</span>
              <span className="text-sm text-muted-foreground">
                {resource.kind === "person" ? "Person" : "Place"}
              </span>
              <span
                className={
                  resource.active
                    ? "rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-primary"
                    : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                }
              >
                {resource.active ? "On" : "Off"}
              </span>
              {settings.canEdit ? (
                <Button
                  id={changeButtonId(resource.id)}
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  aria-label={`Change ${resource.name}`}
                  onClick={() => openForm(resource.id)}
                >
                  Change
                </Button>
              ) : null}
            </li>
          )
        )}
      </ul>
    </div>
  );
}
