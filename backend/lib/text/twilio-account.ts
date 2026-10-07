// Backend: the agency's one Twilio account, which sends every business's texts from that
// business's own number (feature 8b, decision 1). Null without both keys: development sends no
// texts. Read at each call, never at import, so a test can set or clear them.

export type TwilioAccountType = {
  messagesUrl: string; // Twilio's Messages API for this account
  authorization: string; // the Basic header; never logged
  authToken: string; // checks that an incoming text came from Twilio; never logged
};

export function readTwilioAccount(): TwilioAccountType | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return {
    messagesUrl: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
    authToken,
  };
}
