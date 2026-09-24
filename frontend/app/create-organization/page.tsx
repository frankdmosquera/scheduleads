// Frontend page /create-organization: a signed-in user names a new business.

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createOrganizationValidationSchema, toSlug } from "@scheduleads-app/shared/zod-validation";

import { AuthCard, Field, Notice } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function CreateOrganizationPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  // Signed out: go to sign-in, rather than show a form that can only fail.
  useEffect(() => {
    let live = true;

    authClient.getSession().then(({ data }) => {
      if (!live) return;
      if (!data) {
        router.replace("/sign-in");
        return;
      }
      setChecking(false);
    });

    return () => {
      live = false;
    };
  }, [router]);

  const slug = toSlug(name); // built from the name, never typed (see toSlug)

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);
    setRefusal(null);

    const parsed = createOrganizationValidationSchema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter the name of your business.");
      return;
    }

    const derived = toSlug(parsed.data.name);
    if (!derived) {
      // Only punctuation or emoji: the slug would be empty and the server's error
      // would mention a field this form never showed.
      setFieldError("Use at least a couple of letters or numbers.");
      return;
    }

    setBusy(true);
    // Better Auth also makes the new business the active one, so no switch call is needed.
    // No plan is sent: the server always starts a new business on "agency".
    const { error } = await authClient.organization.create({
      name: parsed.data.name,
      slug: derived,
    });
    setBusy(false);

    if (error) {
      setRefusal(
        error.message ?? "That business could not be created. Try a slightly different name."
      );
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (checking) {
    return (
      <AuthCard title="One moment">
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Name your business"
      lede="This is the name you will see in the dashboard. Customers book under your own brand and never see it."
    >
      <form onSubmit={create} className="flex flex-col gap-4">
        <Field
          id="name"
          label="Business name"
          autoFocus
          autoComplete="organization"
          placeholder="Primo Painters"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldError ?? undefined}
          hint={slug ? `Your address will be ${slug}` : undefined}
        />
        {refusal ? <Notice>{refusal}</Notice> : null}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Creating…" : "Create business"}
        </Button>
      </form>
    </AuthCard>
  );
}
