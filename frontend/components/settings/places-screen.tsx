// Frontend component: the Places page of Settings (feature 12k): every place, on or off, and one
// form at a time to add or change one. Turning one off lists the bookings that use it. The services
// that need a place are part of its card, saved by its one Save.

"use client";

import { useEffect, useRef, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { AddResourceForm } from "@/components/settings/add-resource-form";
import { ChangeResourceForm } from "@/components/settings/change-resource-form";
import { ListedBookings, type ListedBookingsType } from "@/components/settings/listed-bookings";
import {
  PlaceServicesPart,
  type PlaceServicesPartHandleType,
} from "@/components/settings/place-services-part";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import type { ResourceSettingsType } from "@/lib/api-client/settings/fetch-people-settings";
import {
  fetchPlacesSettings,
  type PlacesSettingsType,
} from "@/lib/api-client/settings/fetch-places-settings";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function PlacesScreen() {
  const { words } = useDashboardWords();
  return (
    <SettingsSection title={words.settingsFrameWords.places} load={fetchPlacesSettings}>
      {(settings) => <PlacesList settings={settings} />}
    </SettingsSection>
  );
}

const ADD_BUTTON_ID = "add-place";
const changeButtonId = (placeId: string) => `change-place-${placeId}`;
const byName = (a: ResourceSettingsType, b: ResourceSettingsType) => a.name.localeCompare(b.name);

function PlacesList({ settings }: { settings: PlacesSettingsType }) {
  const [places, setPlaces] = useState(settings.places);
  const { peopleWords, placesWords } = useDashboardWords().words;
  const servicesPart = useRef<PlaceServicesPartHandleType>(null); // the open card's services
  const [needs, setNeeds] = useState(
    () =>
      new Map<string, string[]>(
        settings.placeServices.map(({ placeId, serviceIds }) => [placeId, serviceIds])
      )
  );
  // The services that need a place, as its row says them.
  const neededBy = (placeId: string) => {
    const ids = needs.get(placeId) ?? [];
    const names = settings.services
      .filter((service) => ids.includes(service.id))
      .map((service) => `${service.name}${service.active ? "" : peopleWords.hiddenService}`);
    return names.length ? placesWords.neededBy(names) : placesWords.neededByNone;
  };
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

  const saved = (place: ResourceSettingsType, upcoming: ListedBookingsType["bookings"]) => {
    setPlaces((list) =>
      [...list.filter((existing) => existing.id !== place.id), place].sort(byName)
    );
    close(changeButtonId(place.id));
    // Bookings carry the business's zone; a business with none yet has no bookings to list.
    setHeld(
      upcoming.length && settings.timezone
        ? { name: place.name, list: { bookings: upcoming, timezone: settings.timezone } }
        : null
    );
    setNotice({
      tone: "info",
      text: place.active
        ? peopleWords.savedOn(place.name)
        : peopleWords.savedOff(place.name, upcoming.length),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{placesWords.lede}</p>
      {!settings.canEdit ? (
        <CentredCardNotice tone="info">{placesWords.cannotChange}</CentredCardNotice>
      ) : open === "new" ? (
        <AddResourceForm
          kind="place"
          onSaved={(added) => saved(added, [])}
          onCancel={() => close(ADD_BUTTON_ID)}
        />
      ) : (
        <div>
          <Button id={ADD_BUTTON_ID} variant="outline" onClick={() => openForm("new")}>
            {placesWords.addButton}
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
        {places.map((place) =>
          open === place.id ? (
            <li key={place.id}>
              <ChangeResourceForm
                resource={place}
                senderDomain={null}
                onSaved={(answer) => saved(answer.resource, answer.upcomingBookings)}
                onCancel={() => close(changeButtonId(place.id))}
                beforeSave={async () => (await servicesPart.current?.save()) ?? true}
              >
                <PlaceServicesPart
                  ref={servicesPart}
                  placeId={place.id}
                  placeName={place.name}
                  services={settings.services}
                  serviceIds={needs.get(place.id) ?? []}
                  onSaved={(serviceIds) =>
                    setNeeds((map) => new Map(map).set(place.id, serviceIds))
                  }
                />
              </ChangeResourceForm>
            </li>
          ) : (
            <li
              key={place.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 md:px-6"
            >
              <span className="font-medium text-foreground">{place.name}</span>
              <span
                className={
                  place.active
                    ? "rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-primary"
                    : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                }
              >
                {place.active ? peopleWords.on : peopleWords.off}
              </span>
              <span className="text-sm text-muted-foreground">{neededBy(place.id)}</span>
              {settings.canEdit ? (
                <Button
                  id={changeButtonId(place.id)}
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  aria-label={peopleWords.changeOf(place.name)}
                  onClick={() => openForm(place.id)}
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
