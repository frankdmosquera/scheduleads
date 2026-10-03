/** @jsxImportSource react */
// Backend: the frame both booking emails sit in: the business's logo or name, one white card, and
// a small line under it. The backend's own JSX is Hono's, so this file says it is React's.

import type { ReactNode } from "react";
import { Body, Container, Head, Html, Img, Preview, Section, Text } from "@react-email/components";

import { emailColors } from "./email-colors.js";

export type EmailLayoutPropsType = {
  businessName: string;
  logo: string | null;
  preview: string; // the line an inbox shows beside the subject
  footer: ReactNode;
  children: ReactNode;
};

export function EmailLayout({
  businessName,
  logo,
  preview,
  footer,
  children,
}: EmailLayoutPropsType) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          backgroundColor: emailColors.paper,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 16px" }}>
          <Section
            style={{
              backgroundColor: emailColors.card,
              borderRadius: "12px",
              border: `1px solid ${emailColors.line}`,
              padding: "28px",
            }}
          >
            {logo ? (
              // Most clients block images until the reader allows them, so the name is the alt text.
              <Img
                src={logo}
                alt={businessName}
                width="140"
                style={{ display: "block", marginBottom: "16px", height: "auto" }}
              />
            ) : (
              <Text
                style={{
                  margin: "0 0 16px",
                  fontSize: "18px",
                  lineHeight: "26px",
                  fontWeight: 600,
                  color: emailColors.ink,
                }}
              >
                {businessName}
              </Text>
            )}
            {children}
          </Section>
          <Text
            style={{
              margin: "16px 0 0",
              fontSize: "12px",
              lineHeight: "18px",
              color: emailColors.muted,
              textAlign: "center",
            }}
          >
            {footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
