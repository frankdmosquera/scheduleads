// Frontend component: "Add a lead", for a request that came by phone. A name and a way to reach
// them; saving opens the new lead's page. The form carries one request key from the moment it
// opens, so a double click or a retried save gives back the same lead.

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  addLeadValidationSchema,
  type AddLeadInputType,
} from "@scheduleads-app/shared/zod-validation";

import { CentredCardField } from "@/components/centred-card/centred-card-field";
import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addLead } from "@/lib/api-client/leads/add-lead";

const addLeadFields = [
  { name: "name", label: "Name", type: "text", autoComplete: "off" },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "off" },
  { name: "email", label: "Email", type: "email", autoComplete: "off" },
] as const;

export function AddLeadForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | null>(null);

  const form = useForm<AddLeadInputType>({
    resolver: zodResolver(addLeadValidationSchema),
    defaultValues: { requestKey: crypto.randomUUID(), name: "", phone: "", email: "", details: "" },
  });

  async function saveLead(input: AddLeadInputType) {
    setRefusal(null);
    const saved = await addLead(input);
    if (saved.state === "ok") {
      router.push(`/leads/${saved.leadId}${saved.joinedExistingContact ? "?joined=1" : ""}`);
      return;
    }
    if (saved.state === "field") {
      form.setError(saved.field, { message: saved.message }, { shouldFocus: true });
      return;
    }
    setRefusal(saved.message);
  }

  const detailsError = form.formState.errors.details?.message;

  return (
    <form
      onSubmit={form.handleSubmit(saveLead)}
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]"
    >
      <h2 className="text-sm font-semibold text-foreground">Add a lead</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {addLeadFields.map((field) => (
          <Controller
            key={field.name}
            name={field.name}
            control={form.control}
            render={({ field: input, fieldState }) => (
              <CentredCardField
                {...input}
                value={input.value ?? ""}
                id={`add-lead-${field.name}`}
                label={field.label}
                type={field.type}
                autoComplete={field.autoComplete}
                error={fieldState.error?.message}
              />
            )}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="add-lead-details">What they want</Label>
        <textarea
          {...form.register("details")}
          id="add-lead-details"
          rows={3}
          aria-invalid={detailsError ? true : undefined}
          aria-describedby={detailsError ? "add-lead-details-error" : undefined}
          className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {detailsError ? (
          <p id="add-lead-details-error" className="text-xs text-destructive">
            {detailsError}
          </p>
        ) : null}
      </div>
      {refusal ? <CentredCardNotice tone="error">{refusal}</CentredCardNotice> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save the lead"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
