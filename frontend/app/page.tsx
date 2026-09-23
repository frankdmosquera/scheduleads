"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthCard, Notice } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { fetchMe, type MeResult } from "@/lib/api";

/**
 * The signed-in shell, and the only screen that reads `GET /me`.
 *
 * `/me` is the dashboard's bootstrap: who is signed in, which business
 * they are acting for, and what that business has paid for. It answers
 * in one of four ways and each gets its own screen, because collapsing
 * them into one error page leaves the user looking at "something went
 * wrong" when the actual answer is "sign in", "pick a business" or
 * "this account is misconfigured".
 *
 * Every field on this page comes from that one response. Nothing here
 * asks the API for an organization by id, because the id is the
 * session's to decide - see the comment in the API's
 * `active-organization.ts`, which is where that rule starts.
 */

type Organization = { id: string; name: string; slug: string };

export default function DashboardPage() {
  const router = useRouter();
  const [result, setResult] = useState<MeResult | null>(null);

  /**
   * Bumped to ask for `/me` again: after a business is picked, or when
   * the user retries a call that could not reach the API.
   *
   * The effect below sets state from inside the promise callback rather
   * than calling an async helper directly. That is not style - the React
   * Compiler's lint rule rejects the direct call, and the `live` flag it
   * forces is what stops a late response writing state into a component
   * that has already navigated away.
   */
  const [reloads, setReloads] = useState(0);
  const reload = () => setReloads((n) => n + 1);

  useEffect(() => {
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
            Nothing is lost. Get in touch and we will put the account back on
            the right plan.
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

/**
 * State two: no session at all.
 *
 * A redirect rather than a screen with a link, because there is nothing
 * on this page a signed-out visitor can do. Rendered as an effect so the
 * push happens after mount rather than during render.
 */
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

/**
 * State four: signed in, but the session resolves to no one business.
 *
 * Two different situations arrive here, and they need opposite screens:
 *
 * - No memberships at all. A brand new account. It is sent straight to
 *   create-organization; asking someone to pick from an empty list is
 *   not a question.
 * - Two or more memberships and no active choice. The API refuses to
 *   guess which tenant was meant, which is the whole point of the rule,
 *   so the choice comes back here to be made explicitly.
 */
function PickOrganization({ onPicked }: { onPicked: () => void }) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
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
        <p className="text-sm text-muted-foreground">
          Looking up your businesses…
        </p>
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

/** State one: everything resolved. The business, its plan, and who you are. */
function SignedIn({
  me,
  onSignedOut,
}: {
  me: Extract<MeResult, { state: "ok" }>["me"];
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
              <p className="font-mono text-xs text-muted-foreground">
                {me.organization.plan}
              </p>
            </div>
          </div>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
            <Row label="Signed in as" value={me.user.name || me.user.email} />
            <Row label="Your role" value={me.role} />
            <Row label="Address" value={me.organization.slug} mono />
            <Row
              label="Plan"
              value={me.organization.plan}
              mono
            />
            <Row
              label="Included"
              value={
                me.limits.modules.length > 0
                  ? me.limits.modules.join(", ")
                  : "nothing"
              }
            />
          </dl>

          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            Every figure above came from one call to the API, scoped to this
            business by your session. Leads, bookings and the calendar arrive
            with the next build-plan items.
          </p>
        </div>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          <SignOutLink onSignedOut={onSignedOut} />
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-4 bg-card px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "truncate font-mono text-foreground"
            : "truncate text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

/** The business's initial, as the mockups' sidebar draws it. */
function OrgMark({ name }: { name: string }) {
  return (
    <span className="grid size-9 flex-none place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/**
 * Sign out.
 *
 * Present on every signed-in state, including the two refusals, because
 * a user stuck on one of those has no other way back. It is also how a
 * second account gets tested without clearing cookies by hand, which
 * build-plan step 1.6 needs.
 */
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
