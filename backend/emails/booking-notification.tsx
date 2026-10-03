/** @jsxImportSource react */
// Backend: the business's notification of a new booking: what and when first, then who booked,
// each fact on its own line so it reads in a second. It is sent with the customer as reply-to.

import { Fragment } from "react";
import { Heading, Hr, Link, render, Text } from "@react-email/components";

import { formatBookingTime } from "@scheduleads-app/shared/booking-time";

import type { BookingEmailFactsType } from "./booking-email-facts-type.js";
import { EmailButton } from "./email-button.js";
import { emailColors } from "./email-colors.js";
import { EmailField } from "./email-field.js";
import { EmailLayout } from "./email-layout.js";
import type { RenderedEmailType } from "./rendered-email-type.js";
import { telHref } from "./tel-href.js";

export async function renderBookingNotification(
  facts: BookingEmailFactsType
): Promise<RenderedEmailType> {
  const when = formatBookingTime(facts.startsAt, facts.business.timezone);
  const email = <BookingNotificationEmail facts={facts} when={when} />;
  return {
    subject: `New booking: ${facts.service}, ${when}`,
    html: await render(email),
    text: await render(email, { plainText: true }),
  };
}

function BookingNotificationEmail({ facts, when }: { facts: BookingEmailFactsType; when: string }) {
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
          ? `Booked on your website. Replying goes straight to ${customer.name}.`
          : `Booked on your website. ${customer.name} gave no email, so call to reach them.`
      }
    >
      <Heading
        as="h1"
        style={{ margin: "0 0 20px", fontSize: "22px", lineHeight: "30px", color: emailColors.ink }}
      >
        New booking
      </Heading>

      <EmailField label="What">{facts.service}</EmailField>
      <EmailField label="When">{when}</EmailField>
      <EmailField label="Booked with">{facts.personName}</EmailField>

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

      {customer.details ? (
        <>
          <Text
            style={{
              margin: "8px 0 6px",
              fontSize: "11px",
              lineHeight: "16px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: emailColors.muted,
            }}
          >
            In their words
          </Text>
          {/* One paragraph per blank line and a <br /> per line break, so their own lines survive
              in the HTML and in the plain-text twin alike. */}
          {customer.details.split(/\n{2,}/).map((paragraph, index) => (
            <Text
              key={index}
              style={{
                margin: "0 0 12px",
                fontSize: "16px",
                lineHeight: "24px",
                color: emailColors.ink,
              }}
            >
              {paragraph.split("\n").map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {lineIndex > 0 ? <br /> : null}
                  {line}
                </Fragment>
              ))}
            </Text>
          ))}
        </>
      ) : null}

      {customer.phone ? (
        <EmailButton href={telHref(customer.phone)} color={brand}>
          {`Call ${customer.name}`}
        </EmailButton>
      ) : null}
    </EmailLayout>
  );
}
