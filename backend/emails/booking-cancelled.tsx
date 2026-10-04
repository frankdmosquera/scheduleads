/** @jsxImportSource react */
// Backend: the customer's word that their booking is cancelled, from the business and under its
// brand: what it was and when, and a button to call the business to book again. The withdrawing
// invite rides along. It never names the product.

import { Heading, Link, render, Text } from "@react-email/components";

import { formatBookingTime } from "@scheduleads-app/shared/booking-time";
import { telHref } from "@scheduleads-app/shared/tel-href";

import type { BookingEmailFactsType } from "./booking-email-facts-type.js";
import { EmailButton } from "./email-button.js";
import { emailColors } from "./email-colors.js";
import { EmailField } from "./email-field.js";
import { EmailLayout } from "./email-layout.js";
import type { RenderedEmailType } from "./rendered-email-type.js";

export async function renderBookingCancelled(
  facts: BookingEmailFactsType
): Promise<RenderedEmailType> {
  const when = formatBookingTime(facts.startsAt, facts.business.timezone);
  const email = <BookingCancelledEmail facts={facts} when={when} />;
  return {
    subject: `Your booking with ${facts.business.name} is cancelled: ${when}`,
    html: await render(email),
    text: await render(email, { plainText: true }),
  };
}

function BookingCancelledEmail({ facts, when }: { facts: BookingEmailFactsType; when: string }) {
  const { business } = facts;
  const brand = business.brandColor ?? emailColors.ink;
  return (
    <EmailLayout
      businessName={business.name}
      logo={business.logo}
      preview={`Cancelled: ${facts.service}, ${when}`}
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
        Your booking is cancelled
      </Heading>
      <Text
        style={{
          margin: "0 0 20px",
          fontSize: "16px",
          lineHeight: "24px",
          color: emailColors.muted,
        }}
      >
        {`Thanks for letting us know, ${facts.customer.name}.`}
      </Text>

      <EmailField label="What">{facts.service}</EmailField>
      <EmailField label="When it was">{when}</EmailField>

      {business.phone ? (
        <>
          <Text
            style={{
              margin: "20px 0 0",
              fontSize: "14px",
              lineHeight: "20px",
              color: emailColors.muted,
            }}
          >
            {`Want another time? Call us at ${business.phone}.`}
          </Text>
          <EmailButton href={telHref(business.phone)} color={brand}>
            {`Call ${business.name}`}
          </EmailButton>
        </>
      ) : null}
    </EmailLayout>
  );
}
