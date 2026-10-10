// Frontend component: what the owner still owes this person ("call back Thursday"), soonest first,
// each ticked off with Done, and a small form to add one.

"use client";

import { useState, type FormEvent } from "react";

import { nextStepValidationSchema } from "@scheduleads-app/shared/zod-validation";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeadPageType } from "@/lib/api-client/leads/fetch-lead";
import { addNextStep } from "@/lib/api-client/leads/add-next-step";
import { finishNextStep } from "@/lib/api-client/leads/finish-next-step";
import { formatLeadTime } from "@/lib/format-lead-time";

export function NextStepsSection({
  leadId,
  steps,
  timeZone,
  onChanged,
}: {
  leadId: string;
  steps: LeadPageType["nextSteps"];
  timeZone: string | null;
  onChanged: () => void;
}) {
  const [what, setWhat] = useState("");
  const [due, setDue] = useState(""); // the owner's clock time, "2026-10-15T09:00"
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveStep(event: FormEvent) {
    event.preventDefault();
    const parsed = nextStepValidationSchema.safeParse({
      what,
      dueLocal: due,
      browserTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the step.");
    setBusy(true);
    setError(null);
    const saved = await addNextStep(leadId, parsed.data);
    setBusy(false);
    if (saved.state !== "ok") return setError(saved.message);
    setWhat("");
    setDue("");
    onChanged();
  }

  async function tickDone(nextStepId: string) {
    setBusy(true);
    setError(null);
    const done = await finishNextStep(leadId, nextStepId);
    setBusy(false);
    if (done.state !== "ok") return setError(done.message);
    onChanged();
  }

  return (
    <div className="flex flex-col gap-4">
      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing owed.</p>
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="break-words text-foreground">
                  {step.what ?? step.type.replace(/_/g, " ")}
                </div>
                <div className="text-xs text-muted-foreground">
                  due {formatLeadTime(step.dueAt, timeZone)}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => tickDone(step.id)}
                aria-label={`Done: ${step.what ?? "this step"}`}
              >
                Done
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={saveStep}
        noValidate
        className="flex flex-col gap-2 border-t border-border pt-4"
      >
        <Label htmlFor={`next-step-what-${leadId}`}>Add a next step</Label>
        <Input
          id={`next-step-what-${leadId}`}
          value={what}
          onChange={(event) => setWhat(event.target.value)}
          placeholder="Call back about the quote"
          className="h-9 bg-muted"
        />
        <Label htmlFor={`next-step-due-${leadId}`} className="sr-only">
          When it is due
        </Label>
        <Input
          id={`next-step-due-${leadId}`}
          type="datetime-local"
          value={due}
          onChange={(event) => setDue(event.target.value)}
          className="h-9 bg-muted"
        />
        {error ? (
          <div role="alert">
            <CentredCardNotice tone="error">{error}</CentredCardNotice>
          </div>
        ) : null}
        <div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving…" : "Add"}
          </Button>
        </div>
      </form>
    </div>
  );
}
