"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { organizationNameSchema, toSlug } from "@scheduleads-app/shared/validation";

import { AuthCard, Field, Notice } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/**
 * The first business a signed-in user creates.
 *
 * One field. The slug is derived rather than asked for, because it is
 * unique across every tenant and letting the first business choose it
 * hands them a name a later one might want. `organization.plan` is not
 * on this form and cannot be: it is declared `input: false` on the
 * server, so a body carrying it is ignored rather than honoured. Every
 * new business starts on `agency`.
 *
 * Better Auth sets the new organization active on the session as part of
 * creating it, so there is no separate switch call afterwards. Read off
 * the installed 1.7.5 - `crud-org.mjs` calls `setActiveOrganization`
 * unless `keepCurrentActiveOrganization` is passed, and it is not.
 */

export default function CreateOrganizationPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  // Creating an organization needs a session. Without this check an
  // unauthenticated visitor gets a form that can only ever fail, which
  // tells them nothing about what to do instead.
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

  const slug = toSlug(name);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);
    setRefusal(null);

    const parsed = organizationNameSchema.safeParse(name);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter the name of your business.");
      return;
    }

    const derived = toSlug(parsed.data);
    if (!derived) {
      // A name of nothing but punctuation or emoji derives to an empty
      // slug, which the server would reject with a message about a field
      // this form never showed.
      setFieldError("Use at least a couple of letters or numbers.");
      return;
    }

    setBusy(true);
    const { error } = await authClient.organization.create({
      name: parsed.data,
      slug: derived,
    });
    setBusy(false);

    if (error) {
      setRefusal(
        error.message ??
          "That business could not be created. Try a slightly different name."
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
