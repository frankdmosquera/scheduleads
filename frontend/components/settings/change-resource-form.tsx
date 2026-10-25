// Frontend component: the form that renames a person or place, or turns one off or on, on the People
// page (feature 12d). Off never touches a booking; the page lists the ones they still hold. A person
// also has an optional work email at the business's own domain, and the parts of their card below
// (what they can do, their hours, their texts), saved by the same Save. A login that may not change
// the business sees it read-only, with Close.

"use client";

import { dashboardFormResolver } from "@/lib/dashboard-form-resolver";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

export function ChangeResourceForm({
  resource,
  senderDomain,
  onSaved,
  onCancel,
  beforeSave,
  canEdit = true,
  children,
}: {
  resource: ResourceSettingsType;
  senderDomain: string | null; // the domain a work email must be at; null: none can be set yet
  onSaved: (answer: SavedResourceType) => void;
  onCancel: () => void;
  // A part of the card saved by the same Save, first: false when it was refused, and nothing more
  // is saved, so the card stays open on its errors.
  beforeSave?: () => Promise<boolean>;
  // false: a login that may not change the business sees the card read-only, with Close.
  canEdit?: boolean;
  children?: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const { peopleWords } = useDashboardWords().words;
  const form = useForm<SaveResourceInputType, unknown, SaveResourceType>({
    resolver: dashboardFormResolver(saveResourceValidationSchema),
    // A place sends no work email at all, so saving one never touches the column.
    defaultValues:
      resource.kind === "person"
        ? { name: resource.name, active: resource.active, workEmail: resource.workEmail ?? "" }
        : { name: resource.name, active: resource.active },
  });
  const idBase = `resource-${resource.id}`;

  // The form opens where the owner will type; read-only, on its Close.
  useEffect(() => (canEdit ? nameRef.current : closeRef.current)?.focus(), [canEdit]);

  async function save(values: SaveResourceType) {
    if (beforeSave && !(await beforeSave())) return;
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
        {canEdit
          ? peopleWords.changeTitle(resource.name, kind)
          : peopleWords.seeTitle(resource.name, kind)}
      </h3>
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 sm:max-w-sm">
          <Label htmlFor={`${idBase}-name`}>{peopleWords.name}</Label>
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
            <Label htmlFor={`${idBase}-work-email`}>{peopleWords.workEmail}</Label>
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
                  ? peopleWords.workEmailHint(senderDomain)
                  : peopleWords.noSendingAddress}
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
              {peopleWords.onOffLine}
            </label>
          )}
        />
        {children}
      </fieldset>
      <SaveNotice notice={notice} />
      <div className="flex gap-2">
        {canEdit ? (
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? peopleWords.saving : peopleWords.save}
          </Button>
        ) : null}
        <Button ref={closeRef} type="button" variant="outline" onClick={onCancel}>
          {canEdit ? peopleWords.cancel : peopleWords.close}
        </Button>
      </div>
    </form>
  );
}
