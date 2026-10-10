// Frontend component: one Settings page's section: its title, then its data once read, or what went
// wrong (an ended sign-in, a refusal, an API that did not answer, with Try again).

"use client";

import { useEffect, useState, type ReactNode } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { RefusalNotice } from "@/components/centred-card/refusal-notice";
import { Button } from "@/components/ui/button";
import type { SettingsReadResultType } from "@/lib/api-client/settings/read-settings-response";

export function SettingsSection<Answer>({
  title,
  load,
  children,
}: {
  title: string;
  load: () => Promise<SettingsReadResultType<Answer>>; // stable: a module function, never inline
  children: (answer: Answer) => ReactNode;
}) {
  const [result, setResult] = useState<SettingsReadResultType<Answer> | null>(null);
  const [attempt, setAttempt] = useState(0); // Try again asks once more

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;
    load().then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, [load, attempt]);
  const tryAgain = () => {
    setResult(null);
    setAttempt((count) => count + 1);
  };

  return (
    <section aria-labelledby="settings-section-title">
      <h2
        id="settings-section-title"
        className="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {title}
      </h2>
      <div className="mt-3">
        {!result ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : result.state === "signed-out" || result.state === "refused" ? (
          <RefusalNotice refusal={result} />
        ) : result.state === "unreachable" ? (
          <div className="flex flex-col items-start gap-3">
            <CentredCardNotice>{result.message}</CentredCardNotice>
            <Button variant="outline" onClick={tryAgain}>
              Try again
            </Button>
          </div>
        ) : (
          children(result.answer)
        )}
      </div>
    </section>
  );
}
