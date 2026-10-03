/** @jsxImportSource react */
// Backend: the customer's confirmation, from the business and under its brand: what, when, with
// whom and where, and a button to call the business. It never names the product.

import { Heading, Link, render, Text } from "@react-email/components";

import { formatBookingTime } from "@scheduleads-app/shared/booking-time";

import type { BookingEmailFactsType } from "./booking-email-facts-type.js";
import { EmailButton } from "./email-button.js";
import { emailColors } from "./email-colors.js";
import { EmailField } from "./email-field.js";
import { EmailLayout } from "./email-layout.js";
import type { RenderedEmailType } from "./rendered-email-type.js";
import { telHref } from "./tel-href.js";

export async function renderBookingConfirmation(
  facts: BookingEmailFactsType
): Promise<RenderedEmailType> {
  const when = formatBookingTime(facts.startsAt, facts.business.timezone);
  const email = <BookingConfirmationEmail facts={facts} when={when} />;
  return {
    subject: `You're booked with ${facts.business.name}: ${when}`,
    html: await render(email),
    text: await render(email, { plainText: true }),
  };
}

function BookingConfirmationEmail({ facts, when }: { facts: BookingEmailFactsType; when: string }) {
  const { business } = facts;
  const brand = business.brandColor ?? emailColors.ink;
  return (
    <EmailLayout
      businessName={business.name}
      logo={business.logo}
      preview={`${facts.service}, ${when}`}
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
        You&apos;re booked
      </Heading>
      <Text
        style={{
          margin: "0 0 20px",
          fontSize: "16px",
          lineHeight: "24px",
          color: emailColors.muted,
        }}
      >
        {`Thanks, ${facts.customer.name}. ${business.name} has you booked.`}
      </Text>

      <EmailField label="What">{facts.service}</EmailField>
      <EmailField label="When">{when}</EmailField>
      <EmailField label="With">{facts.personName}</EmailField>
      <EmailField label="Where">{facts.location}</EmailField>

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
            {`Need to change something? Call us at ${business.phone}.`}
          </Text>
          <EmailButton href={telHref(business.phone)} color={brand}>
            {`Call ${business.name}`}
          </EmailButton>
        </>
      ) : null}
    </EmailLayout>
  );
}
