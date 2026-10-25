// Frontend component: the Services page of Settings (feature 12d): every service, live or hidden,
// and one form at a time to add or change one. A new length lists the bookings it no longer fits.

"use client";

import { useEffect, useRef, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { ListedBookings, type ListedBookingsType } from "@/components/settings/listed-bookings";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { ServiceForm, type ServiceSaveOutcomeType } from "@/components/settings/service-form";
import { ServiceHoursCard } from "@/components/settings/service-hours-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import {
  fetchServicesSettings,
  type ServiceSettingsType,
  type ServicesSettingsType,
} from "@/lib/api-client/settings/fetch-services-settings";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function ServicesScreen() {
  const { words } = useDashboardWords();
  return (
    <SettingsSection title={words.settingsFrameWords.services} load={fetchServicesSettings}>
      {(settings) => <ServicesList settings={settings} />}
    </SettingsSection>
  );
}

const ADD_BUTTON_ID = "add-service";
const changeButtonId = (serviceId: string) => `change-service-${serviceId}`;
const byName = (a: ServiceSettingsType, b: ServiceSettingsType) => a.name.localeCompare(b.name);

function ServicesList({ settings }: { settings: ServicesSettingsType }) {
  const { words } = useDashboardWords();
  const servicesWords = words.servicesWords;
  const [services, setServices] = useState(settings.services);
  // When each service runs (feature 12k); one not listed runs whenever the business is open.
  const [hoursOf, setHoursOf] = useState(
    () =>
      new Map(
        settings.serviceHours.map(({ serviceId, weeklyHours, dateHours }) => [
          serviceId,
          { weeklyHours, dateHours },
        ])
      )
  );
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

  const saved = (
    service: ServiceSettingsType,
    { ticksSaved, outsideHours }: ServiceSaveOutcomeType
  ) => {
    setServices((list) =>
      [...list.filter((existing) => existing.id !== service.id), service].sort(byName)
    );
    close(changeButtonId(service.id));
    // Bookings carry the business's zone; a business with none yet has no bookings to list.
    setHeld(
      outsideHours.length && settings.timezone
        ? { name: service.name, list: { bookings: outsideHours, timezone: settings.timezone } }
        : null
    );
    const listed = outsideHours.length ? servicesWords.noLongerFit(outsideHours.length) : "";
    if (!ticksSaved) {
      setNotice({ tone: "error", text: servicesWords.savedButTicksNot(service.name) + listed });
      return;
    }
    setNotice({
      tone: "info",
      text:
        (service.active
          ? servicesWords.savedLive(service.name)
          : servicesWords.savedHidden(service.name)) + listed,
    });
  };
  const openForm = (which: string | "new") => {
    setNotice(null);
    setOpen(which);
  };

  return (
    <div className="flex flex-col gap-3">
      {!settings.canEdit ? (
        <CentredCardNotice tone="info">{servicesWords.cannotChange}</CentredCardNotice>
      ) : open === "new" ? (
        <ServiceForm
          service={null}
          people={settings.people}
          onSaved={saved}
          onCancel={() => close(ADD_BUTTON_ID)}
        />
      ) : (
        <div>
          <Button id={ADD_BUTTON_ID} variant="outline" onClick={() => openForm("new")}>
            {servicesWords.addAService}
          </Button>
        </div>
      )}
      <SaveNotice notice={notice} />
      <ListedBookings
        list={held?.list ?? null}
        title={held ? servicesWords.heldTitle(held.name) : ""}
        Heading="h3"
      />

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">{servicesWords.noServicesYet}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {services.map((service) =>
            open === service.id ? (
              <li key={service.id} className="flex flex-col gap-2">
                <ServiceForm
                  service={service}
                  people={settings.people}
                  onSaved={saved}
                  onCancel={() => close(changeButtonId(service.id))}
                />
                {settings.businessWeek && settings.timezone ? (
                  <ServiceHoursCard
                    service={service}
                    hours={hoursOf.get(service.id) ?? { weeklyHours: null, dateHours: [] }}
                    businessWeek={settings.businessWeek}
                    timezone={settings.timezone}
                    canEdit={settings.canEdit}
                    onSaved={(hours) => setHoursOf((map) => new Map(map).set(service.id, hours))}
                  />
                ) : null}
              </li>
            ) : (
              <li
                key={service.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 md:px-6"
              >
                <span className="font-medium text-foreground">{service.name}</span>
                <span className="text-sm text-muted-foreground">
                  {servicesWords.minutes(service.durationMinutes)}
                </span>
                <span
                  className={
                    service.active
                      ? "rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-primary"
                      : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {service.active ? servicesWords.live : servicesWords.hidden}
                </span>
                {settings.canEdit ? (
                  <Button
                    id={changeButtonId(service.id)}
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    aria-label={servicesWords.changeService(service.name)}
                    onClick={() => openForm(service.id)}
                  >
                    {words.settingsFrameWords.change}
                  </Button>
                ) : null}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
