// Frontend page /admin/clients/new: the platform admin sets up a client. Anyone else sees a
// card saying the page is for the agency; the API refuses them either way.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NewClientForm } from "@/components/admin/new-client-form";
import { AuthCard } from "@/components/auth-card";
import { authClient } from "@/lib/auth-client";
import { isPlatformAdmin } from "@/lib/is-platform-admin";

type ViewerType = "checking" | "platform-admin" | "someone-else";

export default function NewClientPage() {
  const router = useRouter();
  const [viewer, setViewer] = useState<ViewerType>("checking");

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;

    authClient.getSession().then(({ data }) => {
      if (!live) return;
      if (!data) {
        router.replace("/sign-in");
        return;
      }
      setViewer(isPlatformAdmin(data.user) ? "platform-admin" : "someone-else");
    });

    return () => {
      live = false;
    };
  }, [router]);

  if (viewer === "checking") {
    return (
      <AuthCard title="One moment">
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </AuthCard>
    );
  }

  if (viewer === "someone-else") {
    return (
      <AuthCard
        title="This page is for the agency"
        lede="Setting up a client's business is done by the agency."
        footer={
          <Link href="/" className="underline underline-offset-2 hover:text-foreground">
            Back to your dashboard
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">There is nothing to do here.</p>
      </AuthCard>
    );
  }

  return <NewClientForm />;
}
