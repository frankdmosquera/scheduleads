/** @jsxImportSource react */
// Backend: the customer's confirmation, from the business and under its brand: what, when, with
// whom and where, a button to the booking's own page, and the business's phone. It never names the
// product.

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

// The page's address is its own argument, so no other email can carry it by mistake.
export async function renderBookingConfirmation(
  facts: BookingEmailFactsType,
  bookingPageUrl: string
): Promise<RenderedEmailType> {
  const words = emailWordsOf[facts.language]; // the booking's: the customer booked in it
  const when = formatBookingTime(facts.startsAt, facts.business.timezone, facts.language);
  const email = (
    <BookingConfirmationEmail
      facts={facts}
      when={when}
      bookingPageUrl={bookingPageUrl}
      words={words}
    />
  );
  return {
    subject: words.bookedSubject(facts.business.name, when),
    html: await render(email),
    text: await render(email, { plainText: true }),
  };
}

function BookingConfirmationEmail({
  facts,
  when,
  bookingPageUrl,
  words,
}: {
  facts: BookingEmailFactsType;
  when: string;
  bookingPageUrl: string;
  words: EmailWordsType;
}) {
  const { business } = facts;
  const brand = business.brandColor ?? emailColors.ink;
  return (
    <EmailLayout
      lang={facts.language}
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
        {words.bookedHeading}
      </Heading>
      <Text
        style={{
          margin: "0 0 20px",
          fontSize: "16px",
          lineHeight: "24px",
          color: emailColors.muted,
        }}
      >
        {words.bookedThanks(facts.customer.name, business.name)}
      </Text>

      <EmailField label={words.what}>{facts.service}</EmailField>
      <EmailField label={words.when}>{when}</EmailField>
      <EmailField label={words.with}>{facts.personName}</EmailField>
      {facts.location ? <EmailField label={words.where}>{facts.location}</EmailField> : null}

      <Text
        style={{
          margin: "20px 0 0",
          fontSize: "14px",
          lineHeight: "20px",
          color: emailColors.muted,
        }}
      >
        {words.needToChange}
      </Text>
      <EmailButton href={bookingPageUrl} color={brand}>
        {words.manageBooking}
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
          {words.callUsAt}{" "}
          <Link href={telHref(business.phone)} style={{ color: emailColors.ink }}>
            {business.phone}
          </Link>
          .
        </Text>
      ) : null}
    </EmailLayout>
  );
}
