// Frontend: the dashboard home's list of the business's active booking links, read once
// from the same public route a client site calls. Editing a link is feature 12.

"use client";

import { useEffect, useState } from "react";

import { CentredCardNotice } from "@/components/centred-card/centred-card-notice";
import { Button } from "@/components/ui/button";
import { fetchBookingLinks, type BookingLinksResultType } from "@/lib/api-client";

export function ServicesList({ slug }: { slug: string }) {
  const [result, setResult] = useState<BookingLinksResultType | null>(null);

  // Bump to ask again, on "Try again".
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    // `live` stops a late answer from updating a page the user already left.
    let live = true;

    fetchBookingLinks(slug).then((next) => {
      if (live) setResult(next);
    });

    return () => {
      live = false;
    };
  }, [slug, reloads]);

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-md)]">
      <h2 className="text-base font-semibold tracking-tight text-foreground">Booking links</h2>
      <p className="mt-1 text-sm text-muted-foreground">What customers can book on your site.</p>

      <div className="mt-6">
        <BookingLinksBody
          result={result}
          onRetry={() => {
            setResult(null); // back to loading while it asks again
            setReloads((n) => n + 1);
          }}
        />
      </div>
    </section>
  );
}

function BookingLinksBody({
  result,
  onRetry,
}: {
  result: BookingLinksResultType | null;
  onRetry: () => void;
}) {
  if (!result) {
    return <p className="text-sm text-muted-foreground">Loading your booking links…</p>;
  }

  if (result.state === "unreachable") {
    return (
      <>
        <CentredCardNotice>{result.message}</CentredCardNotice>
        <Button className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      </>
    );
  }

  if (result.state === "not-bookable") {
    return (
      <p className="text-sm text-muted-foreground">
        Not open for online booking yet. Customers can&apos;t book on your site until it is.
      </p>
    );
  }

  if (result.bookingLinks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        None switched on yet. Customers can&apos;t book online until one is.
      </p>
    );
  }

  // In the order the public route gives them, by name.
  return (
    <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
      {result.bookingLinks.map((link) => (
        <li key={link.id} className="flex items-center justify-between gap-4 bg-card px-4 py-3">
          <span className="truncate text-foreground">{link.name}</span>
          <span className="flex-none font-mono text-muted-foreground">
            {link.durationMinutes} min
          </span>
        </li>
      ))}
    </ul>
  );
}
