// Frontend: the dashboard home's calendar card. Connect, Disconnect, Reconnect when Google
// stopped accepting the saved permission, and one line after each saying what happened.

"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  isCalendarConnectOutcome,
  type CalendarConnectOutcomeType,
} from "@scheduleads-app/shared/calendar";

import { Notice } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import {
  disconnectCalendar,
  fetchCalendarConnection,
  startCalendarConnect,
  type CalendarConnectionResultType,
  type DisconnectCalendarResultType,
} from "@/lib/api-client";

type NoticeWordsType = { tone: "info" | "error"; text: ReactNode };
type AtProviderType = Extract<DisconnectCalendarResultType, { state: "ok" }>["atProvider"];

// Keyed by the shared list, so an outcome renamed in the API fails this build.
const OUTCOMES: Record<CalendarConnectOutcomeType, NoticeWordsType> = {
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

const DISCONNECTED: Record<AtProviderType, NoticeWordsType> = {
  handed_back: {
    tone: "info",
    text: "Disconnected. Google no longer gives this app access to your calendar.",
  },
  still_used: {
    tone: "info",
    text: "Disconnected here. Another business of yours still uses this Google account, so Google keeps allowing it.",
  },
  already_stopped: {
    tone: "info",
    text: "Disconnected. Google had already stopped accepting this connection.",
  },
  not_confirmed: {
    tone: "error",
    text: (
      <>
        Disconnected here, but Google did not confirm. Remove the app in{" "}
        <a
          className="underline underline-offset-2"
          href="https://myaccount.google.com/connections"
          target="_blank"
          rel="noreferrer"
        >
          your Google account
        </a>
        .
      </>
    ),
  },
};

export function CalendarConnectionCard() {
  const [result, setResult] = useState<CalendarConnectionResultType | null>(null);
  // The card only mounts in the browser, after the dashboard loaded, so the address is there.
  const [notice, setNotice] = useState<NoticeWordsType | null>(() => {
    const outcome = new URL(window.location.href).searchParams.get("calendar");
    return isCalendarConnectOutcome(outcome) ? OUTCOMES[outcome] : null; // any other word: nothing
  });
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);

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

  // After Disconnect, and from Try again: back to Loading, then the fresh answer.
  function reload() {
    setResult(null);
    fetchCalendarConnection().then(setResult);
  }

  async function connect() {
    setRefusal(null);
    setBusy("connect");
    const started = await startCalendarConnect();
    if (started.state === "ok") {
      window.location.assign(started.url); // off to Google; the page is left behind
      return;
    }
    setBusy(null);
    setRefusal(started.message);
  }

  async function disconnect() {
    setRefusal(null);
    setBusy("disconnect");
    const done = await disconnectCalendar();
    setBusy(null);
    if (done.state === "refused") {
      setRefusal(done.message);
      return;
    }
    setNotice(DISCONNECTED[done.atProvider]);
    reload();
  }

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
        <CalendarConnectionBody
          result={result}
          busy={busy}
          onConnect={connect}
          onDisconnect={disconnect}
          onRetry={reload}
        />
        {refusal ? (
          <div className="mt-4">
            <Notice>{refusal}</Notice>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// "Last read 40 seconds ago", from the time the busy times were last read.
function lastReadWords(lastCheckedAt: string | null): string {
  if (!lastCheckedAt) return "Not read yet.";
  const seconds = Math.round((new Date(lastCheckedAt).getTime() - Date.now()) / 1000);
  const size = Math.abs(seconds);
  const words = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  if (size < 60) return `Last read ${words.format(seconds, "second")}.`;
  if (size < 3600) return `Last read ${words.format(Math.round(seconds / 60), "minute")}.`;
  if (size < 86400) return `Last read ${words.format(Math.round(seconds / 3600), "hour")}.`;
  return `Last read ${words.format(Math.round(seconds / 86400), "day")}.`;
}

function CalendarConnectionBody({
  result,
  busy,
  onConnect,
  onDisconnect,
  onRetry,
}: {
  result: CalendarConnectionResultType | null;
  busy: "connect" | "disconnect" | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onRetry: () => void;
}) {
  if (!result) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (result.state === "unreachable") {
    return (
      <div className="flex items-center justify-between gap-4">
        <Notice>{result.message}</Notice>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  const { person, connection } = result.answer;

  if (!person) {
    return (
      <p className="text-sm text-muted-foreground">
        Your login is not linked to anyone on this business&apos;s calendar, so there is nothing to
        connect yet.
      </p>
    );
  }

  const disconnectButton = (variant: "destructive" | "outline") => (
    <Button variant={variant} size="sm" onClick={onDisconnect} disabled={busy !== null}>
      {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
    </Button>
  );

  if (connection?.status === "needs_reconnect") {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-[var(--lost)] bg-[var(--lost-soft)] px-4 py-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium text-foreground">Google Calendar · {connection.accountEmail}</p>
          <p className="mt-1 text-[var(--lost)]">
            Needs reconnecting. Google stopped accepting the saved permission.
          </p>
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          <Button size="sm" onClick={onConnect} disabled={busy !== null}>
            {busy === "connect" ? "Opening Google…" : "Reconnect"}
          </Button>
          {disconnectButton("outline")}
        </div>
      </div>
    );
  }

  if (connection) {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-border px-4 py-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium text-foreground">Google Calendar · {connection.accountEmail}</p>
          <p className="mt-1 text-muted-foreground">
            Connected. {lastReadWords(connection.lastCheckedAt)}
          </p>
        </div>
        <div className="ml-auto shrink-0">{disconnectButton("destructive")}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Not connected. Your busy times are not read yet.
      </p>
      <Button onClick={onConnect} disabled={busy !== null}>
        {busy === "connect" ? "Opening Google…" : "Connect"}
      </Button>
    </div>
  );
}
