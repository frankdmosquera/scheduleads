// Frontend: the dashboard home's calendar card. Connect, the outcome after Google sends the
// browser back, and the connected line. Disconnect and "needs reconnecting" come next.

"use client";

import { useEffect, useState } from "react";

import { Notice } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import {
  fetchCalendarConnection,
  startCalendarConnect,
  type CalendarConnectionResultType,
} from "@/lib/api-client";

// The API's ?calendar= outcomes, in the words the owner reads.
const OUTCOMES: Record<string, { tone: "info" | "error"; text: string }> = {
  connected: { tone: "info", text: "Your Google calendar is connected." },
  denied: { tone: "info", text: "You cancelled at Google. Nothing was connected." },
  expired: {
    tone: "error",
    text: "That took too long, or the link was already used. Press Connect again.",
  },
  missing_permission: {
    tone: "error",
    text: "Leave both boxes ticked at Google: seeing when you are busy, and adding bookings. Press Connect again.",
  },
  failed: {
    tone: "error",
    text: "Google did not answer properly. Nothing was saved. Try again in a minute.",
  },
};

export function CalendarConnectionCard() {
  const [result, setResult] = useState<CalendarConnectionResultType | null>(null);
  // The card only mounts in the browser, after the dashboard loaded, so the address is there.
  const [outcome] = useState(() => new URL(window.location.href).searchParams.get("calendar"));
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Read once above, then taken out of the address bar so a refresh does not show it again.
    const url = new URL(window.location.href);
    if (url.searchParams.has("calendar")) {
      url.searchParams.delete("calendar");
      window.history.replaceState(null, "", url);
    }

    // `live` stops a late answer from updating a page the user already left.
    let live = true;
    fetchCalendarConnection().then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, []);

  async function connect() {
    setRefusal(null);
    setBusy(true);
    const started = await startCalendarConnect();
    if (started.state === "ok") {
      window.location.assign(started.url); // off to Google; the page is left behind
      return;
    }
    setBusy(false);
    setRefusal(started.message);
  }

  const notice = outcome ? OUTCOMES[outcome] : undefined;

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-md)]">
      <h2 className="text-base font-semibold tracking-tight text-foreground">Calendar</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your own calendar, so customers are never offered a time you are busy.
      </p>

      {notice ? (
        <div className="mt-6">
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      ) : null}

      <div className="mt-6">
        <CalendarConnectionBody result={result} busy={busy} onConnect={connect} />
        {refusal ? (
          <div className="mt-4">
            <Notice>{refusal}</Notice>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CalendarConnectionBody({
  result,
  busy,
  onConnect,
}: {
  result: CalendarConnectionResultType | null;
  busy: boolean;
  onConnect: () => void;
}) {
  if (!result) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (result.state === "unreachable") return <Notice>{result.message}</Notice>;

  const { person, connection } = result.answer;

  if (!person) {
    return (
      <p className="text-sm text-muted-foreground">
        Your login is not linked to anyone on this business&apos;s calendar, so there is nothing to
        connect yet.
      </p>
    );
  }

  if (connection) {
    return (
      <div className="rounded-lg border border-border px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Google Calendar · {connection.accountEmail}</p>
        <p className="mt-1 text-muted-foreground">Connected.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Not connected. Your busy times are not read yet.
      </p>
      <Button onClick={onConnect} disabled={busy}>
        {busy ? "Opening Google…" : "Connect"}
      </Button>
    </div>
  );
}
