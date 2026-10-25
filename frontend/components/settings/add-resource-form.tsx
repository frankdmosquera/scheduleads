// Frontend component: the form that adds a person on the People page or a place on the Places page
// (features 12d and 12k). The kind is the page's, and never changes (decision 4); a new person
// follows the business's week.

"use client";

import { dashboardFormResolver } from "@/lib/dashboard-form-resolver";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import {
  addResourceValidationSchema,
  type AddResourceInputType,
  type AddResourceType,
} from "@scheduleads-app/shared/zod-validation";

import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResourceSettingsType } from "@/lib/api-client/settings/fetch-people-settings";
import { addResource } from "@/lib/api-client/settings/save-resource";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import { useReportSaving } from "@/lib/use-report-saving";
import { useFocusFirstInvalid } from "@/lib/use-focus-first-invalid";

export function AddResourceForm({
  kind,
  onSaved,
  onCancel,
  onSavingChange,
}: {
  kind: AddResourceType["kind"];
  onSaved: (added: ResourceSettingsType) => void;
  onCancel: () => void;
  onSavingChange?: (saving: boolean) => void; // while true, the page opens no other card
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const focusFirstInvalid = useFocusFirstInvalid(formRef);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const { peopleWords } = useDashboardWords().words;
  const form = useForm<AddResourceInputType, unknown, AddResourceType>({
    resolver: dashboardFormResolver(addResourceValidationSchema),
    defaultValues: { name: "", kind },
  });

  useEffect(() => nameRef.current?.focus(), []); // the form opens where the owner will type
  useReportSaving(form.formState.isSubmitting, onSavingChange);

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
        {peopleWords.addTitle(kind)}
      </h3>
      <div className="flex flex-col gap-1.5 sm:max-w-sm">
        <Label htmlFor="add-resource-name">{peopleWords.name}</Label>
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
      <SaveNotice notice={notice} />
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? peopleWords.adding : peopleWords.add}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={form.formState.isSubmitting}
          onClick={onCancel}
        >
          {peopleWords.cancel}
        </Button>
      </div>
    </form>
  );
}
