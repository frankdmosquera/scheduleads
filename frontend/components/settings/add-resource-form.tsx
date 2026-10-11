// Frontend component: the form that adds a person or a place on the People page (feature 12d). The
// kind is picked here, once (decision 4); a new person follows the business's week.

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  addResourceValidationSchema,
  type AddResourceInputType,
  type AddResourceType,
} from "@scheduleads-app/shared/zod-validation";

import { ChoiceField } from "@/components/settings/choice-field";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResourceSettingsType } from "@/lib/api-client/settings/fetch-people-settings";
import { addResource } from "@/lib/api-client/settings/save-resource";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

export function AddResourceForm({
  onSaved,
  onCancel,
}: {
  onSaved: (added: ResourceSettingsType) => void;
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const form = useForm<AddResourceInputType, unknown, AddResourceType>({
    resolver: zodResolver(addResourceValidationSchema),
    defaultValues: { name: "" }, // person or place: unpicked, the owner says which
  });

  useEffect(() => nameRef.current?.focus(), []); // the form opens where the owner will type

  async function save(values: AddResourceType) {
    const saved = await addResource(values);
    if (saved.state === "ok") {
      onSaved(saved.answer.resource);
      return;
    }
    if (saved.state === "field") {
      form.setError(saved.field as "name", { message: saved.message });
      focusFirstInvalid();
      return;
    }
    setNotice({ tone: "error", text: saved.message });
  }

  const nameError = form.formState.errors.name?.message;
  const { ref: nameFieldRef, ...nameField } = form.register("name", {
    onChange: () => setNotice(null),
  });

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => form.handleSubmit(save, () => focusFirstInvalid())(event)}
      aria-labelledby="add-resource-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-md)] md:p-6"
    >
      <h3
        id="add-resource-title"
        className="text-base font-semibold tracking-tight text-foreground"
      >
        Add a person or a place
      </h3>
      <div className="flex flex-col gap-1.5 sm:max-w-sm">
        <Label htmlFor="add-resource-name">Name</Label>
        <Input
          id="add-resource-name"
          {...nameField}
          ref={(element) => {
            nameFieldRef(element);
            nameRef.current = element;
          }}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "add-resource-name-error" : undefined}
          className="h-10 bg-muted px-3"
        />
        {nameError ? (
          <p id="add-resource-name-error" className="text-xs text-destructive">
            {nameError}
          </p>
        ) : null}
      </div>
      <Controller
        name="kind"
        control={form.control}
        render={({ field, fieldState }) => (
          <ChoiceField
            name="add-resource-kind"
            legend="A person or a place"
            choices={[
              { value: "person", label: "A person, who can be booked" },
              { value: "place", label: "A place, a room or a chair a service needs" },
            ]}
            value={field.value}
            onChange={(kind) => {
              setNotice(null);
              field.onChange(kind);
            }}
            error={fieldState.error?.message}
          />
        )}
      />
      <SaveNotice notice={notice} />
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Adding…" : "Add"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
