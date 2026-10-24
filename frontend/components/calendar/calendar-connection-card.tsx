// Frontend: the calendar card on Settings > Calendar (on the dashboard home until feature 12h).
// Connect, Disconnect, Reconnect when Google stopped accepting the saved permission, and one line
// after each saying what happened; the calendar pick sits under it.

"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  isCalendarConnectOutcome,
  type CalendarConnectOutcomeType,
} from "@scheduleads-app/shared/calendar";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { Button } from "@/components/ui/button";
import {
  disconnectCalendar,
  type DisconnectCalendarResultType,
} from "@/lib/api-client/calendar/disconnect-calendar";
import {
  fetchCalendarConnection,
  type CalendarConnectionResultType,
} from "@/lib/api-client/calendar/fetch-calendar-connection";
import { startCalendarConnect } from "@/lib/api-client/calendar/start-calendar-connect";
import type { CalendarSettingsWordsType } from "@/lib/dashboard-words/calendar-settings-words";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";

export type CalendarNoticeType = { tone: "info" | "error"; text: ReactNode };
export type GoogleDisconnectOutcomeType = Extract<
  DisconnectCalendarResultType,
  { state: "ok" }
>["atProvider"];

// Which line to show: kept as the outcome, so it reads in the language the screen speaks now.
type CalendarNoticeKeyType =
  | { after: "connect"; outcome: CalendarConnectOutcomeType }
  | { after: "disconnect"; outcome: GoogleDisconnectOutcomeType };

const CONNECT_TONES: Record<CalendarConnectOutcomeType, CalendarNoticeType["tone"]> = {
  connected: "info",
  denied: "info",
  expired: "error",
  missing_permission: "error",
  failed: "error",
};

function calendarNoticeOf(
  key: CalendarNoticeKeyType,
  words: CalendarSettingsWordsType
): CalendarNoticeType {
  if (key.after === "connect") {
    return { tone: CONNECT_TONES[key.outcome], text: words.connectOutcome[key.outcome] };
  }
  const disconnected: Record<GoogleDisconnectOutcomeType, CalendarNoticeType> = {
    handed_back: { tone: "info", text: words.handedBack },
    still_used: { tone: "info", text: words.stillUsed },
    already_stopped: { tone: "info", text: words.alreadyStopped },
    not_confirmed: {
      tone: "error",
      text: (
        <>
          {words.notConfirmed}{" "}
          <a
            className="underline underline-offset-2"
            href="https://myaccount.google.com/connections"
            target="_blank"
            rel="noreferrer"
          >
            {words.yourGoogleAccount}
          </a>
          .
        </>
      ),
    },
  };
  return disconnected[key.outcome];
}

export function CalendarConnectionCard({
  onChanged,
  children,
}: {
  onChanged: () => void; // after a disconnect, so what sits under the card reads again
  children: ReactNode;
}) {
  const { words } = useDashboardWords();
  const calendarWords = words.calendarSettingsWords;
  const [result, setResult] = useState<CalendarConnectionResultType | null>(null);
  // The card only mounts in the browser, after the dashboard loaded, so the address is there.
  const [notice, setNotice] = useState<CalendarNoticeKeyType | null>(() => {
    const outcome = new URL(window.location.href).searchParams.get("calendar");
    // Any other word: nothing.
    return isCalendarConnectOutcome(outcome) ? { after: "connect", outcome } : null;
  });
  const shownNotice = notice ? calendarNoticeOf(notice, calendarWords) : null;
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
  function reloadCalendarConnection() {
    setResult(null);
    fetchCalendarConnection().then(setResult);
  }

  async function connectGoogleCalendar() {
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

  async function disconnectGoogleCalendar() {
    setRefusal(null);
    setBusy("disconnect");
    const done = await disconnectCalendar();
    setBusy(null);
    if (done.state === "refused") {
      setRefusal(done.message);
      return;
    }
    setNotice({ after: "disconnect", outcome: done.atProvider });
    reloadCalendarConnection();
    onChanged();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-md)]">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {words.settingsFrameWords.calendar}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{calendarWords.lede}</p>

      {shownNotice ? (
        <div className="mt-6">
          <CentredCardNotice tone={shownNotice.tone}>{shownNotice.text}</CentredCardNotice>
        </div>
      ) : null}

      <div className="mt-6">
        <CalendarConnectionDetails
          result={result}
          busy={busy}
          onConnect={connectGoogleCalendar}
          onDisconnect={disconnectGoogleCalendar}
          onRetry={reloadCalendarConnection}
        />
        {refusal ? (
          <div className="mt-4">
            <CentredCardNotice>{refusal}</CentredCardNotice>
          </div>
        ) : null}
      </div>

      {children}
    </section>
  );
}

// "Last read 40 seconds ago", from the time the busy times were last read.
function lastCheckedWords(
  lastCheckedAt: string | null,
  words: CalendarSettingsWordsType,
  intlLocale: string
): string {
  if (!lastCheckedAt) return words.notReadYet;
  const seconds = Math.round((new Date(lastCheckedAt).getTime() - Date.now()) / 1000);
  const size = Math.abs(seconds);
  const relative = new Intl.RelativeTimeFormat(intlLocale, { numeric: "always" });
  if (size < 60) return words.lastRead(relative.format(seconds, "second"));
  if (size < 3600) return words.lastRead(relative.format(Math.round(seconds / 60), "minute"));
  if (size < 86400) return words.lastRead(relative.format(Math.round(seconds / 3600), "hour"));
  return words.lastRead(relative.format(Math.round(seconds / 86400), "day"));
}

function CalendarConnectionDetails({
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
  const { words } = useDashboardWords();
  const calendarWords = words.calendarSettingsWords;
  if (!result) {
    return <p className="text-sm text-muted-foreground">{words.settingsFrameWords.loading}</p>;
  }

  if (result.state === "unreachable") {
    return (
      <div className="flex items-center justify-between gap-4">
        <CentredCardNotice>{result.message}</CentredCardNotice>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {words.tryAgain}
        </Button>
      </div>
    );
  }

  const { person, connection } = result.answer;

  if (!person) {
    return <p className="text-sm text-muted-foreground">{calendarWords.notLinked}</p>;
  }

  const renderDisconnectButton = (variant: "destructive" | "outline") => (
    <Button variant={variant} size="sm" onClick={onDisconnect} disabled={busy !== null}>
      {busy === "disconnect" ? calendarWords.disconnecting : calendarWords.disconnect}
    </Button>
  );

  if (connection?.status === "needs_reconnect") {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-[var(--lost)] bg-[var(--lost-soft)] px-4 py-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium text-foreground">Google Calendar · {connection.accountEmail}</p>
          <p className="mt-1 text-[var(--lost)]">{calendarWords.needsReconnecting}</p>
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          <Button size="sm" onClick={onConnect} disabled={busy !== null}>
            {busy === "connect" ? calendarWords.openingGoogle : calendarWords.reconnect}
          </Button>
          {renderDisconnectButton("outline")}
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
            {calendarWords.connected}{" "}
            {lastCheckedWords(connection.lastCheckedAt, calendarWords, words.intlLocale)}
          </p>
        </div>
        <div className="ml-auto shrink-0">{renderDisconnectButton("destructive")}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">{calendarWords.notConnected}</p>
      <Button onClick={onConnect} disabled={busy !== null}>
        {busy === "connect" ? calendarWords.openingGoogle : calendarWords.connect}
      </Button>
    </div>
  );
}
