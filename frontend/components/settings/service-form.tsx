// Frontend component: the card that adds or changes one service on the Services page (feature 12d).
// Who picks the person and whether it asks the address start unpicked: the business chooses. One
// Save saves the service, then who does it (the ticks) and when it runs (feature 12k), each by its
// own call. A login that may not change the business sees it read-only, with Close.

"use client";

import { dashboardFormResolver } from "@/lib/dashboard-form-resolver";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, type DefaultValues } from "react-hook-form";

import {
  serviceValidationSchema,
  type PersonHoursType,
  type ServiceInputType,
  type ServiceType,
  type WeeklyHoursType,
} from "@scheduleads-app/shared/zod-validation";

import { ChoiceField } from "@/components/settings/choice-field";
import type { ListedBookingsType } from "@/components/settings/listed-bookings";
import { OwnHoursPart, type OwnHoursPartHandleType } from "@/components/settings/own-hours-part";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { TicksField } from "@/components/settings/ticks-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ServiceSettingsType,
  ServicesSettingsType,
} from "@/lib/api-client/settings/fetch-services-settings";
import { saveService, type SavedServiceType } from "@/lib/api-client/settings/save-service";
import { saveServiceHours } from "@/lib/api-client/settings/save-service-hours";
import { saveServiceResources } from "@/lib/api-client/settings/save-service-resources";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

const NEW_SERVICE: DefaultValues<ServiceInputType> = {
  name: "",
  description: "",
  durationMinutes: Number.NaN, // empty: the owner types it
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  slotIntervalMinutes: null,
  active: true,
};

// A number field kept as a number; an empty field is NaN, which the schema refuses with its message.
function MinutesField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (minutes: number) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={1440}
        value={Number.isNaN(value) ? "" : value}
        onChange={(event) =>
          onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="h-10 bg-muted px-3"
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// Only what the form edits: the schema is strict, so the id and slug must not ride along.
type TicksType = { peopleIds: string[]; placeIds: string[] };
// How a save ended: what of the card was not saved, if anything, and the bookings to call about.
export type ServiceSaveOutcomeType = {
  unsaved: "ticks" | "hours" | null;
  noLongerFit: SavedServiceType["outsideHours"]; // at a new length
  outsideItsHours: ListedBookingsType["bookings"]; // after new hours
};
const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

function formValuesOf(service: ServiceSettingsType): ServiceInputType {
  return {
    name: service.name,
    description: service.description ?? "",
    durationMinutes: service.durationMinutes,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    slotIntervalMinutes: service.slotIntervalMinutes,
    personChoice: service.personChoice,
    addressMode: service.addressMode,
    active: service.active,
  };
}

export function ServiceForm({
  service,
  people,
  hours,
  businessWeek,
  onHoursSaved,
  onSaved,
  onCancel,
  canEdit = true,
}: {
  service: ServiceSettingsType | null; // null: a new one
  people: ServicesSettingsType["people"]; // every person and place, to tick
  // When it runs; null shows no hours part: a new service runs whenever the business is open.
  hours: PersonHoursType | null;
  businessWeek: WeeklyHoursType | null; // copied in when it starts its own week
  onHoursSaved: (hours: PersonHoursType) => void;
  onSaved: (saved: ServiceSettingsType, outcome: ServiceSaveOutcomeType) => void;
  onCancel: () => void;
  // false: a login that may not change the business sees the card read-only, with Close.
  canEdit?: boolean;
}) {
  const { words } = useDashboardWords();
  const servicesWords = words.servicesWords;
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hoursPart = useRef<OwnHoursPartHandleType>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const form = useForm<ServiceInputType, unknown, ServiceType>({
    resolver: dashboardFormResolver(serviceValidationSchema),
    defaultValues: service ? formValuesOf(service) : NEW_SERVICE,
  });
  const idBase = `service-${service?.id ?? "new"}`;
  const [ticks, setTicks] = useState<TicksType>({
    peopleIds: service?.peopleIds ?? [],
    placeIds: service?.placeIds ?? [],
  });
  const [ticksError, setTicksError] = useState<{ field: string; message: string } | null>(null);
  // A new service whose ticks failed to save already exists: saving again changes it, never adds it twice.
  const savedService = useRef<ServiceSettingsType | null>(service);
  const outsideHours = useRef<ServiceSaveOutcomeType["noLongerFit"]>([]); // from the last save
  const lastSavedLength = useRef<number | null>(null);
  // Every booking this card's hours saves left outside, each once, until the card closes.
  const outsideItsHours = useRef<ServiceSaveOutcomeType["outsideItsHours"]>([]);
  // What a refusal left unsaved, said when the card closes with the rest already saved.
  const unsaved = useRef<ServiceSaveOutcomeType["unsaved"]>(null);
  const outcome = (): ServiceSaveOutcomeType => ({
    unsaved: unsaved.current,
    noLongerFit: outsideHours.current,
    outsideItsHours: outsideItsHours.current,
  });

  // The form opens where the owner will type; read-only, on its Close.
  useEffect(() => (canEdit ? nameRef.current : closeRef.current)?.focus(), [canEdit]);

  // The failed message clears on the next edit.
  const edited =
    <Value,>(onChange: (value: Value) => void) =>
    (value: Value) => {
      setNotice(null);
      onChange(value);
    };

  async function save(values: ServiceType) {
    // This card's own hours part for the whole Save, even if another card opens meanwhile.
    const hoursNow = hoursPart.current;
    if (hoursNow && !(await hoursNow.check())) return;
    const saved = await saveService(savedService.current?.id ?? null, values);
    if (saved.state === "field") {
      form.setError(saved.field as "name", { message: saved.message });
      focusFirstInvalid();
      return;
    }
    if (saved.state !== "ok") {
      setNotice({ tone: "error", text: saved.message });
      return;
    }
    let savedNow = saved.answer.service;
    savedService.current = savedNow;
    // A save again at the same length, after its ticks failed, finds the length unchanged and lists
    // nothing, yet the last list still holds; a new length gets its own list.
    if (savedNow.durationMinutes !== lastSavedLength.current) {
      outsideHours.current = saved.answer.outsideHours;
    }
    lastSavedLength.current = savedNow.durationMinutes;
    if (
      !sameIds(savedNow.peopleIds, ticks.peopleIds) ||
      !sameIds(savedNow.placeIds, ticks.placeIds)
    ) {
      const ticked = await saveServiceResources(savedNow.id, ticks);
      if (ticked.state !== "ok") {
        unsaved.current = "ticks";
        if (ticked.state === "field") {
          setTicksError({ field: ticked.field, message: ticked.message });
          focusFirstInvalid();
        }
        setNotice({
          tone: "error",
          text: servicesWords.ticksNotSaved(savedNow.name, ticked.message),
        });
        return;
      }
      savedNow = { ...savedNow, ...ticked.answer };
      savedService.current = savedNow;
    }
    // A refused hours save shows its own error in its part, and the card stays open on it.
    if (hoursNow && !(await hoursNow.save())) {
      unsaved.current = "hours";
      return;
    }
    unsaved.current = null;
    onSaved(savedNow, outcome());
  }

  const hoursSaved = (saved: PersonHoursType, outside: ListedBookingsType["bookings"]) => {
    const listed = new Set(outsideItsHours.current.map((booking) => booking.bookingId));
    outsideItsHours.current = [
      ...outsideItsHours.current,
      ...outside.filter((booking) => !listed.has(booking.bookingId)),
    ];
    onHoursSaved(saved);
  };

  const editTicks = (ticked: TicksType) => {
    setNotice(null);
    setTicksError(null);
    setTicks(ticked);
  };
  // A service saved whose ticks or hours then failed still reaches the list, as saved, when the
  // card closes, with the bookings its saves left to call about.
  const cancel = () =>
    savedService.current && savedService.current !== service
      ? onSaved(savedService.current, outcome())
      : onCancel();

  const errors = form.formState.errors;
  const { ref: nameFieldRef, ...nameField } = form.register("name", {
    onChange: () => setNotice(null),
  });

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => form.handleSubmit(save, () => focusFirstInvalid())(event)}
      aria-labelledby={`${idBase}-title`}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-md)] md:p-6"
    >
      <h3 id={`${idBase}-title`} className="text-base font-semibold tracking-tight text-foreground">
        {!service
          ? servicesWords.addTitle
          : canEdit
            ? servicesWords.changeService(service.name)
            : servicesWords.seeService(service.name)}
      </h3>

      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idBase}-name`}>{servicesWords.name}</Label>
            <Input
              id={`${idBase}-name`}
              {...nameField}
              ref={(element) => {
                nameFieldRef(element);
                nameRef.current = element;
              }}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${idBase}-name-error` : undefined}
              className="h-10 bg-muted px-3"
            />
            {errors.name ? (
              <p id={`${idBase}-name-error`} className="text-xs text-destructive">
                {errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idBase}-description`}>{servicesWords.descriptionOptional}</Label>
            <Input
              id={`${idBase}-description`}
              {...form.register("description", { onChange: () => setNotice(null) })}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={errors.description ? `${idBase}-description-error` : undefined}
              className="h-10 bg-muted px-3"
            />
            {errors.description ? (
              <p id={`${idBase}-description-error`} className="text-xs text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            name="durationMinutes"
            control={form.control}
            render={({ field, fieldState }) => (
              <MinutesField
                id={`${idBase}-length`}
                label={servicesWords.lengthInMinutes}
                value={field.value}
                onChange={edited(field.onChange)}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="bufferBeforeMinutes"
            control={form.control}
            render={({ field, fieldState }) => (
              <MinutesField
                id={`${idBase}-before`}
                label={servicesWords.freeBefore}
                value={field.value}
                onChange={edited(field.onChange)}
                error={fieldState.error?.message}
                hint={servicesWords.freeBeforeHint}
              />
            )}
          />
          <Controller
            name="bufferAfterMinutes"
            control={form.control}
            render={({ field, fieldState }) => (
              <MinutesField
                id={`${idBase}-after`}
                label={servicesWords.freeAfter}
                value={field.value}
                onChange={edited(field.onChange)}
                error={fieldState.error?.message}
                hint={servicesWords.freeAfterHint}
              />
            )}
          />
        </div>

        <Controller
          name="slotIntervalMinutes"
          control={form.control}
          render={({ field, fieldState }) => (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-foreground">
                {servicesWords.startTimes}
              </legend>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${idBase}-starts`}
                    checked={field.value === null}
                    onChange={() => edited(field.onChange)(null)}
                    className="accent-[var(--primary)]"
                  />
                  {servicesWords.oneAfterAnother}
                </label>
                <span className="flex items-center gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`${idBase}-starts`}
                      checked={field.value !== null}
                      onChange={() => edited(field.onChange)(field.value ?? Number.NaN)}
                      className="accent-[var(--primary)]"
                    />
                    {servicesWords.every}
                  </label>
                  {/* Its own field beside the choice; typing a number picks "Every". */}
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    aria-label={servicesWords.everyHowManyMinutes}
                    value={field.value === null || Number.isNaN(field.value) ? "" : field.value}
                    onChange={(event) =>
                      edited(field.onChange)(
                        event.target.value === "" ? Number.NaN : Number(event.target.value)
                      )
                    }
                    aria-invalid={fieldState.error ? true : undefined}
                    aria-describedby={fieldState.error ? `${idBase}-starts-error` : undefined}
                    className="h-8 w-20 bg-muted px-2"
                  />
                  {servicesWords.minutesWord}
                </span>
              </div>
              {fieldState.error ? (
                <p id={`${idBase}-starts-error`} className="text-xs text-destructive">
                  {fieldState.error.message}
                </p>
              ) : null}
            </fieldset>
          )}
        />

        <Controller
          name="personChoice"
          control={form.control}
          render={({ field, fieldState }) => (
            <ChoiceField
              name={`${idBase}-person-choice`}
              legend={servicesWords.whoPicksThePerson}
              choices={[
                { value: "customer_picks", label: servicesWords.customerPicks },
                { value: "business_assigns", label: servicesWords.weSendWhoeverIsFree },
              ]}
              value={field.value}
              onChange={edited(field.onChange)}
              error={fieldState.error?.message}
            />
          )}
        />
        <TicksField
          name={`${idBase}-people`}
          legend={servicesWords.whoDoesIt}
          noneTicked={servicesWords.nobodyTicked}
          allTickedOff={servicesWords.everyoneTickedOff}
          noneToTick={servicesWords.nobodyCanDoIt}
          linkLabel={words.settingsFrameWords.tickItOnPeople}
          note={servicesWords.whoDoesItNote}
          states={{ on: servicesWords.offeringIt, off: servicesWords.notOfferingIt }}
          // Only who can do it may be on: their skills are ticked on their card (feature 12k).
          choices={people.filter(
            (resource) =>
              resource.kind === "person" && (service?.ablePeopleIds ?? []).includes(resource.id)
          )}
          value={ticks.peopleIds}
          onChange={(peopleIds) => editTicks({ ...ticks, peopleIds })}
          error={ticksError?.field === "peopleIds" ? ticksError.message : undefined}
        />
        <TicksField
          name={`${idBase}-places`}
          legend={servicesWords.placesItNeeds}
          noneTicked={servicesWords.noPlaceTicked}
          allTickedOff={servicesWords.everyPlaceTickedOff}
          noneToTick={servicesWords.noPlacesYet}
          linkLabel={words.settingsFrameWords.addThemOnPlaces}
          linkHref="/settings/places"
          choices={people.filter((resource) => resource.kind === "place")}
          value={ticks.placeIds}
          onChange={(placeIds) => editTicks({ ...ticks, placeIds })}
          error={ticksError?.field === "placeIds" ? ticksError.message : undefined}
        />
        <Controller
          name="addressMode"
          control={form.control}
          render={({ field, fieldState }) => (
            <ChoiceField
              name={`${idBase}-address-mode`}
              legend={servicesWords.customersAddress}
              choices={[
                { value: "required", label: servicesWords.addressRequired },
                { value: "optional", label: servicesWords.addressOptional },
                { value: "not_asked", label: servicesWords.addressNotAsked },
              ]}
              value={field.value}
              onChange={edited(field.onChange)}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="active"
          control={form.control}
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.value}
                onChange={(event) => edited(field.onChange)(event.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              {servicesWords.liveCheckbox}
            </label>
          )}
        />
        {service && hours && businessWeek ? (
          <OwnHoursPart
            ref={hoursPart}
            idBase={`service-hours-${service.id}`}
            name={service.name}
            title={servicesWords.whenItRuns(service.name)}
            words={{
              follows: servicesWords.runsWhenOpen,
              own: servicesWords.runsOwnWeek,
              weekLabel: servicesWords.whenItRuns,
              datesTitle: servicesWords.itsOneOffDates,
            }}
            hours={hours}
            businessWeek={businessWeek}
            save={async (next) => {
              const saved = await saveServiceHours(service.id, next);
              if (saved.state !== "ok") return saved;
              const { weeklyHours, dateHours } = saved.answer.hours;
              return {
                state: "ok",
                answer: { weeklyHours, dateHours, outsideHours: saved.answer.outsideHours },
              };
            }}
            onSaved={hoursSaved}
          />
        ) : null}
      </fieldset>

      <SaveNotice notice={notice} />
      <div className="flex gap-2">
        {canEdit ? (
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? words.settingsFrameWords.saving
              : service
                ? servicesWords.saveService
                : servicesWords.addService}
          </Button>
        ) : null}
        <Button ref={closeRef} type="button" variant="outline" onClick={cancel}>
          {canEdit ? words.settingsFrameWords.cancel : servicesWords.close}
        </Button>
      </div>
    </form>
  );
}
