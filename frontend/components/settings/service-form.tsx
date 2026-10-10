// Frontend component: the form that adds or changes one service on the Services page (feature 12d).
// Who picks the person and whether it asks the address start unpicked: the business chooses. Who
// does it (the ticks) is saved just after the service, by its own call.

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, type DefaultValues } from "react-hook-form";

import {
  serviceValidationSchema,
  type ServiceInputType,
  type ServiceType,
} from "@scheduleads-app/shared/zod-validation";

import { ChoiceField } from "@/components/settings/choice-field";
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
import { saveServiceResources } from "@/lib/api-client/settings/save-service-resources";
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
// How a save ended: whether who does it saved too, and the bookings a new length no longer fits.
export type ServiceSaveOutcomeType = {
  ticksSaved: boolean;
  outsideHours: SavedServiceType["outsideHours"];
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
    asksAddress: service.asksAddress,
    active: service.active,
  };
}

export function ServiceForm({
  service,
  people,
  onSaved,
  onCancel,
}: {
  service: ServiceSettingsType | null; // null: a new one
  people: ServicesSettingsType["people"]; // every person and place, to tick
  onSaved: (saved: ServiceSettingsType, outcome: ServiceSaveOutcomeType) => void;
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const form = useForm<ServiceInputType, unknown, ServiceType>({
    resolver: zodResolver(serviceValidationSchema),
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
  const outsideHours = useRef<ServiceSaveOutcomeType["outsideHours"]>([]); // from the last save

  useEffect(() => nameRef.current?.focus(), []); // the form opens where the owner will type

  // The failed message clears on the next edit.
  const edited =
    <Value,>(onChange: (value: Value) => void) =>
    (value: Value) => {
      setNotice(null);
      onChange(value);
    };

  async function save(values: ServiceType) {
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
    const savedNow = saved.answer.service;
    savedService.current = savedNow;
    outsideHours.current = saved.answer.outsideHours;
    if (
      sameIds(savedNow.peopleIds, ticks.peopleIds) &&
      sameIds(savedNow.placeIds, ticks.placeIds)
    ) {
      onSaved(savedNow, { ticksSaved: true, outsideHours: outsideHours.current });
      return;
    }

    const ticked = await saveServiceResources(savedNow.id, ticks);
    if (ticked.state === "ok") {
      onSaved(
        { ...savedNow, ...ticked.answer },
        { ticksSaved: true, outsideHours: outsideHours.current }
      );
      return;
    }
    if (ticked.state === "field") {
      setTicksError({ field: ticked.field, message: ticked.message });
      focusFirstInvalid();
    }
    setNotice({
      tone: "error",
      text: `${savedNow.name} is saved, but who does it is not: ${ticked.message}`,
    });
  }

  const editTicks = (ticked: TicksType) => {
    setNotice(null);
    setTicksError(null);
    setTicks(ticked);
  };
  // A service saved whose ticks then failed still reaches the list, as saved, when the form closes.
  const cancel = () =>
    savedService.current && savedService.current !== service
      ? onSaved(savedService.current, { ticksSaved: false, outsideHours: outsideHours.current })
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
        {service ? `Change ${service.name}` : "Add a service"}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idBase}-name`}>Name</Label>
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
          <Label htmlFor={`${idBase}-description`}>Description (optional)</Label>
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
              label="Length, in minutes"
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
              label="Free time before"
              value={field.value}
              onChange={edited(field.onChange)}
              error={fieldState.error?.message}
              hint="Kept clear, never booked; 0 for none."
            />
          )}
        />
        <Controller
          name="bufferAfterMinutes"
          control={form.control}
          render={({ field, fieldState }) => (
            <MinutesField
              id={`${idBase}-after`}
              label="Free time after"
              value={field.value}
              onChange={edited(field.onChange)}
              error={fieldState.error?.message}
              hint="Travel or clean-up; 0 for none."
            />
          )}
        />
      </div>

      <Controller
        name="slotIntervalMinutes"
        control={form.control}
        render={({ field, fieldState }) => (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">Start times</legend>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${idBase}-starts`}
                  checked={field.value === null}
                  onChange={() => edited(field.onChange)(null)}
                  className="accent-[var(--primary)]"
                />
                One after another, every service length
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
                  Every
                </label>
                {/* Its own field beside the choice; typing a number picks "Every". */}
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  aria-label="Start times every how many minutes"
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
                minutes
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
            legend="Who picks the person"
            choices={[
              { value: "customer_picks", label: "The customer picks who does it" },
              { value: "business_assigns", label: "We send whoever is free" },
            ]}
            value={field.value}
            onChange={edited(field.onChange)}
            error={fieldState.error?.message}
          />
        )}
      />
      <TicksField
        name={`${idBase}-people`}
        legend="Who does it"
        noneTicked="Nobody ticked: anyone can do it."
        allTickedOff="Everyone ticked is off, so nobody is offered for it."
        noneToTick="No people yet."
        choices={people.filter((resource) => resource.kind === "person")}
        value={ticks.peopleIds}
        onChange={(peopleIds) => editTicks({ ...ticks, peopleIds })}
        error={ticksError?.field === "peopleIds" ? ticksError.message : undefined}
      />
      <TicksField
        name={`${idBase}-places`}
        legend="Places it needs"
        noneTicked="No place ticked: no room needed."
        allTickedOff="Every place ticked is off, so it cannot be booked."
        noneToTick="No places yet."
        choices={people.filter((resource) => resource.kind === "place")}
        value={ticks.placeIds}
        onChange={(placeIds) => editTicks({ ...ticks, placeIds })}
        error={ticksError?.field === "placeIds" ? ticksError.message : undefined}
      />
      <Controller
        name="asksAddress"
        control={form.control}
        render={({ field, fieldState }) => (
          <ChoiceField
            name={`${idBase}-asks-address`}
            legend="Asks the customer's address"
            choices={[
              { value: true, label: "Yes, we go to them" },
              { value: false, label: "No" },
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
            Live: customers can book it. Off hides it; bookings already made stay.
          </label>
        )}
      />

      <SaveNotice notice={notice} />
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : service ? "Save service" : "Add service"}
        </Button>
        <Button type="button" variant="outline" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
