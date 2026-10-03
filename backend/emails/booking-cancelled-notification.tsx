/** @jsxImportSource react */
// Backend: the business's notice that a customer cancelled: what and when first, then who, each
// fact on its own line so it reads in a second. It is sent with the customer as reply-to.

import { Heading, Hr, Link, render, Text } from "@react-email/components";

import { formatBookingTime } from "../lib/email/format-booking-time.js";
import type { BookingEmailFactsType } from "./booking-email-facts-type.js";
import { EmailButton } from "./email-button.js";
import { emailColors } from "./email-colors.js";
import { EmailField } from "./email-field.js";
import { EmailLayout } from "./email-layout.js";
import type { RenderedEmailType } from "./rendered-email-type.js";
import { telHref } from "./tel-href.js";

export async function renderBookingCancelledNotification(
  facts: BookingEmailFactsType
): Promise<RenderedEmailType> {
  const when = formatBookingTime(facts.startsAt, facts.business.timezone);
  const email = <BookingCancelledNotificationEmail facts={facts} when={when} />;
  return {
    subject: `Cancelled: ${facts.service}, ${when}`,
    html: await render(email),
    text: await render(email, { plainText: true }),
  };
}

function BookingCancelledNotificationEmail({
  facts,
  when,
}: {
  facts: BookingEmailFactsType;
  when: string;
}) {
  const { business, customer } = facts;
  const brand = business.brandColor ?? emailColors.ink;
  const linkStyle = { color: brand, textDecoration: "none" };
  return (
    <EmailLayout
      businessName={business.name}
      logo={business.logo}
      preview={[customer.name, customer.phone ?? customer.email].filter(Boolean).join(" - ")}
      footer={
        customer.email
          ? `${customer.name} cancelled from the link in their confirmation. Replying goes straight to ${customer.name}.`
          : `${customer.name} cancelled from the link in their confirmation.`
      }
    >
      <Heading
        as="h1"
        style={{ margin: "0 0 20px", fontSize: "22px", lineHeight: "30px", color: emailColors.ink }}
      >
        Booking cancelled
      </Heading>
      <Text
        style={{
          margin: "0 0 16px",
          fontSize: "14px",
          lineHeight: "20px",
          color: emailColors.muted,
        }}
      >
        The time is free again: the next customer can book it.
      </Text>

      <EmailField label="What">{facts.service}</EmailField>
      <EmailField label="When it was">{when}</EmailField>
      <EmailField label="Was booked with">{facts.personName}</EmailField>

      <Hr style={{ borderColor: emailColors.line, margin: "20px 0" }} />

      <EmailField label="Name">{customer.name}</EmailField>
      {customer.phone ? (
        <EmailField label="Phone">
          <Link href={telHref(customer.phone)} style={linkStyle}>
            {customer.phone}
          </Link>
        </EmailField>
      ) : null}
      {customer.email ? (
        <EmailField label="Email">
          <Link href={`mailto:${customer.email}`} style={linkStyle}>
            {customer.email}
          </Link>
        </EmailField>
      ) : null}
      <EmailField label="Address">{facts.location}</EmailField>

      {customer.phone ? (
        <EmailButton href={telHref(customer.phone)} color={brand}>
          {`Call ${customer.name}`}
        </EmailButton>
      ) : null}
    </EmailLayout>
  );
}
