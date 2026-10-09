// Frontend component: the platform admin's "Set up a client" form, and the card that follows
// it. One request makes the client's login and their business, with the client as owner.

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Fragment, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  provisionClientValidationSchema,
  type ProvisionClientInputType,
} from "@scheduleads-app/shared/zod-validation";

import { CentredCard } from "@/components/centred-card/centred-card";
import { CentredCardField } from "@/components/centred-card/centred-card-field";
import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { Button } from "@/components/ui/button";
import { provisionClient, type ProvisionedClientType } from "@/lib/api-client";

const emptyForm: ProvisionClientInputType = {
  businessName: "",
  clientName: "",
  clientEmail: "",
  senderEmail: "",
  notifyEmail: "",
  phone: "",
  website: "",
  brandColor: "",
  emailSendingKey: "",
};

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

// What the business's emails need (feature 6). All optional: no email goes until the two
// addresses are set, and the key only when you set up the client's Resend yourself.
const emailFields = [
  {
    name: "senderEmail",
    label: "Emails come from",
    placeholder: "bookings@primopainters.com",
    autoComplete: "off",
    type: "email",
  },
  {
    name: "notifyEmail",
    label: "Booking notifications go to",
    placeholder: "Empty: the client's email",
    autoComplete: "off",
    type: "email",
  },
  { name: "phone", label: "Phone", placeholder: "403 555 0100", autoComplete: "off", type: "tel" },
  {
    name: "website",
    label: "Website",
    placeholder: "https://primopainters.com",
    autoComplete: "off",
    type: "url",
  },
  { name: "brandColor", label: "Brand colour", placeholder: "#1d4ed8", autoComplete: "off" },
  {
    name: "emailSendingKey",
    label: "Their Resend key (send-only)",
    placeholder: "Only if you set up their Resend",
    autoComplete: "off",
    type: "password",
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

export function ClientSetupForm({ hasBusiness }: { hasBusiness: boolean }) {
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
    <CentredCard
      title="Set up a client"
      lede="Makes the client's login and their business together. The client is its owner; you are not a member."
      footer={<AdminFooter hasBusiness={hasBusiness} />}
    >
      <form onSubmit={form.handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        {[...fields, ...emailFields].map((field, index) => (
          <Fragment key={field.name}>
            {index === fields.length ? (
              <div className="mt-2 border-t pt-4">
                <h2 className="text-sm font-medium">Their emails</h2>
                <p className="text-xs text-muted-foreground">
                  Optional now. Booking emails go out only once both addresses are set.
                </p>
              </div>
            ) : null}
            <Controller
              name={field.name}
              control={form.control}
              render={({ field: input, fieldState }) => (
                <CentredCardField
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
          </Fragment>
        ))}
        {refusal ? <CentredCardNotice>{refusal}</CentredCardNotice> : null}
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Setting up…" : "Set up client"}
        </Button>
      </form>
    </CentredCard>
  );
}

// What to tell the client. The welcome email is not sent yet, so the platform admin tells them.
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
    <CentredCard
      title={`${answer.organization.name} is set up`}
      lede={`${answer.client.email} owns it and can sign in now.`}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <CentredCardNotice tone="info">
          No email is sent yet: tell the client yourself. They sign in at {signInAddress} with a
          code sent to {answer.client.email}.
        </CentredCardNotice>
        <Button type="button" size="lg" onClick={onAnother}>
          Set up another
        </Button>
      </div>
    </CentredCard>
  );
}
