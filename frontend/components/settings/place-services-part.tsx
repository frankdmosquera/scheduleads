// Frontend component: the services that need a place, a part of its card on the Places page
// (feature 12k): one tick per service, the same tick as the service's "Places it needs". The
// card's one Save calls `save()` first.

"use client";

import { forwardRef, useImperativeHandle, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import type { PlacesSettingsType } from "@/lib/api-client/settings/fetch-places-settings";
import { savePlaceServices } from "@/lib/api-client/settings/save-place-services";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export type PlaceServicesPartHandleType = {
  save: () => Promise<boolean>; // true when saved, or nothing changed; false when refused
};

export const PlaceServicesPart = forwardRef<
  PlaceServicesPartHandleType,
  {
    placeId: string;
    placeName: string;
    services: PlacesSettingsType["services"];
    serviceIds: string[];
    onSaved: (serviceIds: string[]) => void;
  }
>(function PlaceServicesPart({ placeId, placeName, services, serviceIds, onSaved }, ref) {
  const { peopleWords, placesWords } = useDashboardWords().words;
  const [ticked, setTicked] = useState(serviceIds);
  const [failed, setFailed] = useState<string | null>(null);
  const idBase = `place-services-${placeId}`;
  const unchanged =
    ticked.length === serviceIds.length && ticked.every((id) => serviceIds.includes(id));

  useImperativeHandle(ref, () => ({
    async save() {
      if (unchanged) return true;
      const saved = await savePlaceServices(placeId, { serviceIds: ticked });
      if (saved.state === "ok") {
        onSaved(saved.answer.serviceIds);
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
        {placesWords.needsTitle(placeName)}
      </h4>
      <p id={`${idBase}-hint`} className="text-xs text-muted-foreground">
        {placesWords.needsHint}
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
