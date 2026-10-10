// Frontend component: the Services page of Settings (feature 12d): every service, live or hidden,
// and one form at a time to add or change one.

"use client";

import { useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { ServiceForm } from "@/components/settings/service-form";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import {
  fetchServicesSettings,
  type ServiceSettingsType,
  type ServicesSettingsType,
} from "@/lib/api-client/settings/fetch-services-settings";

export function ServicesScreen() {
  return (
    <SettingsSection title="Services" load={fetchServicesSettings}>
      {(settings) => <ServicesList settings={settings} />}
    </SettingsSection>
  );
}

const byName = (a: ServiceSettingsType, b: ServiceSettingsType) => a.name.localeCompare(b.name);

function ServicesList({ settings }: { settings: ServicesSettingsType }) {
  const [services, setServices] = useState(settings.services);
  const [open, setOpen] = useState<string | "new" | null>(null); // which form is open
  const [notice, setNotice] = useState<SaveNoticeType>(null);

  const saved = (service: ServiceSettingsType) => {
    setServices((list) =>
      [...list.filter((existing) => existing.id !== service.id), service].sort(byName)
    );
    setOpen(null);
    setNotice({
      tone: "info",
      text: service.active
        ? `Saved. Customers can book ${service.name} now.`
        : `Saved. ${service.name} is hidden; bookings already made stay.`,
    });
  };
  const openForm = (which: string | "new") => {
    setNotice(null);
    setOpen(which);
  };

  return (
    <div className="flex flex-col gap-3">
      {!settings.canEdit ? (
        <CentredCardNotice tone="info">
          Your role cannot change the services. You can see them here.
        </CentredCardNotice>
      ) : open === "new" ? (
        <ServiceForm service={null} onSaved={saved} onCancel={() => setOpen(null)} />
      ) : (
        <div>
          <Button variant="outline" onClick={() => openForm("new")}>
            + Add a service
          </Button>
        </div>
      )}
      <SaveNotice notice={notice} />

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {services.map((service) =>
            open === service.id ? (
              <li key={service.id}>
                <ServiceForm service={service} onSaved={saved} onCancel={() => setOpen(null)} />
              </li>
            ) : (
              <li
                key={service.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 md:px-6"
              >
                <span className="font-medium text-foreground">{service.name}</span>
                <span className="text-sm text-muted-foreground">{service.durationMinutes} min</span>
                <span
                  className={
                    service.active
                      ? "rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-primary"
                      : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {service.active ? "Live" : "Hidden"}
                </span>
                {settings.canEdit ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    aria-label={`Change ${service.name}`}
                    onClick={() => openForm(service.id)}
                  >
                    Change
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
