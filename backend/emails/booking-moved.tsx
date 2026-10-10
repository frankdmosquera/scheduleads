/** @jsxImportSource react */
// Backend: the customer's word that their booking has moved, from the business and under its
// brand: the new time first, the old one beside it, a button to the booking's own page and the
// business's phone. The updated invite rides along. It never names the product.

import { Heading, Link, render, Text } from "@react-email/components";

import { formatBookingTime } from "@scheduleads-app/shared/booking-time";
import { telHref } from "@scheduleads-app/shared/tel-href";

import type { BookingEmailFactsType } from "./booking-email-facts-type.js";
import { EmailButton } from "./email-button.js";
import { emailColors } from "./email-colors.js";
import { EmailField } from "./email-field.js";
import { EmailLayout } from "./email-layout.js";
import type { RenderedEmailType } from "./rendered-email-type.js";

// facts.startsAt is the new time. The page's address is its own argument, as the confirmation's.
export async function renderBookingMoved(
  facts: BookingEmailFactsType,
  movedFrom: Date,
  bookingPageUrl: string
): Promise<RenderedEmailType> {
  const when = formatBookingTime(facts.startsAt, facts.business.timezone);
  const was = formatBookingTime(movedFrom, facts.business.timezone);
  const email = (
    <BookingMovedEmail facts={facts} when={when} was={was} bookingPageUrl={bookingPageUrl} />
  );
  return {
    subject: `Your booking with ${facts.business.name} has moved: ${when}`,
    html: await render(email),
    text: await render(email, { plainText: true }),
  };
}

function BookingMovedEmail({
  facts,
  when,
  was,
  bookingPageUrl,
}: {
  facts: BookingEmailFactsType;
  when: string;
  was: string;
  bookingPageUrl: string;
}) {
  const { business } = facts;
  const brand = business.brandColor ?? emailColors.ink;
  return (
    <EmailLayout
      businessName={business.name}
      logo={business.logo}
      preview={`Moved: ${facts.service}, ${when}`}
      footer={
        business.website ? (
          <Link href={business.website} style={{ color: emailColors.muted }}>
            {business.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </Link>
        ) : (
          business.name
        )
      }
    >
      <Heading
        as="h1"
        style={{ margin: "0 0 8px", fontSize: "22px", lineHeight: "30px", color: emailColors.ink }}
      >
        Your booking has moved
      </Heading>
      <Text
        style={{
          margin: "0 0 20px",
          fontSize: "16px",
          lineHeight: "24px",
          color: emailColors.muted,
        }}
      >
        {`Thanks, ${facts.customer.name}. ${business.name} has you at the new time.`}
      </Text>

      <EmailField label="What">{facts.service}</EmailField>
      <EmailField label="New time">{when}</EmailField>
      <EmailField label="Moved from">{was}</EmailField>
      <EmailField label="With">{facts.personName}</EmailField>
      {facts.location ? <EmailField label="Where">{facts.location}</EmailField> : null}

      <Text
        style={{
          margin: "20px 0 0",
          fontSize: "14px",
          lineHeight: "20px",
          color: emailColors.muted,
        }}
      >
        Need to change it again?
      </Text>
      <EmailButton href={bookingPageUrl} color={brand}>
        Manage your booking
      </EmailButton>

      {business.phone ? (
        <Text
          style={{
            margin: "16px 0 0",
            fontSize: "14px",
            lineHeight: "20px",
            color: emailColors.muted,
            textAlign: "center",
          }}
        >
          Or call us at{" "}
          <Link href={telHref(business.phone)} style={{ color: emailColors.ink }}>
            {business.phone}
          </Link>
          .
        </Text>
      ) : null}
    </EmailLayout>
  );
}
