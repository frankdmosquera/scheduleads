// Frontend component: the dashboard when nobody is signed in. It goes straight to sign-in (in an
// effect, so it runs after render).

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CentredCard } from "@/components/centred-card/centred-card";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export function DashboardSignedOutScreen() {
  const router = useRouter();
  const { words } = useDashboardWords();

  useEffect(() => {
    router.replace("/sign-in");
  }, [router]);

  return (
    <CentredCard title={words.takingYouToSignIn}>
      <p className="text-sm text-muted-foreground">{words.oneMomentEllipsis}</p>
    </CentredCard>
  );
}
