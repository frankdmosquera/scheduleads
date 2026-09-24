// Frontend page / : the signed-in dashboard. Reads GET /me once and shows one screen per
// answer (loading, signed out, pick a business, plan refused, API down, or the dashboard).

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthCard, Notice } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { fetchMe, type MeResultType } from "@/lib/api-client";

export type OrganizationType = { id: string; name: string; slug: string };

export default function DashboardPage() {
  const router = useRouter();
  const [result, setResult] = useState<MeResultType | null>(null);

  // Bump to ask /me again: after picking a business, or on "Try again".
  const [reloads, setReloads] = useState(0);
  const reload = () => setReloads((n) => n + 1);

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;

    fetchMe().then((next) => {
      if (live) setResult(next);
    });

    return () => {
      live = false;
    };
  }, [reloads]);

  if (!result) {
    return (
      <AuthCard title="One moment">
        <p className="text-sm text-muted-foreground">Loading your business…</p>
      </AuthCard>
    );
  }

  switch (result.state) {
    case "signed-out":
      return <SignedOut />;

    case "no-organization":
      return <PickOrganization onPicked={reload} />;

    case "plan-refused":
      return (
        <AuthCard
          title="This account needs attention"
          lede="Your business is on a plan this dashboard does not recognise, so there is nothing safe to show you."
          footer={<SignOutLink />}
        >
          <Notice>{result.message}</Notice>
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing is lost. Get in touch and we will put the account back on the right plan.
          </p>
        </AuthCard>
      );

    case "unreachable":
      return (
        <AuthCard title="Cannot reach the API">
          <Notice>{result.message}</Notice>
          <Button className="mt-4 w-full" size="lg" onClick={reload}>
            Try again
          </Button>
        </AuthCard>
      );

    case "ok":
      return <SignedIn me={result.me} onSignedOut={() => router.push("/sign-in")} />;
  }
}

// Signed out: redirect straight to sign-in (in an effect, so it runs after render).
function SignedOut() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sign-in");
  }, [router]);

  return (
    <AuthCard title="Taking you to sign in">
      <p className="text-sm text-muted-foreground">One moment…</p>
    </AuthCard>
  );
}

// Signed in, but no single business picked. Two cases: no businesses at all (go create
// one), or several (the API won't guess, so the user picks here).
function PickOrganization({ onPicked }: { onPicked: () => void }) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationType[] | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;

    authClient.organization.list().then(({ data, error }) => {
      if (!live) return;

      if (error) {
        setRefusal(error.message ?? "Could not load your businesses.");
        setOrganizations([]);
        return;
      }

      const list = data ?? [];
      // A brand-new account: nothing to pick from, so go create a business.
      if (list.length === 0) {
        router.replace("/create-organization");
        return;
      }

      setOrganizations(list);
    });

    return () => {
      live = false;
    };
  }, [router]);

  async function choose(organizationId: string) {
    setRefusal(null);
    setBusy(true);
    const { error } = await authClient.organization.setActive({ organizationId });
    setBusy(false);

    if (error) {
      setRefusal(error.message ?? "That business could not be opened.");
      return;
    }

    onPicked();
  }

  if (!organizations) {
    return (
      <AuthCard title="One moment">
        <p className="text-sm text-muted-foreground">Looking up your businesses…</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Which business?"
      lede="You belong to more than one, so we will not guess. Pick the one you are working in."
      footer={<SignOutLink />}
    >
      <div className="flex flex-col gap-2">
        {organizations.map((org) => (
          <button
            key={org.id}
            type="button"
            disabled={busy}
            onClick={() => void choose(org.id)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
          >
            <OrgMark name={org.name} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">
                {org.name}
              </span>
              <span className="block truncate font-mono text-xs text-muted-foreground">
                {org.slug}
              </span>
            </span>
          </button>
        ))}
        {refusal ? <Notice>{refusal}</Notice> : null}
      </div>
    </AuthCard>
  );
}

// Everything resolved: the business, its plan, and who you are.
function SignedIn({
  me,
  onSignedOut,
}: {
  me: Extract<MeResultType, { state: "ok" }>["me"];
  onSignedOut: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <div className="rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-3">
            <OrgMark name={me.organization.name} />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {me.organization.name}
              </h1>
              <p className="font-mono text-xs text-muted-foreground">{me.organization.plan}</p>
            </div>
          </div>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
            <Row label="Signed in as" value={me.user.name || me.user.email} />
            <Row label="Your role" value={me.role} />
            <Row label="Address" value={me.organization.slug} mono />
            <Row label="Plan" value={me.organization.plan} mono />
            <Row
              label="Included"
              value={me.limits.modules.length > 0 ? me.limits.modules.join(", ") : "nothing"}
            />
          </dl>

          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            Every figure above came from one call to the API, scoped to this business by your
            session. Leads, bookings and the calendar arrive with the next build-plan items.
          </p>
        </div>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          <SignOutLink onSignedOut={onSignedOut} />
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-4 bg-card px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "truncate font-mono text-foreground" : "truncate text-foreground"}>
        {value}
      </dd>
    </div>
  );
}

// The business's first letter, as the mockups' sidebar draws it.
function OrgMark({ name }: { name: string }) {
  return (
    <span className="grid size-9 flex-none place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

// On every signed-in screen, including the refusals, so nobody is ever stuck.
function SignOutLink({ onSignedOut }: { onSignedOut?: () => void }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="underline underline-offset-2 hover:text-foreground"
      onClick={async () => {
        await authClient.signOut();
        if (onSignedOut) onSignedOut();
        else router.push("/sign-in");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
