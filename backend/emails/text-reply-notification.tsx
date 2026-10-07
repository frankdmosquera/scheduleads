/** @jsxImportSource react */
// Backend: a customer's text reply, passed on to the business by email (feature 8b, decision 9):
// who sent it, their number, and their words exactly as written, line by line. From the business's
// own sender, under its brand, and never the product's name.

import { Fragment } from "react";
import { Heading, Link, render, Text } from "@react-email/components";

import { telHref } from "@scheduleads-app/shared/tel-href";

import { EmailButton } from "./email-button.js";
import { emailColors } from "./email-colors.js";
import { EmailField } from "./email-field.js";
import { EmailLayout } from "./email-layout.js";
import type { RenderedEmailType } from "./rendered-email-type.js";

export type TextReplyFactsType = {
  business: { name: string; logo: string | null; brandColor: string | null };
  senderName: string | null; // when the number is on one of the business's leads
  number: string; // "403-555-0148"
  words: string;
};

export async function renderTextReplyNotification(
  facts: TextReplyFactsType
): Promise<RenderedEmailType> {
  const who = facts.senderName ?? facts.number;
  const email = <TextReplyNotificationEmail facts={facts} who={who} />;
  return {
    subject: `Text from ${who}`,
    html: await render(email),
    text: await render(email, { plainText: true }),
  };
}

function TextReplyNotificationEmail({ facts, who }: { facts: TextReplyFactsType; who: string }) {
  const brand = facts.business.brandColor ?? emailColors.ink;
  return (
    <EmailLayout
      businessName={facts.business.name}
      logo={facts.business.logo}
      preview={facts.words.slice(0, 90)}
      footer={`Answer ${who} at ${facts.number}; replying to this email does not reach them.`}
    >
      <Heading
        as="h1"
        style={{ margin: "0 0 16px", fontSize: "22px", lineHeight: "30px", color: emailColors.ink }}
      >
        {`${who} texted`}
      </Heading>
      {facts.words.split("\n").map((line, index) => (
        <Text
          key={index}
          style={{
            margin: "0 0 8px",
            fontSize: "16px",
            lineHeight: "24px",
            color: emailColors.ink,
          }}
        >
          <Fragment>{line}</Fragment>
        </Text>
      ))}
      <EmailField label="Phone">
        <Link href={telHref(facts.number)} style={{ color: brand, textDecoration: "none" }}>
          {facts.number}
        </Link>
      </EmailField>
      <EmailButton href={telHref(facts.number)} color={brand}>
        {`Call ${who}`}
      </EmailButton>
    </EmailLayout>
  );
}
