// Frontend component: the form that renames a person or place, or turns one off or on, on the People
// page (feature 12d). Off never touches a booking; the page lists the ones they still hold. A person
// also has an optional work email at the business's own domain (12d.4).

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  saveResourceValidationSchema,
  type SaveResourceInputType,
  type SaveResourceType,
} from "@scheduleads-app/shared/zod-validation";

import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResourceSettingsType } from "@/lib/api-client/settings/fetch-people-settings";
import { saveResource, type SavedResourceType } from "@/lib/api-client/settings/save-resource";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

export function ChangeResourceForm({
  resource,
  senderDomain,
  onSaved,
  onCancel,
}: {
  resource: ResourceSettingsType;
  senderDomain: string | null; // the domain a work email must be at; null: none can be set yet
  onSaved: (answer: SavedResourceType) => void;
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const form = useForm<SaveResourceInputType, unknown, SaveResourceType>({
    resolver: zodResolver(saveResourceValidationSchema),
    // A place sends no work email at all, so saving one never touches the column.
    defaultValues:
      resource.kind === "person"
        ? { name: resource.name, active: resource.active, workEmail: resource.workEmail ?? "" }
        : { name: resource.name, active: resource.active },
  });
  const idBase = `resource-${resource.id}`;

  useEffect(() => nameRef.current?.focus(), []); // the form opens where the owner will type

  async function save(values: SaveResourceType) {
    const saved = await saveResource(resource.id, values);
    if (saved.state === "ok") {
      onSaved(saved.answer);
      return;
    }
    if (saved.state === "field") {
      form.setError(saved.field as "name" | "workEmail", { message: saved.message });
      focusFirstInvalid();
      return;
    }
    setNotice({ tone: "error", text: saved.message });
  }

  const nameError = form.formState.errors.name?.message;
  const workEmailError = form.formState.errors.workEmail?.message;
  const { ref: nameFieldRef, ...nameField } = form.register("name", {
    onChange: () => setNotice(null),
  });
  const kind = resource.kind === "person" ? "person" : "place";

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => form.handleSubmit(save, () => focusFirstInvalid())(event)}
      aria-labelledby={`${idBase}-title`}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-md)] md:p-6"
    >
      <h3 id={`${idBase}-title`} className="text-base font-semibold tracking-tight text-foreground">
        Change {resource.name}, a {kind}
      </h3>
      <div className="flex flex-col gap-1.5 sm:max-w-sm">
        <Label htmlFor={`${idBase}-name`}>Name</Label>
        <Input
          id={`${idBase}-name`}
          {...nameField}
          ref={(element) => {
            nameFieldRef(element);
            nameRef.current = element;
          }}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${idBase}-name-error` : undefined}
          className="h-10 bg-muted px-3"
        />
        {nameError ? (
          <p id={`${idBase}-name-error`} className="text-xs text-destructive">
            {nameError}
          </p>
        ) : null}
      </div>
      {resource.kind === "person" ? (
        <div className="flex flex-col gap-1.5 sm:max-w-sm">
          <Label htmlFor={`${idBase}-work-email`}>Work email (optional)</Label>
          <Input
            id={`${idBase}-work-email`}
            type="email"
            disabled={!senderDomain}
            {...form.register("workEmail", { onChange: () => setNotice(null) })}
            aria-invalid={workEmailError ? true : undefined}
            aria-describedby={
              workEmailError ? `${idBase}-work-email-error` : `${idBase}-work-email-hint`
            }
            className="h-10 bg-muted px-3"
          />
          {workEmailError ? (
            <p id={`${idBase}-work-email-error`} className="text-xs text-destructive">
              {workEmailError}
            </p>
          ) : (
            <p id={`${idBase}-work-email-hint`} className="text-xs text-muted-foreground">
              {senderDomain
                ? `At ${senderDomain}. Customers' replies reach them, and they get their own email for each new booking.`
                : "The business has no sending address yet, so no work email can be saved."}
            </p>
          )}
        </div>
      ) : null}
      <Controller
        name="active"
        control={form.control}
        render={({ field }) => (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={field.value}
              onChange={(event) => {
                setNotice(null);
                field.onChange(event.target.checked);
              }}
              className="size-4 accent-[var(--primary)]"
            />
            On: can be booked. Off stops new bookings; the ones already made stay.
          </label>
        )}
      />
      <SaveNotice notice={notice} />
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
