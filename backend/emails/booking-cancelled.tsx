/** @jsxImportSource react */
// Backend: the customer's word that their booking is cancelled, from the business and under its
// brand: what it was and when, and a button to call the business to book again. The withdrawing
// invite rides along. It never names the product. Its first line says who cancelled: the customer
// is thanked, and a cancel by the business says so.

import { Heading, Link, render, Text } from "@react-email/components";

import { formatBookingTime } from "@scheduleads-app/shared/booking-time";
import { telHref } from "@scheduleads-app/shared/tel-href";

import type { BookingEmailFactsType } from "./booking-email-facts-type.js";
import { EmailButton } from "./email-button.js";
import { emailColors } from "./email-colors.js";
import { EmailField } from "./email-field.js";
import { EmailLayout } from "./email-layout.js";
import { emailWordsOf, type EmailWordsType } from "./email-words.js";
import type { RenderedEmailType } from "./rendered-email-type.js";

export async function renderBookingCancelled(
  facts: BookingEmailFactsType,
  byBusiness = false // the owner cancelled it, not the customer
): Promise<RenderedEmailType> {
  const words = emailWordsOf[facts.language]; // the booking's: the customer booked in it
  const when = formatBookingTime(facts.startsAt, facts.business.timezone, facts.language);
  const email = (
    <BookingCancelledEmail facts={facts} when={when} byBusiness={byBusiness} words={words} />
  );
  return {
    subject: words.cancelledSubject(facts.business.name, when),
    html: await render(email),
    text: await render(email, { plainText: true }),
  };
}

function BookingCancelledEmail({
  facts,
  when,
  byBusiness,
  words,
}: {
  facts: BookingEmailFactsType;
  when: string;
  byBusiness: boolean;
  words: EmailWordsType;
}) {
  const { business } = facts;
  const brand = business.brandColor ?? emailColors.ink;
  return (
    <EmailLayout
      lang={facts.language}
      businessName={business.name}
      logo={business.logo}
      preview={words.cancelledPreview(facts.service, when)}
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
        {words.cancelledHeading}
      </Heading>
      <Text
        style={{
          margin: "0 0 20px",
          fontSize: "16px",
          lineHeight: "24px",
          color: emailColors.muted,
        }}
      >
        {byBusiness
          ? words.cancelledByBusiness(business.name)
          : words.cancelledThanks(facts.customer.name)}
      </Text>

      <EmailField label={words.what}>{facts.service}</EmailField>
      <EmailField label={words.whenItWas}>{when}</EmailField>

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
            {words.anotherTime(business.phone)}
          </Text>
          <EmailButton
            href={telHref(business.phone)}
            color={brand}
            ink={business.brandColor ? business.brandInk : null}
          >
            {words.call(business.name)}
          </EmailButton>
        </>
      ) : null}
    </EmailLayout>
  );
}
