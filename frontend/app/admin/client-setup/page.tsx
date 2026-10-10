// Frontend page /admin/client-setup: the platform admin sets up a client. Anyone else sees a
// card saying the page is for the agency; the API refuses them either way.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ClientSetupForm } from "@/components/admin/client-setup-form";
import { CentredCard } from "@/components/centred-card/centred-card";
import { authClient } from "@/lib/auth-client";
import { isPlatformAdmin } from "@/lib/is-platform-admin";

export type ClientSetupViewerType = "checking" | "someone-else" | { hasBusiness: boolean };

export default function ClientSetupPage() {
  const router = useRouter();
  const [viewer, setViewer] = useState<ClientSetupViewerType>("checking");

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;

    Promise.all([authClient.getSession(), authClient.organization.list()]).then(
      ([{ data }, businesses]) => {
        if (!live) return;
        if (!data) {
          router.replace("/sign-in");
          return;
        }
        if (!isPlatformAdmin(data.user)) {
          setViewer("someone-else");
          return;
        }
        // With no business, the dashboard would only send the platform admin back here.
        setViewer({ hasBusiness: (businesses.data ?? []).length > 0 });
      }
    );

    return () => {
      live = false;
    };
  }, [router]);

  if (viewer === "checking") {
    return (
      <CentredCard title="One moment">
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </CentredCard>
    );
  }

  if (viewer === "someone-else") {
    return (
      <CentredCard
        title="This page is for the agency"
        lede="Setting up a client's business is done by the agency."
        footer={
          <Link href="/" className="underline underline-offset-2 hover:text-foreground">
            Back to your dashboard
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">There is nothing to do here.</p>
      </CentredCard>
    );
  }

  return <ClientSetupForm hasBusiness={viewer.hasBusiness} />;
}
