// Frontend component: the platform admin's "Set up a client" form, and the card that follows
// it. One request makes the client's login and their business, with the client as owner.

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  provisionClientValidationSchema,
  type ProvisionClientInputType,
} from "@scheduleads-app/shared/zod-validation";

import { AuthCard, Field, Notice } from "@/components/auth-card";
import { SignOutLink } from "@/components/sign-out-link";
import { Button } from "@/components/ui/button";
import { provisionClient, type ProvisionedClientType } from "@/lib/api-client";

const emptyForm: ProvisionClientInputType = { businessName: "", clientName: "", clientEmail: "" };

const fields = [
  {
    name: "businessName",
    label: "Business name",
    placeholder: "Primo Painters",
    autoComplete: "organization",
  },
  { name: "clientName", label: "Client's name", placeholder: "Maria Lopez", autoComplete: "name" },
  {
    name: "clientEmail",
    label: "Client's email",
    placeholder: "maria@primopainters.com",
    autoComplete: "email",
    type: "email",
  },
] as const;

// Sign out always, and the way back when the platform admin has a dashboard to go back to.
function AdminFooter({ hasBusiness }: { hasBusiness: boolean }) {
  return (
    <span className="flex justify-center gap-4">
      {hasBusiness ? (
        <Link href="/" className="underline underline-offset-2 hover:text-foreground">
          Back to the dashboard
        </Link>
      ) : null}
      <SignOutLink />
    </span>
  );
}

export function NewClientForm({ hasBusiness }: { hasBusiness: boolean }) {
  const [done, setDone] = useState<ProvisionedClientType | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const form = useForm<ProvisionClientInputType>({
    resolver: zodResolver(provisionClientValidationSchema),
    defaultValues: emptyForm,
  });

  async function submit(input: ProvisionClientInputType) {
    setRefusal(null);
    const result = await provisionClient(input);

    if (result.state === "ok") {
      setDone(result.answer);
      return;
    }
    if (result.state === "field") {
      form.setError(result.field, { message: result.message }, { shouldFocus: true });
      return;
    }
    setRefusal(result.message);
  }

  if (done) {
    return (
      <SetUpCard
        answer={done}
        footer={<AdminFooter hasBusiness={hasBusiness} />}
        onAnother={() => {
          form.reset(emptyForm);
          setDone(null);
        }}
      />
    );
  }

  return (
    <AuthCard
      title="Set up a client"
      lede="Makes the client's login and their business together. The client is its owner; you are not a member."
      footer={<AdminFooter hasBusiness={hasBusiness} />}
    >
      <form onSubmit={form.handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        {fields.map((field) => (
          <Controller
            key={field.name}
            name={field.name}
            control={form.control}
            render={({ field: input, fieldState }) => (
              <Field
                {...input}
                id={field.name}
                label={field.label}
                type={"type" in field ? field.type : "text"}
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                error={fieldState.error?.message}
              />
            )}
          />
        ))}
        {refusal ? <Notice>{refusal}</Notice> : null}
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Setting up…" : "Set up client"}
        </Button>
      </form>
    </AuthCard>
  );
}

// What to tell the client. No email goes out until the product sends email (feature 6).
function SetUpCard({
  answer,
  onAnother,
  footer,
}: {
  answer: ProvisionedClientType;
  onAnother: () => void;
  footer: React.ReactNode;
}) {
  const signInAddress = `${window.location.origin}/sign-in`;

  return (
    <AuthCard
      title={`${answer.organization.name} is set up`}
      lede={`${answer.client.email} owns it and can sign in now.`}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <Notice tone="info">
          No email is sent yet: tell the client yourself. They sign in at {signInAddress} with a
          code sent to {answer.client.email}.
        </Notice>
        <Button type="button" size="lg" onClick={onAnother}>
          Set up another
        </Button>
      </div>
    </AuthCard>
  );
}
