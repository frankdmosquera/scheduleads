// Frontend component: one line of a contact's timeline, in plain words. Every value is shown as
// text, never as HTML.

"use client";

import type { TimelineEntryType } from "@/lib/api-client/leads/fetch-lead";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import type { DashboardWordsType } from "@/lib/dashboard-words/dashboard-words-type";
import { formatLeadTime } from "@/lib/format-lead-time";

function lineOf(
  entry: TimelineEntryType,
  timeZone: string | null,
  words: DashboardWordsType
): string {
  const leadsWords = words.leadsWords;
  const time = (iso: string | null) =>
    iso ? formatLeadTime(iso, timeZone, words.intlLocale) : leadsWords.aTimeNotRecorded;
  const service = (name: string | null) => name ?? leadsWords.aBooking;

  switch (entry.type) {
    case "booking_created":
      return leadsWords.booked(service(entry.serviceName), time(entry.startsAt));
    case "booking_moved":
      return leadsWords.moved(
        service(entry.serviceName),
        time(entry.fromStartsAt),
        time(entry.toStartsAt)
      );
    case "booking_cancelled":
      return leadsWords.cancelledBooking(service(entry.serviceName));
    case "email_sent":
      return (entry.kind && leadsWords.emailLines[entry.kind]) || leadsWords.sentAnEmail;
    case "sms_sent":
      if (entry.kind === "booking_reminder" && entry.minutesBefore !== null)
        return leadsWords.textedAReminder(entry.minutesBefore);
      return (entry.kind && leadsWords.textLines[entry.kind]) || leadsWords.sentAText;
    case "other":
      return leadsWords.otherLines[entry.activityType] ?? entry.activityType.replace(/_/g, " ");
  }
}

export function TimelineEntryLine({
  entry,
  timeZone,
}: {
  entry: TimelineEntryType;
  timeZone: string | null;
}) {
  const { words } = useDashboardWords();
  return (
    <li className="flex flex-col gap-0.5 border-l-2 border-border py-1 pl-4">
      <span className="text-sm text-foreground">
        {lineOf(entry, timeZone, words)}
        {entry.actorName ? (
          <span className="text-muted-foreground">{words.leadsWords.byActor(entry.actorName)}</span>
        ) : null}
      </span>
      <span className="text-xs text-muted-foreground">
        {formatLeadTime(entry.occurredAt, timeZone, words.intlLocale)}
      </span>
    </li>
  );
}
