// Frontend component: the Leads screen. Every request the business has had, newest first, 50 at a
// time; a row opens that lead's page.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { AddLeadForm } from "@/components/leads/add-lead-form";
import { ContactInitials } from "@/components/leads/contact-initials";
import { RefusalNotice } from "@/components/centred-card/refusal-notice";
import { Button } from "@/components/ui/button";
import { fetchLeads, type LeadsListRowType } from "@/lib/api-client/leads/fetch-leads";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import { formatLeadTime } from "@/lib/format-lead-time";

type ListStateType =
  | { state: "loading" }
  | { state: "unreachable"; message: string }
  | { state: "signed-out" }
  | { state: "refused"; message: string }
  | { state: "ok"; leads: LeadsListRowType[]; nextAfter: string | null; timeZone: string | null };

export function LeadsListScreen() {
  const { words } = useDashboardWords();
  const leadsWords = words.leadsWords;
  const [list, setList] = useState<ListStateType>({ state: "loading" });
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [adding, setAdding] = useState(false);

  // Bump to ask again, on "Try again".
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;

    fetchLeads().then((result) => {
      if (!live) return;
      setList(result.state === "ok" ? { state: "ok", ...result.page } : result);
    });

    return () => {
      live = false;
    };
  }, [reloads]);

  async function showMore() {
    if (list.state !== "ok" || !list.nextAfter) return;
    setLoadingMore(true);
    setMoreError(null);
    const result = await fetchLeads(list.nextAfter);
    setLoadingMore(false);
    if (result.state === "signed-out") return setMoreError(leadsWords.signInEndedSeeMore);
    if (result.state !== "ok") return setMoreError(result.message);
    setList({
      ...list,
      leads: [...list.leads, ...result.page.leads],
      nextAfter: result.page.nextAfter,
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{words.leads}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{leadsWords.listLede}</p>
        </div>
        {adding ? null : <Button onClick={() => setAdding(true)}>{leadsWords.addALead}</Button>}
      </div>

      {adding ? (
        <div className="mt-6">
          <AddLeadForm onCancel={() => setAdding(false)} />
        </div>
      ) : null}

      <div className="mt-6">
        {list.state === "loading" ? (
          <p className="text-sm text-muted-foreground">{leadsWords.loadingYourLeads}</p>
        ) : list.state === "signed-out" || list.state === "refused" ? (
          <RefusalNotice refusal={list} />
        ) : list.state === "unreachable" ? (
          <div>
            <CentredCardNotice>{list.message}</CentredCardNotice>
            <Button
              className="mt-4"
              onClick={() => {
                setList({ state: "loading" });
                setReloads((n) => n + 1);
              }}
            >
              {words.tryAgain}
            </Button>
          </div>
        ) : list.leads.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            {leadsWords.noLeadsYet}
          </p>
        ) : (
          <>
            <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm)]">
              {list.leads.map((row) => (
                <LeadsListRow key={row.id} row={row} timeZone={list.timeZone} />
              ))}
            </ul>
            {list.timeZone ? null : (
              <p className="mt-3 text-xs text-muted-foreground">{leadsWords.browserTimeZoneNote}</p>
            )}
            {list.nextAfter ? (
              <div className="mt-4 flex flex-col items-center gap-2">
                <Button variant="outline" onClick={showMore} disabled={loadingMore}>
                  {loadingMore ? leadsWords.loading : leadsWords.showMore}
                </Button>
                {moreError ? (
                  <p role="alert" className="text-sm text-lost">
                    {moreError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// One lead: who, what they asked for, when, its stage and where it came from.
function LeadsListRow({ row, timeZone }: { row: LeadsListRowType; timeZone: string | null }) {
  const { words } = useDashboardWords();
  const leadsWords = words.leadsWords;
  const time = (iso: string) => formatLeadTime(iso, timeZone, words.intlLocale);
  const when = row.booking
    ? leadsWords.bookedFor(time(row.booking.startsAt), row.booking.status === "cancelled")
    : leadsWords.cameInAt(time(row.createdAt));

  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={`/leads/${row.id}`}
        className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-muted md:grid-cols-[2.25rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_7rem]"
      >
        <ContactInitials name={row.contact.name} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{row.contact.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.contact.phone ?? row.contact.email ?? leadsWords.noPhoneOrEmail}
          </div>
        </div>
        <div className="hidden truncate text-sm text-foreground md:block">{row.what ?? "—"}</div>
        <div className="hidden truncate text-sm text-muted-foreground md:block">{when}</div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
          {row.stage.name}
        </span>
        <div className="hidden text-right text-xs text-muted-foreground md:block">
          {leadsWords.sourceName[row.source]}
        </div>
      </Link>
    </li>
  );
}
