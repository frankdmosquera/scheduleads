// Frontend component: the Settings screen. Hours now (feature 12a); services, closed days, the
// booking form, texts and the calendar join it as their own sections (12d to 12h).

"use client";

import { useEffect, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { RefusalNotice } from "@/components/centred-card/refusal-notice";
import { BusinessHoursCard } from "@/components/settings/business-hours-card";
import { PersonHoursCard } from "@/components/settings/person-hours-card";
import { Button } from "@/components/ui/button";
import {
  fetchHoursSettings,
  type HoursSettingsResultType,
} from "@/lib/api-client/settings/fetch-hours-settings";

export function SettingsScreen() {
  const [result, setResult] = useState<HoursSettingsResultType | null>(null);
  const [attempt, setAttempt] = useState(0); // Try again asks once more

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;
    fetchHoursSettings().then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, [attempt]);
  const tryAgain = () => {
    setResult(null);
    setAttempt((count) => count + 1);
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        What you change yourself. Nobody at the agency needs to touch anything for this.
      </p>

      <div className="mt-8 grid items-start gap-6 md:grid-cols-[140px_minmax(0,1fr)]">
        {/* Each later Settings feature (12d onward) adds its own section here. */}
        <nav
          aria-label="Settings sections"
          className="flex flex-wrap gap-1 md:sticky md:top-6 md:flex-col"
        >
          <a
            href="#hours"
            aria-current="page"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-[var(--accent-soft)] aria-[current=page]:font-medium aria-[current=page]:text-primary"
          >
            Hours
          </a>
        </nav>

        <section id="hours" aria-labelledby="hours-title" className="min-w-0">
          <h2
            id="hours-title"
            className="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Hours
          </h2>
          <div className="mt-3">
            {!result ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : result.state === "signed-out" || result.state === "refused" ? (
              <RefusalNotice refusal={result} />
            ) : result.state === "unreachable" ? (
              <div className="flex flex-col items-start gap-3">
                <CentredCardNotice>{result.message}</CentredCardNotice>
                <Button variant="outline" onClick={tryAgain}>
                  Try again
                </Button>
              </div>
            ) : (
              <HoursSection settings={result.answer} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function HoursSection({
  settings,
}: {
  settings: Extract<HoursSettingsResultType, { state: "ok" }>["answer"];
}) {
  // Saved here too, so people's cards appear after the business's first save and copy its week.
  const [business, setBusiness] = useState(settings.business);

  return (
    <div className="flex flex-col gap-4">
      {!settings.canEdit ? (
        <CentredCardNotice tone="info">
          Your role cannot change the hours. You can see them here.
        </CentredCardNotice>
      ) : null}
      <BusinessHoursCard initial={business} canEdit={settings.canEdit} onSaved={setBusiness} />

      <h3 className="mt-4 text-sm font-semibold text-foreground">Each person</h3>
      {!business ? (
        <p className="text-sm text-muted-foreground">
          Set the business&apos;s hours first. Then each person can follow them or keep their own.
        </p>
      ) : settings.people.length === 0 ? (
        <p className="text-sm text-muted-foreground">No people yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {settings.people.map((person) => (
            <PersonHoursCard
              key={person.id}
              person={person}
              businessWeek={business.weeklyHours}
              timezone={business.timezone}
              canEdit={settings.canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
