// Frontend component: the holiday picker on the Days off page (feature 12e). The owner picks the
// country and the province (nothing picked to start with), then ticks the holidays to close, or
// presses "Close all main holidays". A pick the holiday list no longer has is shown, to untick.

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { DaysOffSettingsType } from "@/lib/api-client/settings/fetch-days-off";
import {
  fetchHolidayChoices,
  type HolidayChoicesType,
  type HolidayChoiceType,
} from "@/lib/api-client/settings/fetch-holiday-choices";
import { saveDaysOff, type SavedDaysOffType } from "@/lib/api-client/settings/save-days-off";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

type FieldType = "holidayCountry" | "holidayRegion" | "closedHolidays";

// "Mon, Oct 12, 2026"; two dates when the holiday falls twice in the year shown.
const formatDates = (dates: string[]) =>
  dates
    .map((date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${date}T12:00:00Z`))
    )
    .join(" and ");

const selectClass =
  "h-10 rounded-lg border border-input bg-muted px-3 text-sm aria-invalid:border-destructive disabled:opacity-60";

export function HolidayPicker({
  daysOff,
  canEdit,
  onSaved,
}: {
  daysOff: DaysOffSettingsType;
  canEdit: boolean;
  onSaved: (answer: SavedDaysOffType) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [country, setCountry] = useState(daysOff.holidayCountry);
  const [region, setRegion] = useState(daysOff.holidayRegion);
  const [picks, setPicks] = useState(daysOff.closedHolidays);
  const [countries, setCountries] = useState<HolidayChoicesType["countries"]>([]);
  // The list read for one country and province; shown only while those are still the ones picked.
  const [choices, setChoices] = useState<(HolidayChoicesType & { key: string }) | null>(null);
  const key = `${country ?? ""}-${region ?? ""}`;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldType, string>>>({});
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const [saving, setSaving] = useState(false);
  // A new province keeps only the picks its list has; the saved picks are kept as they are, so a
  // renamed one shows.
  const prune = useRef(false);

  useEffect(() => {
    let current = true;
    fetchHolidayChoices(country, region).then((read) => {
      if (!current) return;
      if (read.state !== "ok") {
        setLoadError(read.message);
        return;
      }
      setLoadError(null);
      setCountries(read.answer.countries);
      setChoices({ ...read.answer, key: `${country ?? ""}-${region ?? ""}` });
      if (prune.current) {
        const known = new Set(read.answer.holidays.map((holiday) => holiday.name));
        setPicks((ticked) => ticked.filter((name) => known.has(name)));
        prune.current = false;
      }
    });
    return () => {
      current = false;
    };
  }, [country, region]);

  const edited = () => {
    setNotice(null);
    setErrors({});
  };
  const pickCountry = (code: string) => {
    edited();
    setCountry(code || null);
    setRegion(null);
    setPicks([]); // another country's holidays are not this one's
  };
  const pickRegion = (code: string) => {
    edited();
    prune.current = true;
    setRegion(code || null);
  };
  const tick = (name: string, on: boolean) => {
    edited();
    setPicks((ticked) => (on ? [...ticked, name] : ticked.filter((picked) => picked !== name)));
  };

  const ready = choices?.key === key ? choices : null;
  const holidays = ready?.holidays ?? [];
  const main = holidays.filter((holiday) => holiday.main);
  const others = holidays.filter((holiday) => !holiday.main);
  const known = new Set(holidays.map((holiday) => holiday.name));
  // Only once the list has loaded, so a pick is never marked while it is still coming.
  const gone = ready && country ? picks.filter((name) => !known.has(name)) : [];
  const closeAllMain = () => {
    edited();
    setPicks((ticked) => [...new Set([...ticked, ...main.map((holiday) => holiday.name)])]);
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const saved = await saveDaysOff({
      closedDates: daysOff.closedDates,
      holidayCountry: country,
      holidayRegion: region,
      closedHolidays: picks,
    });
    setSaving(false);
    if (saved.state === "ok") {
      onSaved(saved.answer);
      const count = saved.answer.newlyClosed.length;
      setNotice({
        tone: "info",
        text: `Saved the holidays.${
          count
            ? ` ${count === 1 ? "One booking stays" : `${count} bookings stay`} on a closed day, listed at the top.`
            : ""
        }`,
      });
      return;
    }
    if (saved.state === "field" && saved.field in FIELD_IDS) {
      setErrors({ [saved.field]: saved.message });
      focusFirstInvalid();
      return;
    }
    setNotice({ tone: "error", text: saved.message });
  }

  const errorProps = (field: FieldType) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `${FIELD_IDS[field]}-error` } : {};
  const errorLine = (field: FieldType) =>
    errors[field] ? (
      <p id={`${FIELD_IDS[field]}-error`} className="text-xs text-destructive">
        {errors[field]}
      </p>
    ) : null;

  const tickBox = (holiday: HolidayChoiceType, index: number) => (
    <label key={holiday.name} className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={picks.includes(holiday.name)}
        disabled={!canEdit}
        onChange={(event) => tick(holiday.name, event.target.checked)}
        // The first box carries a refused save, so the focus lands in the list.
        {...(index === 0 && gone.length === 0 ? errorProps("closedHolidays") : {})}
        className="mt-0.5 size-4 accent-[var(--primary)]"
      />
      <span>
        <span className="text-foreground">{holiday.name}</span>{" "}
        <span className="text-muted-foreground">{formatDates(holiday.dates)}</span>
      </span>
    </label>
  );

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={save}
      aria-labelledby="holidays-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h3 id="holidays-title" className="text-base font-semibold tracking-tight text-foreground">
          Holidays
        </h3>
        <p className="text-sm text-muted-foreground">
          Ticked holidays are closed for online booking every year, until unticked.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={FIELD_IDS.holidayCountry}>Country</Label>
          <select
            id={FIELD_IDS.holidayCountry}
            value={country ?? ""}
            disabled={!canEdit}
            onChange={(event) => pickCountry(event.target.value)}
            {...errorProps("holidayCountry")}
            className={selectClass}
          >
            <option value="">No holidays</option>
            {countries.map((place) => (
              <option key={place.code} value={place.code}>
                {place.name}
              </option>
            ))}
          </select>
          {errorLine("holidayCountry")}
        </div>
        {country && ready?.regions.length ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={FIELD_IDS.holidayRegion}>Province or state</Label>
            <select
              id={FIELD_IDS.holidayRegion}
              value={region ?? ""}
              disabled={!canEdit}
              onChange={(event) => pickRegion(event.target.value)}
              {...errorProps("holidayRegion")}
              className={selectClass}
            >
              <option value="">Country&apos;s holidays only</option>
              {ready.regions.map((place) => (
                <option key={place.code} value={place.code}>
                  {place.name}
                </option>
              ))}
            </select>
            {errorLine("holidayRegion")}
          </div>
        ) : null}
      </div>

      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

      {country && ready ? (
        <div role="group" aria-labelledby="holidays-title" className="flex flex-col gap-4 text-sm">
          {gone.length ? (
            <div className="flex flex-col gap-2">
              <p className="font-medium text-foreground">No longer in the holiday list</p>
              <p className="text-xs text-muted-foreground">
                Picked before, these close nothing now. Untick them to save.
              </p>
              {gone.map((name, index) => (
                <label key={name} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked
                    disabled={!canEdit}
                    onChange={() => tick(name, false)}
                    // A refused save is about these first, so the focus lands here.
                    {...(index === 0 ? errorProps("closedHolidays") : {})}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="text-muted-foreground">{name}</span>
                </label>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-medium text-foreground">Main holidays</p>
              {canEdit && main.length ? (
                <Button type="button" variant="outline" size="sm" onClick={closeAllMain}>
                  Close all main holidays
                </Button>
              ) : null}
            </div>
            {main.map(tickBox)}
          </div>
          {others.length ? (
            <div className="flex flex-col gap-2">
              <p className="font-medium text-foreground">Other days</p>
              {others.map((holiday) => tickBox(holiday, -1))}
            </div>
          ) : null}
          {errorLine("closedHolidays")}
        </div>
      ) : null}

      <SaveNotice notice={notice} />
      {canEdit ? (
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save holidays"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

const FIELD_IDS: Record<FieldType, string> = {
  holidayCountry: "holiday-country",
  holidayRegion: "holiday-region",
  closedHolidays: "holiday-picks",
};
