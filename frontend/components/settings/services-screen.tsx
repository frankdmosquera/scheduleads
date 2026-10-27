// Frontend component: the Services page of Settings (feature 12d): every service, live or hidden,
// one box each, and one card open at a time to add or change one. A service's card holds when it
// runs too (feature 12k), saved by its one Save. A new length lists the bookings it no longer fits,
// new hours the bookings now outside them. A login that may not change the business sees the card
// read-only.

"use client";

import { useEffect, useRef, useState } from "react";

import { formatPrice } from "@scheduleads-app/shared/format-price";
import type { PersonHoursType } from "@scheduleads-app/shared/zod-validation";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { ListedBookings, type ListedBookingsType } from "@/components/settings/listed-bookings";
import { ownHoursLine } from "@/components/settings/own-hours-fields";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { ServiceForm, type ServiceSaveOutcomeType } from "@/components/settings/service-form";
import { ServicesCurrencyPicker } from "@/components/settings/services-currency-picker";
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
const NO_OWN_HOURS: PersonHoursType = { weeklyHours: null, dateHours: [] };

function ServicesList({ settings }: { settings: ServicesSettingsType }) {
  const { words, language } = useDashboardWords();
  const { servicesWords, hoursWords } = words;
  const [services, setServices] = useState(settings.services);
  const [currency, setCurrency] = useState(settings.currency); // every price's (feature 25d)
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
  // While a card saves, no other opens: its answer, a refusal included, is always seen (F-514).
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  // Stays until the next save or the page is left, so the owner can call each customer.
  const [held, setHeld] = useState<{ title: string; list: ListedBookingsType }[]>([]);
  // Where the keyboard goes once a form closes: back to the button that opened it, never the top.
  const returnFocus = useRef<string | null>(null);
  // It waits for the closed card's Save to end, as a disabled button takes no focus (F-515).
  useEffect(() => {
    if (open !== null || saving || !returnFocus.current) return;
    document.getElementById(returnFocus.current)?.focus();
    returnFocus.current = null;
  }, [open, saving]);
  // A Save that ends after another card was opened leaves that card open (F-512).
  const close = (focusId: string, card?: string) => {
    returnFocus.current = focusId;
    setOpen((now) => (card === undefined || now === card ? null : now));
  };

  const saved = (
    card: string, // the card that saved: the service's id, or "new"
    service: ServiceSettingsType,
    { unsaved, noLongerFit, outsideItsHours }: ServiceSaveOutcomeType
  ) => {
    setServices((list) =>
      [...list.filter((existing) => existing.id !== service.id), service].sort(byName)
    );
    close(changeButtonId(service.id), card);
    // Bookings carry the business's zone; a business with none yet has no bookings to list.
    const timezone = settings.timezone;
    setHeld(
      timezone
        ? [
            { title: servicesWords.heldTitle(service.name), bookings: noLongerFit },
            { title: servicesWords.heldOutsideTitle(service.name), bookings: outsideItsHours },
          ]
            .filter(({ bookings }) => bookings.length)
            .map(({ title, bookings }) => ({ title, list: { bookings, timezone } }))
        : []
    );
    const listed =
      (noLongerFit.length ? servicesWords.noLongerFit(noLongerFit.length) : "") +
      (outsideItsHours.length ? servicesWords.nowOutsideItsHours(outsideItsHours.length) : "");
    if (unsaved) {
      const notSaved = {
        ticks: servicesWords.savedButTicksNot,
        "ticks-and-hours": servicesWords.savedButTicksAndHoursNot,
        hours: servicesWords.savedButHoursNot,
      }[unsaved](service.name);
      setNotice({ tone: "error", text: notSaved + listed });
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
  // When it runs, once the business has hours of its own.
  const hasHours = !!settings.businessWeek && !!settings.timezone;
  const hoursLine = (service: ServiceSettingsType) => {
    const own = hoursOf.get(service.id) ?? NO_OWN_HOURS;
    return ownHoursLine(
      hoursWords,
      { follows: servicesWords.runsWhenOpen, ownDays: servicesWords.runsOwnWeekDays },
      own.weeklyHours,
      own.dateHours
    );
  };
  const openForm = (which: string | "new") => {
    setNotice(null);
    setOpen(which);
  };

  // "$150" or "From $150" in the dashboard's language; null: none shown.
  const priceLine = (service: ServiceSettingsType) => {
    if (service.priceCents === null || currency === null) return null;
    const amount = formatPrice(service.priceCents, currency, language);
    return service.priceFrom ? servicesWords.priceFrom(amount) : amount;
  };

  return (
    <div className="flex flex-col gap-3">
      <ServicesCurrencyPicker
        currency={currency}
        canEdit={settings.canEdit && !saving && open === null}
        onSaved={setCurrency}
      />
      {!settings.canEdit ? (
        <CentredCardNotice tone="info">{servicesWords.cannotChange}</CentredCardNotice>
      ) : open === "new" ? (
        <ServiceForm
          service={null}
          people={settings.people}
          currency={currency}
          hours={null}
          businessWeek={settings.businessWeek}
          onHoursSaved={() => {}}
          onSaved={(service, outcome) => saved("new", service, outcome)}
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
            {servicesWords.addAService}
          </Button>
        </div>
      )}
      <SaveNotice notice={notice} />
      {held.map(({ title, list }) => (
        <ListedBookings key={title} list={list} title={title} Heading="h3" />
      ))}

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">{servicesWords.noServicesYet}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {services.map((service) =>
            open === service.id ? (
              <li key={service.id}>
                <ServiceForm
                  service={service}
                  people={settings.people}
                  currency={currency}
                  hours={hasHours ? (hoursOf.get(service.id) ?? NO_OWN_HOURS) : null}
                  businessWeek={settings.businessWeek}
                  onHoursSaved={(hours) => setHoursOf((map) => new Map(map).set(service.id, hours))}
                  onSaved={(savedService, outcome) => saved(service.id, savedService, outcome)}
                  onCancel={() => close(changeButtonId(service.id))}
                  canEdit={settings.canEdit}
                  onSavingChange={setSaving}
                />
              </li>
            ) : (
              <li key={service.id}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 md:px-6">
                  <span className="font-medium text-foreground">{service.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {[servicesWords.minutes(service.durationMinutes), priceLine(service)]
                      .filter(Boolean)
                      .join(" · ")}
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
                  <Button
                    id={changeButtonId(service.id)}
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={saving}
                    aria-label={
                      settings.canEdit
                        ? servicesWords.changeService(service.name)
                        : servicesWords.seeService(service.name)
                    }
                    onClick={() => openForm(service.id)}
                  >
                    {settings.canEdit ? words.settingsFrameWords.change : servicesWords.see}
                  </Button>
                  {hasHours ? (
                    <span className="basis-full text-sm text-muted-foreground">
                      {hoursLine(service)}
                    </span>
                  ) : null}
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
