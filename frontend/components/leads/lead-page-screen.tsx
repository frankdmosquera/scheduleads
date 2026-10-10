// Frontend component: one lead's page. The person and how to reach them, this request and its
// bookings, their timeline; beside it their open next steps and their other requests.

"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { telHref } from "@scheduleads-app/shared/tel-href";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { ContactInitials } from "@/components/leads/contact-initials";
import { TimelineEntryLine } from "@/components/leads/timeline-entry-line";
import { Button } from "@/components/ui/button";
import {
  fetchLead,
  type LeadPageType,
  type LeadResultType,
} from "@/lib/api-client/leads/fetch-lead";
import { formatLeadTime } from "@/lib/format-lead-time";

const SOURCE_LABELS = { widget: "Website", hosted: "Booking page", manual: "Added by hand" };

export function LeadPageScreen({ leadId }: { leadId: string }) {
  const [result, setResult] = useState<LeadResultType | null>(null);

  // Bump to ask again, on "Try again".
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;

    fetchLead(leadId).then((next) => {
      if (live) setResult(next);
    });

    return () => {
      live = false;
    };
  }, [leadId, reloads]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link href="/leads" className="text-sm text-muted-foreground hover:text-foreground">
        ← Leads
      </Link>
      <div className="mt-4">
        {!result ? (
          <p className="text-sm text-muted-foreground">Loading this lead…</p>
        ) : result.state === "not-found" ? (
          <div className="rounded-xl border border-border bg-card p-8">
            <h1 className="text-lg font-semibold text-foreground">No lead here</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This address does not match a lead of your business.
            </p>
          </div>
        ) : result.state === "unreachable" ? (
          <div>
            <CentredCardNotice>{result.message}</CentredCardNotice>
            <Button
              className="mt-4"
              onClick={() => {
                setResult(null);
                setReloads((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <LeadPageBody page={result.page} />
        )}
      </div>
    </div>
  );
}

function LeadPageBody({ page }: { page: LeadPageType }) {
  const { lead, contact, timeZone } = page;
  const time = (iso: string) => formatLeadTime(iso, timeZone);

  return (
    <>
      <header className="flex items-center gap-4">
        <ContactInitials name={contact.name} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
            {contact.name}
          </h1>
          <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
            {contact.phone ? (
              <a href={telHref(contact.phone)} className="hover:text-foreground">
                {contact.phone}
              </a>
            ) : null}
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className="hover:text-foreground">
                {contact.email}
              </a>
            ) : null}
          </div>
        </div>
      </header>
      {timeZone ? null : (
        <p className="mt-2 text-xs text-muted-foreground">
          Times are in your browser&apos;s time zone: this business has no bookable hours yet.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          <LeadSection title="This request">
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Stage</dt>
              <dd className="text-foreground">{lead.stage.name}</dd>
              <dt className="text-muted-foreground">Came from</dt>
              <dd className="text-foreground">{SOURCE_LABELS[lead.source]}</dd>
              <dt className="text-muted-foreground">Came in</dt>
              <dd className="text-foreground">{time(lead.createdAt)}</dd>
              {lead.phone && lead.phone !== contact.phone ? (
                <>
                  <dt className="text-muted-foreground">Phone given</dt>
                  <dd className="text-foreground">{lead.phone}</dd>
                </>
              ) : null}
              {lead.answers.map((answer, index) => (
                <AnswerRow key={index} question={answer.question} answer={answer.answer} />
              ))}
            </dl>
            {lead.details ? (
              <p className="mt-4 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm text-foreground">
                {lead.details}
              </p>
            ) : null}
          </LeadSection>

          {page.bookings.length > 0 ? (
            <LeadSection title={page.bookings.length === 1 ? "Booking" : "Bookings"}>
              <ul className="flex flex-col gap-3">
                {page.bookings.map((one) => (
                  <li key={one.id} className="text-sm">
                    <div className="font-medium text-foreground">
                      {one.serviceName}, {time(one.startsAt)}
                      {one.status === "cancelled" ? (
                        <span className="ml-2 rounded-full bg-lost-soft px-2 py-0.5 text-xs text-lost">
                          Cancelled
                        </span>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground">
                      {[one.personName, one.placeName, one.location].filter(Boolean).join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>
            </LeadSection>
          ) : null}

          <LeadSection title="Everything that happened">
            {page.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {page.timeline.map((entry) => (
                  <TimelineEntryLine key={entry.id} entry={entry} timeZone={timeZone} />
                ))}
              </ul>
            )}
            {page.timelineCut ? (
              <p className="mt-3 text-xs text-muted-foreground">Only the newest 200 are shown.</p>
            ) : null}
          </LeadSection>
        </div>

        <div className="flex flex-col gap-4">
          <LeadSection title="Next steps">
            {page.nextSteps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing owed.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {page.nextSteps.map((step) => (
                  <li key={step.id}>
                    <div className="text-foreground">
                      {step.what ?? step.type.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">due {time(step.dueAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </LeadSection>

          {page.otherLeads.length > 0 ? (
            <LeadSection title="Other requests">
              <ul className="flex flex-col gap-2 text-sm">
                {page.otherLeads.map((other) => (
                  <li key={other.id}>
                    <Link href={`/leads/${other.id}`} className="text-foreground hover:underline">
                      {other.what ?? "A request"}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {other.stageName} · {time(other.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            </LeadSection>
          ) : null}
        </div>
      </div>
    </>
  );
}

function LeadSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function AnswerRow({ question, answer }: { question: string; answer: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{question}</dt>
      <dd className="whitespace-pre-wrap text-foreground">{answer}</dd>
    </>
  );
}
