// Frontend component: the dashboard when nobody is signed in. It goes straight to sign-in (in an
// effect, so it runs after render).

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CentredCard } from "@/components/centred-card/centred-card";

export function DashboardSignedOutScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sign-in");
  }, [router]);

  return (
    <CentredCard title="Taking you to sign in">
      <p className="text-sm text-muted-foreground">One moment…</p>
    </CentredCard>
  );
}
