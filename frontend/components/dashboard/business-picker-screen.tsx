// Frontend component: signed in, but no single business picked. Two cases: no businesses at all
// (the agency has not set one up yet; the platform admin goes to set up a client), or several (the
// API won't guess, so the user picks here).

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CentredCard } from "@/components/centred-card/centred-card";
import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { BusinessInitialMark } from "@/components/dashboard/business-initial-mark";
import { authClient } from "@/lib/auth-client";
import { isPlatformAdmin } from "@/lib/is-platform-admin";

export type BusinessChoiceType = { id: string; name: string; slug: string };

export function BusinessPickerScreen({ onPicked }: { onPicked: () => void }) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<BusinessChoiceType[] | null>(null);
  const [noBusiness, setNoBusiness] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;

    Promise.all([authClient.organization.list(), authClient.getSession()]).then(
      ([{ data, error }, session]) => {
        if (!live) return;

        if (error) {
          setRefusal(error.message ?? "Could not load your businesses.");
          setOrganizations([]);
          return;
        }

        const list = data ?? [];
        if (list.length === 0) {
          if (isPlatformAdmin(session.data?.user)) {
            router.replace("/admin/client-setup");
            return;
          }
          setNoBusiness(true);
        }

        setOrganizations(list);
      }
    );

    return () => {
      live = false;
    };
  }, [router]);

  async function chooseBusiness(organizationId: string) {
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
      <CentredCard title="One moment">
        <p className="text-sm text-muted-foreground">Looking up your businesses…</p>
      </CentredCard>
    );
  }

  if (noBusiness) {
    return (
      <CentredCard
        title="Your login has no business yet"
        lede="The agency sets up your business for you. Get in touch with them and it will be here the next time you sign in."
        footer={<SignOutLink />}
      >
        <p className="text-sm text-muted-foreground">There is nothing to show until then.</p>
      </CentredCard>
    );
  }

  return (
    <CentredCard
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
            onClick={() => void chooseBusiness(org.id)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
          >
            <BusinessInitialMark name={org.name} />
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
        {refusal ? <CentredCardNotice>{refusal}</CentredCardNotice> : null}
      </div>
    </CentredCard>
  );
}
